# Revisión del dashboard — 3 de noviembre de 2026

Esta revisión describe la etapa inicial de frontend. La [integración posterior de orientación](../docs/orientacion-en-dashboard.md), autorizada después, amplía el contrato opcional para mostrar grados del firmware en la última medición, sin migración. Las limitaciones de datos de las secciones siguientes corresponden al estado anterior a esa ampliación.

## 1. Estado encontrado

React + TypeScript, CSS y componentes existentes, sin añadir dependencias. El dashboard mostraba humedad RAW ADC, vibración digital y última comunicación. Los siete valores MPU estaban disponibles en un desplegable. Temperatura no tenía unidad visible, y el texto indicaba unidades pendientes pese a que el firmware y su documentación ya establecen m/s², rad/s y °C. El semáforo era una base visual de tres luces inactivas, con evaluación pendiente.

`App.tsx` consulta catálogo y mediciones mediante `api/telemetry.ts`. Dashboard y estado del nodo usan `GET /api/v1/readings/latest?nodeId=...`; historial usa `GET /api/v1/readings` con filtros. Actualización manual, sin polling. `receivedAt` es recepción en servidor, no hora de adquisición del nodo ni prueba de conectividad en el instante de consulta. El acceso sigue usando autenticación existente.

## 2. Datos disponibles y presentación aplicada

| Base de datos | JSON de consulta | Presentación |
| --- | --- | --- |
| node_id | nodeId | Nodo seleccionado |
| received_at | receivedAt | Última recepción con fecha/hora local del navegador |
| soil_moisture_raw | soilMoistureRaw | Humedad RAW ADC; sin porcentaje ni interpretación de sequedad |
| vibration_detected | vibrationDetected | Detectada / No detectada en la última medición |
| accel_x, accel_y, accel_z | accelX, accelY, accelZ | Aceleración X/Y/Z en m/s², visible en el dashboard |
| gyro_x, gyro_y, gyro_z | gyroX, gyroY, gyroZ | Giroscopio X/Y/Z en rad/s, visible en el dashboard |
| temperature | temperature | Tarjeta de temperatura del módulo en °C, además del detalle MPU |

Cero conserva su significado de dato válido. Ausencia de lecturas o bloque MPU NULL sigue mostrando ausencia, sin sustituirla por cero. La validación del cliente existente se conserva: exige bloque MPU completo o todos NULL.

El resumen de recepción distingue **Datos recibidos / Sin datos** y muestra **Conexión actual sin confirmar**. No se afirma En línea a partir de una fila histórica ni se inventa un intervalo de desconexión. Los errores de consulta y sesión siguen tratados por el flujo existente.

## 3. Inclinación relativa: disponible en el nodo, ausente de la API

La calibración inicial del firmware se acepta como realizada y no se repite ni bloquea este trabajo. `roll`, `pitch`, `baselineRoll`, `baselinePitch`, `deltaRoll`, `deltaPitch` y contadores no están en el POST, en `Reading` ni en las columnas seleccionadas. La sección de inclinación informa esta limitación; no inventa ceros, grados ni estados del nodo. No se derivan ángulos en el navegador desde el acelerómetro, pues sería otra referencia y otro filtrado respecto al firmware.

### Cambio mínimo futuro, no implementado

Exponer los deltas requiere al menos: añadir telemetría de orientación al JSON del firmware, ampliar la validación estricta del POST, transferir esa información hasta una respuesta de consulta y ampliar el contrato/tipos del cliente. Añadir solamente propiedades al frontend no puede exponerla: el backend rechaza campos desconocidos y hoy reconstruye las respuestas desde las columnas existentes.

La ampliación debería conservar lecturas legacy y distinguir calibrando / lectura válida / sin dato para no publicar ceros ficticios mientras se forma el baseline. El cálculo seguiría en el firmware y la calibración física no se repetiría por una decisión de presentación.

Si los deltas deben conservarse en historial y sobrevivir al reinicio del backend, se necesitará persistencia y una migración posterior explícita. Una consulta transitoria en vivo evitaría columnas nuevas, pero necesitaría retención temporal y definir pérdida al reiniciar; no está implementada ni se propone introducirla dentro de esta tarea. Es una decisión de la siguiente integración, no un cambio de frontend seguro que pueda hacerse silenciosamente hoy.

## 4. Archivos modificados en esta tarea

- `src/components/TelemetryViews.tsx`: recepción y última fecha, tarjeta de temperatura, MPU visible y aviso de inclinación no transmitida. Estado del nodo sin inferencias de conectividad y diagnóstico limitado a lo que entrega la API.
- `src/components/MpuPanel.tsx`: unidades documentadas, ceros válidos, ausencia de lectura y eliminación del texto obsoleto de unidades/calibración MPU pendientes.
- `src/components/RiskPanel.tsx`: cuatro niveles propuestos, todos inactivos, separados de inclinación experimental.
- `src/App.tsx`: pie coherente con inclinación calculada en el nodo pero aún no transmitida.
- `src/styles.css`: distribución de recepción y leyenda de cuatro niveles, con adaptación móvil.
- `tests/telemetry.test.tsx`: tres pruebas nuevas de presentación y semántica; contratos existentes preservados.
- Este informe y la nota de actualización en `README.md`.

No se modificaron firmware, umbrales, backend, esquemas, migraciones, API, autenticación ni configuración de red. Se respetaron los cambios previos que ya existían en el árbol de trabajo.

## 5. Propuesta visual mínima de riesgo

Orden del dashboard: recepción y última fecha; tarjetas de humedad/vibración/temperatura; vectores MPU; disponibilidad de inclinación relativa; evaluación global pendiente.

Se propone NORMAL (verde), PRECAUCIÓN (amarillo), ALERTA (naranja) y CRÍTICO (rojo) como futura escala visual. **Hoy se muestran los cuatro nombres en gris, sin nivel activo** y con la indicación Pendiente de configuración. Color no será el único portador de significado: se conservarán nombres escritos.

La evaluación futura deberá combinar humedad, inclinación relativa, persistencia y vibración. El frontend mostrará una evaluación validada, sin asignar CRÍTICO a una sola lectura ni copiar el estado crítico de inclinación como riesgo global. No se han definido pesos, límites de humedad, combinaciones, tiempos adicionales ni criterios geotécnicos en esta tarea.

## 6. Impacto y verificación

- Frontend: **32 pruebas aprobadas**, cero fallidas, frente a las 29 anteriores. Incluyen temperatura cero, unidades, lecturas ausentes/antiguas, no inventar conectividad o inclinación y cuatro niveles inactivos incluso con vibración y RAW extremo.
- Backend: **240 pruebas aprobadas**, cero fallidas u omitidas; ejecución con sockets locales habilitados para la suite HTTP.
- Build de frontend TypeScript + Vite: **aprobado**.
- `git diff --check` para los archivos editados: revisado antes de entregar.
- Se preparó una previsualización temporal local de los componentes con datos de prueba identificados, en una carpeta `tmp` ignorada. La herramienta de navegador agotó el tiempo al abrirla; **revisión visual por navegador no completada**. Las pruebas de renderizado de componentes sí fueron ejecutadas. No se afirma comprobación visual de la sesión autenticada ni funcionamiento responsive observado en un dispositivo.

La última lectura física del nodo o una prueba antigua no se usan como evaluación de riesgo activa en la aplicación.
