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

## Incremento 7: diagnóstico y recuperación de comunicación

Verificación de software: compilación exitosa con ESP32 3.3.12 y `esp32:esp32:esp32`, 970088 bytes de flash (74%) y 49968 bytes de RAM global (15%). Backend: 129 pruebas exitosas, cero fallidas u omitidas. Versión cargada y verificada en el ESP32; pruebas físicas A, B y C confirmadas en las ventanas de observación documentadas.

El contrato JSON, sensores, ventana de vibración, tabla y backend no cambian. Se mantienen envíos cada 5000 ms y reconexión periódica cada 10000 ms, con auto-reconexión del core. Si el core no acepta reconnect (por ejemplo, ya está conectando), se informa el estado y se espera otro ciclo; no se llama begin repetidamente ni se fuerza una desconexión. Una transición a conectado reinicia el temporizador de reconexión. Los sensores continúan en su loop independiente.

HTTP_CONNECT_TIMEOUT_MS y HTTP_READ_TIMEOUT_MS valen 2000 ms cada uno. Son límites de fases de conexión/lectura, no una garantía de duración total de 2000 ms para todo el POST. Se registra la duración observada. No se reutiliza el socket entre solicitudes y http.end() libera recursos después del intento.

Mensajes nuevos: `WiFi: conectado.`, `WiFi: conexión perdida`, `WiFi: intentando reconexión`, `WiFi: recuperado.`, `HTTP: 201 accepted`, `HTTP transporte: <código> (<errorToString>)` y `HTTP servidor: <código>`. Solo 201 confirma persistencia. En el core 3.3.12, -1 se denomina connection refused y se devuelve si connect() falla: puede deberse a servidor apagado, bloqueo de red o fallo de conexión; no prueba por sí solo que el servidor rechazó activamente. -11 identifica timeout de lectura. No imprimir credenciales, URL ni cuerpos HTTP.

No se reenvía automáticamente una copia idéntica en un bucle inmediato. Ante fallo, el siguiente ciclo toma otra lectura y conserva la memoria de vibración hasta un 201. No se conservan todas las muestras ni hay almacenamiento offline. El contador protege eventos observados durante una transmisión; esta lógica permanece intacta.

### Procedimiento de pruebas físicas de recuperación

Preparar el backend desde PowerShell normal de Windows y comprobar health desde otro dispositivo. Cargar esta versión; usar BOOT solo si la carga normal lo requiere y EN con BOOT suelto si no arranca. Monitor serial siempre a 115200.

A. Normal: backend y WiFi activos. Observar al menos tres `HTTP: 201 accepted` y comprobar filas nuevas por SELECT. Un intento aislado exitoso no demuestra estabilidad prolongada.

B. Backend caído: con el ESP32 funcionando, detener backend con Ctrl+C. Observar durante 15 segundos lecturas seriales continuas y errores de transporte. Provocar vibración durante la caída para comprobar memoria de eventos. Reiniciar `npm run dev` en la misma terminal normal y verificar el regreso de 201 y una fila posterior con vibration_detected=true. No reiniciar el ESP32 entre ambas fases, pues se perdería la memoria.

C. WiFi caído: interrumpir temporalmente el punto de acceso usado por el ESP32 (desconectar solo el WiFi del PC no prueba pérdida de WiFi del nodo). Observar lecturas durante 20–30 segundos y diagnósticos de pérdida/reconexión. Restaurar el punto de acceso, esperar reconexión y 201, y comprobar nuevas filas. Si cambia la IP del PC, verificarla con ipconfig antes de atribuir un fallo al firmware. Esta prueba requiere intervención del usuario y puede interrumpir su conexión con Codex; anotar los mensajes en el monitor serial para revisarlos después.

Detener la prueba después de reunir evidencia. No desactivar firewall ni aislamiento de Codex. La recuperación WiFi de la prueba C fue validada mediante el hotspot de Windows; ver evidencia posterior.

### Evidencia física A/B del 4 de octubre de 2026

A: tres HTTP 201 observados con duraciones de 188, 204 y 315 ms y lecturas recientes comprobadas en PostgreSQL con los siete campos MPU presentes.

B: backend detenido manualmente, sensores continuaron reportando y se observó transporte -1 (connection refused), 2002 ms, con WiFi conectado. Se provocó vibración durante la caída y se verificó el evento por Serial. Antes de restaurar backend había 364 filas. Tras restaurarlo, la primera fila nueva, ID 365, tuvo vibration_detected=true y los siete campos MPU presentes; ID 366 volvió a false. Se observaron nuevos 201 (166 y 582 ms en la muestra posterior), sin reiniciar el ESP32. Esto confirma memoria y limpieza de ese evento tras aceptación. No demuestra estabilidad prolongada ni recuperación WiFi.

### Duplicados: siguiente diseño propuesto, sin implementación

Si el servidor guarda la lectura pero se pierde la respuesta, la confirmación es incierta. Aunque este firmware envía una muestra nueva en el siguiente ciclo, puede repetir evidencia de vibración y producir registros parecidos; no ofrece exactly-once. Un futuro incremento puede asignar un identificador por lectura en el nodo, conservándolo durante reintentos de esa misma lectura, y agregar deduplicación con una restricción única y manejo idempotente en backend. Antes de implementarlo deben definirse unicidad entre reinicios, retención y respuesta a duplicados. No se agrega ese identificador ni migración en el incremento 7.

### Preparación de prueba C mediante hotspot de Windows

Se cargó una compilación nueva para el hotspot dedicado de Windows en 2.4 GHz, con backend en 192.168.137.1:3000. El archivo local secrets.h permanece ignorado; no se registran credenciales. Tras requerir BOOT para cargar y EN/RESET manual para arrancar, se observaron inicialmente errores de transporte -1. El usuario creó una regla de entrada limitada a Node.js, TCP 3000, dirección local del hotspot y subred 192.168.137.0/24. Posteriormente se observaron cuatro HTTP 201 (104, 110, 82 y 89 ms) y filas recientes de PostgreSQL, incluidas 846–848, con los siete campos MPU presentes. No se determinó de forma concluyente la causa del bloqueo inicial; el teléfono todavía reporta que health no carga. La lectura del registro protegido del firewall fue denegada por permisos. En esa etapa quedó confirmado el funcionamiento normal del ESP32 por el hotspot; la interrupción y recuperación se verificaron después, como se describe abajo. No se modificó el firmware durante este diagnóstico.

### Resultado físico de prueba C

El usuario apagó únicamente el hotspot, manteniendo el WiFi principal y el backend activos. Durante una ventana de 25 segundos continuaron las lecturas multisensor, se omitió HTTP por WiFi no disponible y se observaron intentos de reconexión separados por aproximadamente diez segundos. El core indicó que ya estaba conectando (estado 6); el firmware informó el resultado y esperó otro ciclo. No se observaron mensajes de arranque en esa ventana. Health local siguió respondiendo y la base tenía 866 filas, máximo ID 866.

El usuario restauró el hotspot sin pulsar RESET ni BOOT. En la siguiente ventana de 25 segundos se observaron cinco HTTP 201 (70, 71, 70, 70 y 91 ms), con lecturas continuas. PostgreSQL confirmó nueve filas posteriores, IDs 867–875; las tres últimas consultadas contenían los siete campos MPU no NULL. La transición textual WiFi: recuperado no quedó capturada porque la conexión ya estaba restablecida al abrir el monitor. La evidencia confirma recuperación de comunicación y persistencia sin intervención de reinicio durante esta prueba; no demuestra estabilidad prolongada. A/B/C quedan validadas para los escenarios y ventanas descritos. El cierre del incremento 7 se registra en un commit local, sin push.
