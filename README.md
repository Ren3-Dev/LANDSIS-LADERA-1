# LANDSIS LADERA-1

Sistema universitario que conecta el nodo IoT LADERA-1 con un backend, una base de datos y una aplicación web.

El objetivo general de este repositorio es organizar el desarrollo y la documentación de los componentes del sistema, manteniendo separados el firmware, el backend, el frontend y los archivos de base de datos.

## Arquitectura general prevista

Nodo LADERA-1 → HTTP/JSON → Backend → PostgreSQL → Aplicación web.

La comunicación del nodo está prevista mediante Wi-Fi. El backend utilizará Node.js y TypeScript, y la base de datos prevista es PostgreSQL.

## Organización del repositorio

- `firmware/`: firmware del nodo LADERA-1.
- `backend/`: backend del sistema y recepción de datos del nodo.
- `frontend/`: aplicación web del sistema.
- `database/`: archivos relacionados con la estructura y gestión de la base de datos.
- `docs/`: documentación técnica y académica del proyecto.

## Estado actual

El backend implementa health, recepción de mediciones, historial y última medición con Node.js, TypeScript, Express y PostgreSQL. El firmware ESP32 está implementado y fue validado físicamente. La beta React + TypeScript del dashboard está en `frontend/`; consultar [su guía de ejecución y verificación](frontend/README.md).

## Telemetría multisensor (incremento 5)

El backend implementa POST, historial y última medición con PostgreSQL. La API mantiene `nodeId`, `soilMoistureRaw` (ADC entero 0–4095) y `vibrationDetected`. Acepta ese payload legacy o el bloque completo `accelX`, `accelY`, `accelZ`, `gyroX`, `gyroY`, `gyroZ`, `temperature`: siete números finitos, sin rangos físicos arbitrarios. Rechaza campos desconocidos y bloques parciales.

La API utiliza camelCase y PostgreSQL snake_case (`accel_x`, `gyro_y`, etc.). POST y GET devuelven los siete campos MPU; `null` indica lectura ausente, incluido el historial previo. Cero es una medición válida. Los valores MPU son experimentales/no calibrados: no se calculan inclinación, magnitud, desplazamiento, porcentaje de humedad ni riesgo. Las unidades deben documentarse desde el firmware antes de interpretar los datos.

En instalaciones nuevas aplicar 001 y luego `database/002_add_mpu6050_fields_to_sensor_readings.sql`; en instalaciones existentes verificar el esquema y aplicar solamente 002, una vez, antes de iniciar esta versión del backend. Agrega siete columnas DOUBLE PRECISION anulables sin relleno y un CHECK: todos NULL o todos presentes. No modifica los campos originales.

Ejecutar `npm test` desde backend (incluye build). Las pruebas utilizan dobles de persistencia; la verificación de la base real es independiente.

## Prueba física por WiFi (incremento 6)

El sketch HTTP se encuentra en `firmware/landsis_ladera1/landsis_ladera1.ino`, derivado del sketch original conservado en `firmware/Nodo_Ladera_1_v1.ino`. La [guía de prueba](firmware/landsis_ladera1/README.md) explica credenciales locales ignoradas por Git, URL del PC, carga, diagnóstico y verificación en PostgreSQL. La comunicación usa WiFi/HTTPClient nativos en una tarea separada para que los timeouts no bloqueen el loop de sensores. El éxito físico requiere ejecutar la prueba con el ESP32 y la red real.

## Nodos y consultas (incremento 8)

La migración `database/003_create_nodes_and_link_readings.sql` crea `nodes(node_id TEXT PRIMARY KEY)`, registra los identificadores históricos exactos y LADERA-1, añade la FK y un índice `(node_id, received_at DESC, id DESC)`. Aplicar una sola vez después de 001/002, con recepción detenida y verificación previa de históricos. No normaliza identificadores ni modifica mediciones. Se aplicó localmente conservando las 885 filas y una huella idéntica de su contenido completo.

POST conserva su URL y JSON legacy/multisensor. Registra automáticamente el nodo y guarda la medición en una misma conexión/transacción; responde 201 después del commit. La existencia de un nodo no autentica al dispositivo.

- `GET /api/v1/nodes`: `{ "nodes": [{ "nodeId": "LADERA-1" }] }`, orden por identificador con colación C; lista vacía válida.
- `GET /api/v1/readings`: admite `nodeId`, `from`, `to` y `limit`. nodeId se compara exactamente, sin normalización. Sin filtros mantiene el historial global, más reciente primero.
- `from` inclusivo y `to` exclusivo filtran received_at (recepción del servidor). Formato `YYYY-MM-DDTHH:mm:ss[.SSS]Z` o zona `±HH:mm`, fracción opcional de 1–3 dígitos. Exige calendario válido y from < to cuando ambos existen. Codificar `+` como `%2B` en URLs.
- `limit`: 50 predeterminado, entre 1 y 100; sin paginación ni agregaciones.
- `GET /api/v1/readings/latest`: última global, o del nodo con `?nodeId=LADERA-1`; solo admite nodeId.

Consultas inválidas, repetidas o con parámetros desconocidos devuelven 400. Historial sin coincidencias devuelve 200 con readings vacío; latest sin coincidencias devuelve 404. Los campos MPU y su semántica NULL permanecen iguales. Estas consultas permiten una beta con historial y gráficas recientes, no un historial ilimitado.

Verificación del incremento: 161 pruebas automatizadas exitosas (incluidas las 129 previas), build TypeScript y GET locales contra PostgreSQL. No se modificó firmware ni se añadieron dependencias, CORS o lógica de riesgo.

## Usuarios y autenticación (incremento 10)

Login y sesión opaca en cookie HttpOnly; consultas del dashboard requieren usuario
activo. ADMINISTRADOR gestiona usuarios; INVESTIGADOR y CONRED consultan dashboard.
El POST IoT permanece compatible sin login humano. La migración 004 y bootstrap
inicial están preparados, **pendientes de ejecución local**. Consultar la
[guía de autenticación, pruebas y activación](docs/incremento-10-autenticacion.md).
