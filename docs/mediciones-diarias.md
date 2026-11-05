# Mediciones diarias e historial detallado

## Criterio

El apartado Mediciones diarias aparece primero en el historial, seguido de la gráfica RAW y del Historial de mediciones almacenadas. Para cada nodo se selecciona **la última medición real recibida de cada día**, según zona **America/Guatemala**. No se calcula un promedio, no se crean registros nuevos ni se borra o sustituye el historial original. Los días sin mediciones se omiten.

El día actual se actualiza al volver a consultar, pues se selecciona su última fila disponible. No es un registro congelado a una hora fija. Si existen empates de fecha/hora de recepción, gana el ID más alto.

## Consulta y límites

Nueva ruta autenticada de solo lectura: `GET /api/v1/readings/daily?nodeId=LADERA-1`.

- nodeId obligatorio, exacto, sin normalizar; el filtro se aplica antes de agrupar.
- from inclusivo y to exclusivo, con el mismo contrato ISO y validación del historial existente.
- limit predeterminado 50, permitido 1–100. En esta ruta limita días con datos después de seleccionar la última fila por fecha.
- Respuesta `{ "readings": [...] }`, con la misma forma de lectura persistida existente; ausencia de coincidencias da lista vacía. Parámetros inválidos dan 400; sin sesión, 401. Los errores de persistencia no exponen SQL.

La consulta PostgreSQL utiliza `DISTINCT ON` sobre `(received_at AT TIME ZONE 'America/Guatemala')::date`, con orden por día descendente, received_at descendente e ID descendente. No necesita migración, extensión ni tabla adicional. La transformación de columnas snake_case a JSON camelCase es la misma del historial.

El frontend consulta de manera independiente `/readings/daily` y `/readings`, en paralelo, para el nodo y rango seleccionados. No agrupa las últimas 50/100 lecturas del historial en memoria: esa estrategia solo cubriría unos minutos y ocultaría días anteriores. El límite del formulario aplica a días en el primer listado y a lecturas en el segundo. Al filtrar parte de un día, se escoge la última medición dentro del intervalo, no una fila fuera del rango seleccionado.

El resumen diario muestra día y hora en Guatemala, humedad RAW y vibración. El historial detallado y sus detalles MPU se conservan. No se añaden deltas de inclinación al historial, porque siguen siendo datos transitorios de la última orientación y no columnas persistidas.

## Archivos

- Backend: `data/readings.ts`, `controllers/readings.ts`, `routes/readings.ts`, `app.ts`: consulta y nueva ruta con autenticación existente.
- Frontend: `api/telemetry.ts`, `App.tsx`, `components/DailyReadings.tsx`, `components/TelemetryViews.tsx`: carga independiente y presentación diaria primero.
- Pruebas diarias de frontend/backend y ajuste del helper autenticado de pruebas para inyectar la consulta diaria sin acceso a base real en las suites.

Sin cambios de firmware, calibración, umbrales, red, credenciales o esquema de base de datos.

## Verificación — 3 de noviembre de 2026

- Frontend: **42 pruebas aprobadas**, cero fallidas; build TypeScript/Vite aprobado.
- Backend: **246 pruebas aprobadas**, cero fallidas. Casos de ruta autenticada, validación de filtros, nodo obligatorio, parametrización, orden de desempate y errores internos protegidos.
- Presentación: apartado diario antes de gráfica/detalle, cero RAW válido, lista vacía, filtros enviados al endpoint correcto y fecha Guatemala al cruzar medianoche UTC.
- Comprobación real mediante transacción **REPEATABLE READ READ ONLY**, finalizada con ROLLBACK: **1925 filas de LADERA-1**, **7 días con datos**. IDs diarios coinciden con una agrupación independiente de todos los timestamps/IDs de ese snapshot: **1925, 1291, 1261, 1142, 1018, 885, 2**. La selección filtrada de 2026-11-03 también coincidió con el día local correcto.
- Ejemplo de frontera: ID 1291, recibido `2026-11-03T05:59:57.127Z`, corresponde al **2 de noviembre en Guatemala**, no al día 3.

Es evidencia de la consulta con los datos disponibles en esa ejecución, no una garantía de recepción actual del nodo. No se insertaron muestras sintéticas ni se modificaron filas para verificarla.
