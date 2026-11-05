# Propuesta de semáforo — 3 de noviembre de 2026

## Información disponible

El nodo transmite orientación relativa válida, estado de inclinación y tres contadores mediante `orientation` de la última medición. El backend los valida y entrega sin recalcular los ángulos. Humedad sigue en ADC crudo, sin calibración confirmada; vibración es un indicador booleano por ventana de envío, no una medida de intensidad. No hay una matriz aprobada que combine las tres variables para determinar riesgo global.

## Opción inmediata: semáforo experimental de inclinación

Fuente: exclusivamente `reading.orientation`, ya validado por la API y el cliente. No se recalcula severidad desde una muestra aislada ni se sustituyen valores ausentes por NORMAL.

| Estado recibido del firmware | Presentación propuesta | Criterio existente en el nodo |
| --- | --- | --- |
| NORMAL | Verde, con texto NORMAL | Ningún contador ha confirmado un nivel superior. Si hay contadores pendientes, mostrar Cambio en observación y los contadores; no afirmar ausencia de movimiento. |
| PRECAUCION | Amarillo, PRECAUCIÓN | Algún delta absoluto >=0,5° y contador correspondiente completo (6). |
| ALERTA | Naranja, ALERTA | Algún delta absoluto >=1° y contador correspondiente completo (6). |
| CRITICO | Rojo, CRÍTICO de inclinación | Algún delta absoluto >=2° y contador correspondiente completo (6). |
| calibrating / unavailable / sin orientación | Gris, sin nivel activo | Calibrando / sin lectura válida / esperando datos. |

La activación visual respetaría el estado entregado por el firmware, cuya persistencia se evalúa cada 10 s. Una lectura con delta alto y contador incompleto no se convertiría en CRÍTICO desde el navegador. El descenso y reinicio de contadores seguirían la lógica existente del nodo; no se inventaría histéresis adicional.

No se afirmaría estado en tiempo real ni conectividad por una fila histórica: se mostraría que el semáforo pertenece a la última recepción, junto a su fecha. La actualización seguiría siendo manual. No hay un criterio aprobado de caducidad para declarar desconexión; no se agregaría un límite arbitrario. La caché de orientación existente puede perderse al reiniciar el backend, en cuyo caso el indicador sería gris hasta una nueva orientación recibida.

Humedad y vibración permanecerían visibles como contexto, sin modificar por sí solas el nivel de inclinación. Un texto separado indicaría **Riesgo global: no evaluado**. Este semáforo no equivale a una predicción de deslizamiento ni una evaluación geotécnica.

Cambios previstos: presentación de `RiskPanel.tsx`, paso de orientación/fecha desde `TelemetryViews.tsx`, estilos accesibles con color y texto, y pruebas que cubran estados, ausencia de datos y contadores incompletos. Sin modificar firmware, API, PostgreSQL ni umbrales. No requiere USB.

## Riesgo global combinado: decisiones pendientes

Para integrar humedad, inclinación, persistencia y vibración se necesita definir con el usuario:

- Calibración física de humedad y significado de sus valores. ADC 4095 no se interpreta como porcentaje, suelo seco o saturación por sí solo.
- Matriz de combinaciones y condiciones de cada nivel; no hay valores numéricos globales aprobados en el repositorio.
- Papel y persistencia de vibración, cuya presencia aislada no debe crear CRÍTICO.
- Persistencia y recuperación del estado global, sin confundirlas con los contadores de inclinación ya existentes.
- Política de datos incompletos/atrasados y cambios de baseline; faltantes no deben dar verde por defecto.

Hasta resolver esas decisiones, el riesgo combinado debe quedar **no evaluado**. No se propone un nuevo umbral numérico de humedad ni una fórmula de ponderación inventada. La validación adicional contra ángulos exactos sigue siendo una tarea experimental separada y no bloquea la visualización del estado de inclinación ya disponible.

## Estado de esta propuesta

El usuario eligió **Activar semáforo experimental de inclinación**. Se implementó en el frontend con el título explícito SEMÁFORO EXPERIMENTAL DE INCLINACIÓN y un bloque separado Riesgo global: no evaluado.

`RiskPanel.tsx` recibe la orientación y la fecha de recepción de la misma medición desde `TelemetryViews.tsx`. Activa un único nivel según el estado entregado por el firmware y comprueba que el contador correspondiente esté en 6; si un estado superior carece de persistencia confirmada, muestra gris y Persistencia sin confirmar. No convierte un delta alto aislado en CRÍTICO. NORMAL con contadores incompletos se acompaña de Persistencia en observación, evitando presentarlo como ausencia de movimiento. Sin orientación válida o sin fecha no se activa verde por defecto.

Los cuatro colores son verde, amarillo, naranja y rojo, con texto, borde y marca Activo. Las lecturas ausentes/calibrando/inválidas quedan grises. La fecha y la advertencia de que se trata de la última lectura permanecen visibles; no se afirma conexión en tiempo real. Los colores se adaptan al ancho móvil sin introducir librerías.

Se añadieron pruebas de los cuatro niveles, exclusión entre indicadores, datos ausentes, contadores pendientes e inconsistentes y separación del riesgo global. Resultado de la suite final: **38 pruebas de frontend aprobadas**. Backend sin cambios en esta etapa: **243 pruebas aprobadas**. Build TypeScript/Vite comprobado al cerrar. No hubo carga de firmware, reinicio del ESP32, migración ni cambios de umbrales, credenciales, humedad o vibración.

### Ajuste posterior de presentación solicitado por el usuario

Se priorizó el semáforo como primer bloque de datos del dashboard. Debajo aparecen Humedad / Vibración / Inclinación; la tarjeta de inclinación muestra los dos deltas existentes o su ausencia, sin valores inventados. Se retiró la sección de telemetría cruda MPU del dashboard. El detalle de inclinación relativa permanece y termina con temperatura del MPU6050 (dos decimales y °C), explicando que es temperatura interna del módulo y no del suelo ni del ambiente. Recepción y última fecha se movieron al final. Los detalles crudos del historial no se alteraron.

Este ajuste se realizó sin conexión a la red del nodo ni cambios en firmware/backend/API/base de datos. Se añadieron comprobaciones de orden, ausencia del bloque crudo y ubicación única de temperatura; **39 pruebas de frontend aprobadas**. Las lecturas ausentes, el cero de temperatura y los deltas cero conservan sus significados.

### Vigencia definida posteriormente

El usuario acordó **60 segundos sin recepción nueva** para dejar el semáforo gris y se añadió actualización automática cada 10 segundos en Dashboard y Estado del nodo. La falta de criterio de caducidad y actualización manual descritas en la propuesta inicial quedan sustituidas por [esta política de vigencia](vigencia-del-semaforo.md). Los estados de inclinación y sus umbrales no cambian.
