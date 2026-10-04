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

El backend implementa health, recepción de mediciones, historial y última medición con Node.js, TypeScript, Express y PostgreSQL. Firmware y frontend aún no tienen implementación en este repositorio.

## Telemetría multisensor (incremento 5)

El backend implementa POST, historial y última medición con PostgreSQL. La API mantiene `nodeId`, `soilMoistureRaw` (ADC entero 0–4095) y `vibrationDetected`. Acepta ese payload legacy o el bloque completo `accelX`, `accelY`, `accelZ`, `gyroX`, `gyroY`, `gyroZ`, `temperature`: siete números finitos, sin rangos físicos arbitrarios. Rechaza campos desconocidos y bloques parciales.

La API utiliza camelCase y PostgreSQL snake_case (`accel_x`, `gyro_y`, etc.). POST y GET devuelven los siete campos MPU; `null` indica lectura ausente, incluido el historial previo. Cero es una medición válida. Los valores MPU son experimentales/no calibrados: no se calculan inclinación, magnitud, desplazamiento, porcentaje de humedad ni riesgo. Las unidades deben documentarse desde el firmware antes de interpretar los datos.

En instalaciones nuevas aplicar 001 y luego `database/002_add_mpu6050_fields_to_sensor_readings.sql`; en instalaciones existentes verificar el esquema y aplicar solamente 002, una vez, antes de iniciar esta versión del backend. Agrega siete columnas DOUBLE PRECISION anulables sin relleno y un CHECK: todos NULL o todos presentes. No modifica los campos originales.

Ejecutar `npm test` desde backend (incluye build). Las pruebas utilizan dobles de persistencia; la verificación de la base real es independiente.
