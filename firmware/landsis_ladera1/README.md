# Prueba ESP32 → WiFi → HTTP → PostgreSQL

Este sketch se deriva de `../Nodo_Ladera_1_v1.ino`, conservado como línea base. Abrir únicamente `landsis_ladera1.ino` para la prueba HTTP. No juntar ambos sketches en una misma carpeta de Arduino.

## Configuración local

1. Copiar `secrets.example.h` a `secrets.h` dentro de esta carpeta.
2. Configurar localmente `WIFI_SSID` y `WIFI_PASSWORD`. El archivo `secrets.h` está ignorado por Git; no compartirlo ni publicar sus valores.
3. En el PC ejecutar `ipconfig`. Usar la IPv4 del adaptador conectado a la misma LAN que el ESP32, no la de VPN ni localhost.
4. Configurar `API_URL` como `http://<IPv4_REAL_DEL_PC>:3000/api/v1/readings`. Sustituir el puerto si PORT es distinto. El ejemplo es un placeholder, no una IP asignada.

## Backend

La base debe tener las migraciones 001 y 002 aplicadas. No volver a ejecutar 002 si ya está instalada.

En PowerShell:

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1\backend
npm run dev
```

El backend toma PostgreSQL y PORT del `.env` local. Desde otro dispositivo de la LAN, comprobar `http://<IPv4_REAL_DEL_PC>:3000/health`. Si Windows pide permiso para Node.js, permitir acceso en la red privada cuando se confíe en ella. No se modificó automáticamente el firewall. El aislamiento de clientes WiFi puede impedir comunicación aun estando en la misma red.

## Carga y diagnóstico

1. En Arduino IDE abrir `landsis_ladera1.ino` y verificar que `telemetria.h` y el `secrets.h` local estén en la misma carpeta.
2. Seleccionar la placa ESP32 Dev Module correspondiente al ESP32-WROOM-32 y el puerto del dispositivo.
3. Usar el core ESP32 y las bibliotecas Adafruit MPU6050, Adafruit Unified Sensor y sus dependencias ya utilizadas por el sketch original. WiFi, HTTPClient y FreeRTOS pertenecen al core; no se requiere ArduinoJson.
4. Verificar/compilar, cargar y abrir el monitor serial a 115200 baud.
5. Esperar los diagnósticos originales de sensores y `WiFi: conectado/reconectado.`. Cada aproximadamente cinco segundos debe aparecer `HTTP: enviando medición multisensor.`, el código y, si se acepta, `HTTP 201: medición aceptada.`.

El serial conserva su JSON diagnóstico original en snake_case. El JSON enviado por HTTP es independiente y usa exactamente los nombres camelCase aprobados, incluido `nodeId: "LADERA-1"`.

## Verificación física

En pgAdmin ejecutar:

```sql
SELECT id, node_id, soil_moisture_raw, vibration_detected,
       accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z,
       temperature, received_at
FROM sensor_readings
ORDER BY received_at DESC, id DESC
LIMIT 10;
```

También consultar `/api/v1/readings/latest` y `/api/v1/readings?limit=10`. Comparar lecturas recientes y horarios con el serial; las nuevas filas deben contener los siete valores MPU y las antiguas conservar NULL. Una fila enviada manualmente anteriormente no demuestra éxito del ESP32.

Probar vibración física y confirmar `vibration_detected`. Apagar temporalmente el backend y verificar que el reporte de sensores sigue cada segundo y que aparecen fallos HTTP; reiniciarlo y esperar nuevos 201. Probar pérdida/restablecimiento de WiFi y verificar reconexión y continuidad del diagnóstico. Confirmar estos resultados físicamente antes de declarar el hito completo.

## Comportamiento y límites

Compilación verificada con Arduino CLI, core ESP32 3.3.12 y placa `esp32:esp32:esp32`, en una copia temporal con placeholders. Resultado: 969324 bytes de flash (73%) y 49968 bytes de RAM global (15%). Esa comprobación inicial de compilación precedió a la validación física descrita abajo.

- `INTERVALO_ENVIO_MS = 5000`, reconexión cada 10000 ms y timeouts de conexión/lectura de 2000 ms son parámetros configurables de prueba en `telemetria.h`.
- HTTPClient es síncrono, por eso se ejecuta en una tarea nativa separada del loop de sensores. Dos colas de un elemento transfieren la copia de lectura y el resultado; no constituyen almacenamiento offline.
- El reporte serial conserva su ventana de un segundo. HTTP utiliza una memoria adicional de vibración hasta un 201. Un contador evita borrar eventos observados mientras se enviaba la copia anterior. Ante fallo se conserva la memoria y se envía una lectura nueva en un ciclo posterior.
- Solo se admite un envío en curso. No hay backlog ni conservación de todas las muestras durante una desconexión. La memoria se pierde al reiniciar el ESP32.
- Sin MPU disponible o con valores no finitos se omite HTTP, se informa el motivo y se continúa el monitoreo; no se envían ceros inventados.
- Se mantienen el promedio original de diez muestras con delay de 2 ms y el polling del 801S. Esas pequeñas ventanas ya existían y aún pueden perder pulsos muy cortos; no se garantiza captura absoluta ni se agregó interrupción.
- Un timeout después de que el servidor guardó una lectura puede dejar un resultado incierto; no hay identificador de deduplicación en este incremento.
- Lecturas Adafruit sin conversión: aceleración m/s², giroscopio rad/s y temperatura del MPU en °C, como muestra el sketch original. La temperatura no se presenta como temperatura del suelo. No se calcula inclinación, calibración, porcentaje ni riesgo.
- Los mensajes de Serial de ambas tareas pueden intercalarse. No se imprimen credenciales ni URL local.

## Resultado físico del incremento 6

El 4 de octubre de 2026 se observó HTTP 201 desde el ESP32 y se verificó PostgreSQL mediante consultas de solo lectura: 37 filas frente a 2 iniciales, siete campos MPU no NULL y cuatro filas posteriores al ID 21 con vibración true. El respaldo original permanece intacto. Se requirió BOOT durante la carga y EN/RESET con BOOT suelto para arrancar. También hubo errores de transporte -1; la estabilidad y recuperación continuas requieren pruebas adicionales.

Para la prueba LAN, iniciar el backend en una terminal normal de Windows y mantenerla abierta. Un backend ejecutado en el entorno aislado de Codex puede no admitir conexiones externas aunque health funcione desde el mismo PC. No desactivar ni modificar las reglas de aislamiento de Codex. Comprobar health desde otro dispositivo antes del ESP32. El perfil privado y el permiso de Node.js deben corresponder a una red confiable.

No copiar credenciales reales al archivo de ejemplo. Para cambiar secretos, guardar el archivo local y recompilar. Usar una carpeta de build exclusiva para este sketch; no reutilizar la de una copia con placeholders. Después de demostrar el resultado, desconectar el ESP32 y detener el backend para limitar datos de laboratorio.
