# Orientación del firmware en el dashboard

## Alcance

Integración solicitada después de confirmar la calibración inicial y conectar de nuevo el ESP32. No recalcula orientación en el navegador ni modifica fórmulas, muestreo, promedio, baseline de arranque o umbrales 0,5° / 1° / 2°. No implementa riesgo global, calibración de humedad, cambios de red ni migraciones.

## Contrato opcional

`POST /api/v1/readings` conserva los diez campos multisensor existentes y acepta un campo adicional opcional `orientation`. Sigue aceptando firmware legacy sin ese campo. Con orientación se requiere el bloque MPU completo.

Durante calibración: `{"status":"calibrating"}`. Ante orientación no válida después del baseline: `{"status":"unavailable"}`. No se publican ceros ficticios en esos estados.

Al terminar baseline:

```json
{
  "status": "ready",
  "roll": 0,
  "pitch": 0,
  "baselineRoll": 0,
  "baselinePitch": 0,
  "deltaRoll": 0,
  "deltaPitch": 0,
  "inclinationState": "NORMAL",
  "precautionCount": 0,
  "alertCount": 0,
  "criticalCount": 0
}
```

Este bloque es un ejemplo de contrato, no mediciones reales. Ángulos en grados. Los seis ángulos deben ser números finitos; los contadores, enteros entre 0 y 6. Estado de inclinación: NORMAL, PRECAUCION, ALERTA o CRITICO. Se rechazan campos parciales, desconocidos y estados/tipos inválidos. Los estados no ready solo admiten `status`.

El loop toma una copia de orientación junto con la lectura enviada; la tarea HTTP no accede al MPU ni a su objeto de filtrado. Se conserva el intervalo de envío de 10000 ms y la lógica de vibración pendiente. Buffers HTTP acotados con comprobación de truncamiento.

## Última orientación sin alterar PostgreSQL

El controlador separa `orientation` antes de persistir la lectura. Solo después de que `saveReading` confirma la transacción, guarda el bloque en una caché por instancia de aplicación, asociada al ID exacto y nodeId. Capacidad acotada a 256 mediciones confirmadas, con expulsión por orden de inserción; no es un parámetro de sensores.

`GET /api/v1/readings/latest` agrega `reading.orientation` solamente si existe esa coincidencia exacta. Una lectura nueva legacy no hereda los grados de otra fila. Commits fuera de orden no cambian la asociación. El filtro nodeId y la autenticación siguen vigentes. POST mantiene su respuesta previa y el historial conserva sus datos originales.

**Límites:** caché en RAM, sin historial de grados. Se pierde al reiniciar backend y puede expulsar entradas; una aplicación con múltiples procesos no comparte esta caché. Tras reiniciar o perder la entrada, el frontend espera un nuevo envío confirmado. Esta solución corresponde al backend local de un proceso; no se presenta como persistencia ni despliegue distribuido. Si se requiere historial o varios procesos, debe acordarse persistencia posterior antes de ampliar el alcance.

## Frontend

El cliente acepta tanto respuestas antiguas sin orientación como bloques nuevos estrictamente validados. `OrientationPanel` muestra delta roll y delta pitch en tarjetas con °, roll/pitch actuales, baseline y contadores. La presentación redondea a dos decimales, sin modificar las lecturas originales ni afirmar exactitud de centésimas.

Ausencia de bloque: Esperando orientación. Arranque: Calibrando referencia. Lectura no válida: Sin lectura válida. El estado CRÍTICO de inclinación no activa el semáforo global. El usuario sigue usando Actualizar datos; no se agregó polling o un umbral ficticio de desconexión.

## Verificación de software y carga

- Backend: 243 pruebas aprobadas en la primera ejecución de la integración, incluidas compatibilidad legacy, validación, asociación exacta, separación de nodos, caché acotada, pérdida por reinicio, fallo de persistencia y ausencia de orientación en historial.
- Frontend: 35 pruebas aprobadas y build TypeScript/Vite correcto, incluyendo ceros válidos, arranque/ausencia sin grados ficticios y separación de CRÍTICO de inclinación respecto al riesgo global.
- Compilación ESP32 3.3.12, `esp32:esp32:esp32`: aprobada, 974324 bytes de flash (74%) y 50184 bytes de RAM global (15%). Carga en COM3 aprobada con hashes verificados y reinicio por RTS; BOOT soltado durante programación. Se conservaron las credenciales locales, no modificadas.

Primera comprobación tras la carga: Serial mostró CALIBRANDO y HTTP 201, y PostgreSQL tenía registros reales 1841–1843 con recepciones a las 13:26:06, 13:26:15 y 13:26:25 de Guatemala. `/health` respondió ok. La consulta fue de solo lectura. Falta completar la captura hasta baseline ready y confirmar visualización de los grados actuales.

La captura completó después **baseline 75/75, NORMAL, 0/0/0** y quince lecturas angulares posteriores. Archivo local `logs/grados-http-20261103-192622.log`. Baseline 0,2417° / -0,5862°; última lectura a las 13:27:27: roll 0,2256°, pitch -0,5803°, delta roll -0,0161°, delta pitch 0,0059°. Hubo HTTP 201 después de ready (221 y 82 ms observados). La captura terminó normalmente y liberó COM3, sin reiniciar de nuevo.

PostgreSQL confirmó posteriormente IDs 1848–1850, recibidos 13:27:15,900, 13:27:25,806 y 13:27:36,432. No se insertaron muestras sintéticas para esta comprobación. Estos registros conservan los campos originales; los grados están en la caché de última orientación, no en esas columnas.

Los servidores frontend locales 5173 y 5174 respondieron HTTP 200 al módulo actualizado con DELTA ROLL y DELTA PITCH. Se indicó al usuario pulsar Actualizar datos en localhost:5174; la confirmación de su visualización autenticada estaba pendiente al registrar esta nota. Los grados no se calcularon ni se inyectaron como constantes en el frontend.

### Confirmación final del dashboard

El usuario aclaró que había seleccionado por error la opción de fallo y confirmó que sí aparecían los grados. Aportó captura de su sesión autenticada en `http://localhost:5174`, con etiqueta **Grados recibidos del nodo**: delta roll **0,01°**, delta pitch **-0,00°** (redondeo de pantalla); roll actual **0,25°**, pitch actual **-0,59°**, baseline roll **0,24°**, baseline pitch **-0,59°**; **NORMAL**, contadores **0/6, 0/6, 0/6**. Esto confirma la visualización real del bloque nuevo, no solamente renderizado con datos de prueba.

Integración física y visual comprobada para esta sesión: firmware cargado, baseline completado, HTTP 201, filas reales y orientación mostrada en dashboard. No se repitieron maniobras manuales de calibración, no se alteraron umbrales ni se habilitó riesgo global. Los grados siguen siendo temporales en backend y la actualización de pantalla es manual; ambas limitaciones anteriores permanecen vigentes.

Después el usuario eligió activar un **semáforo experimental de inclinación**, usando este estado recibido y sus contadores. Se documenta en [la propuesta y su implementación](propuesta-semaforo-experimental.md). Es un indicador de inclinación, no el semáforo de riesgo global mencionado como pendiente en este documento; ese riesgo combinado continúa sin evaluarse.

Actualización posterior: [vigencia del semáforo](vigencia-del-semaforo.md) acordada en 60 segundos sin recepción y consultas automáticas cada 10 segundos para Dashboard/Estado. Sustituye la actualización manual de esas vistas descrita en la integración inicial; la caché sigue siendo temporal y el historial mantiene su consulta manual.

La carga reinicia el ESP32 y repite automáticamente el baseline de 75 muestras ya implementado; se mantiene inmóvil al menos ochenta segundos. No requiere repetir las maniobras manuales de validación contra el teléfono.
