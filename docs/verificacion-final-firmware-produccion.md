# Verificación del firmware para producción — LADERA-1

Fecha: 5 de noviembre de 2026. Alcance: sketch activo `firmware/landsis_ladera1/`, informe de seguridad y fuentes del core ESP32 **3.3.12** instalado. Se trabajó sin leer/modificar `secrets.h`, generar credenciales, abrir puerto serial, cargar firmware ni modificar backend, frontend o la base actual.

## Dictamen

**El firmware está preparado para configurar el servidor definitivo y efectuar un ensayo físico autorizado. No está certificada todavía su estabilidad continua en producción.** La compilación con placeholders no verifica Wi-Fi, sensores, reloj real, certificado, consumo dinámico o entrega de lecturas reales.

El intervalo configurado sigue siendo **10.000 ms**. Representa la separación mínima programada entre intentos, evaluada en el reporte de sensores de un segundo, con una sola solicitud en curso. No garantiza exactamente una inserción cada diez segundos: DNS, handshake, latencia, red caída o un servidor lento pueden alargar el ciclo. No se recuperan muestras perdidas con datos inventados ni ráfagas de reintentos.

No hay un impedimento de diseño conocido para cargar una compilación configurada correctamente para la placa verificada. Antes de instalarla para operación se necesitan los valores privados y las pruebas físicas indicadas abajo. La recepción pública permanece cerrada hasta aceptar TLS y autenticación.

## Correcciones mínimas realizadas

Solo se modificó código de comunicación en `telemetria.h`:

1. **Sincronización entre tareas:** `volatile bool relojSincronizado` se sustituyó por `std::atomic<bool>`. La callback de SNTP escribe desde un contexto distinto de la tarea de comunicación; volatile no establece sincronización C++. Se usa carga/almacenamiento relaxed porque solo se comunica un indicador, no un bloque de datos. No agrega dependencias externas, asignación dinámica o tareas nuevas.
2. **Inicio de SNTP con red disponible:** `configTime` se inicia al observar `WL_CONNECTED`, no antes de empezar la conexión Wi-Fi. Si se pierde y recupera Wi-Fi antes de sincronizar, se reinicia ese intento de SNTP; después de sincronizar se conserva el ciclo periódico normal. Evita iniciar resolución/temporizadores de NTP sin conectividad y evita heredar su espera al recuperar red. No se añaden bucles de espera ni reintentos rápidos.

No se cambió `landsis_ladera1.ino`, `orientacion.h`, el JSON, los sensores HD-38/801S/MPU6050, pines, calibración, umbrales, tiempos de adquisición o criterios experimentales. No se aumentó pila, no se activaron resets automáticos y no se cambió la biblioteca de sensores sin evidencia física que lo justifique.

## Comunicación y fallos

| Fase | Comportamiento revisado | Límite de la verificación |
| --- | --- | --- |
| Wi-Fi | AutoReconnect del core y `WiFi.reconnect()` cada 10 s si no está conectado. La tarea sigue revisando estado sin esperar conexión en un while. Se conserva configuración de red. | Recuperación esperada al volver AP/red con las mismas credenciales; falta ensayo físico. Contraseña o SSID incorrectos requieren corregir configuración. |
| SNTP | Asíncrono, indicador atómico tras callback; sin sincronizar no se intenta HTTPS. El stack SNTP reintenta con sus temporizadores. Inicio/reinicio condicionado a conexión descrito arriba. | NTP permanentemente inaccesible impide envío por diseño, sin detener sensores. SNTP no autentica el tiempo: requiere fuente/red confiable. Recuperación puede esperar temporizadores; no se promete sincronización instantánea. |
| DNS | `NetworkClientSecure::connect(host, ...)` resuelve con `Network.hostByName`; el core usa `lwip_getaddrinfo`. Un fallo devuelto libera el intento y se publica resultado negativo. | El timeout HTTP de 2 s no es un timeout DNS. No se midió su duración real; depende del stack/red. No se encontró un bucle DNS propio sin salida en el firmware. |
| TCP | `HTTPClient::setConnectTimeout(2000)` pasa el límite al cliente seguro. | Es un límite de conexión, no de toda la transacción. |
| TLS | `WiFiClientSecure`, CA con `setCACert`, handshake configurado a 10 s. Core usa `MBEDTLS_SSL_VERIFY_REQUIRED`, nombre/SNI y resultado de verificación. | CA/nombre/fechas inválidos deben fallar; hace falta demostrarlo con el servidor y placa reales. No se usa setInsecure, conexión por IP para evadir nombre ni fallback HTTP. |
| HTTP | Lectura con timeout de 2 s, sin reutilización ni redirecciones. Solo 201 confirma; otros estados/errores conservan vibración y permiten otro intento. | Son timeouts de fase/inactividad. Una cabecera incompleta entregada continuamente puede prolongar `readStringUntil`/`handleHeaderResponse` sin un deadline total. No equivale a un cuelgue demostrado con el servidor definitivo, aún inexistente. |

Las fuentes del core permiten justificar recuperación en fallos normales devueltos por Wi-Fi/DNS/TLS/HTTP, pero **no permiten afirmar ausencia absoluta de esperas indefinidas ante cualquier respuesta de servidor**. `HTTPClient::handleHeaderResponse` renueva el tiempo de actividad al recibir cabeceras y `Stream::readStringUntil` espera por carácter. Un flujo de cabeceras que nunca termina es un caso residual comprobable en el código de biblioteca, no cubierto por un deadline global del firmware. También puede hacer crecer un String de cabecera. No se modificó el core ni se agregó un cliente HTTP propio para ese caso: requiere validar el servidor final y, si se exige tolerancia a respuestas arbitrarias, una tarea específica para límite total/tamaño y su ensayo. No usar eliminación forzada de la tarea de red: puede dejar recursos o bloqueos internos sin liberar.

Si una solicitud no termina, la adquisición continúa en su tarea, pero `envioEnCurso` impide iniciar otra: no se debe confundir continuidad de sensores con continuidad de transmisión. Un 401 persistente indica token/configuración; un fallo TLS persistente indica certificado/reloj/conectividad: reiniciar manualmente no soluciona esas causas. No desactivar TLS para recuperar envío.

## Recursos, liberación y confidencialidad

- Cliente seguro y HTTP son locales a cada intento. `http.end()` se ejecuta después de begin/POST y `setReuse(false)` evita conservar conexiones. En el core 3.3.12 el contexto SSL tiene un deleter que llama `stop_ssl_socket` al destruir el cliente, incluso si HTTP ya detectó desconexión. Los errores de connect también llaman stop. No se identificó una ruta de fuga demostrable en el firmware.
- La CA es un buffer estático de configuración; `setCACert` no la copia en cada llamada. La biblioteca sí parsea certificados y reserva memoria TLS por intento. Se libera contexto al salir del alcance. No cambiar a conexión persistente sin medir/revisar sus fallos.
- Buffers JSON fijos de 1.024 y 512 bytes; snprintf comprueba truncamiento. Colas de una lectura y un resultado, creadas una vez; una sola solicitud en vuelo. No hay una cola que crezca durante una caída.
- Tarea de comunicación con pila de **8.192 bytes**, además de heap TLS/Wi-Fi y pila del loop. No sumar simplemente RAM global y pila para deducir margen de TLS. String internos de HTTPClient y certificados pueden fragmentar heap; es un riesgo a medir, no una fuga confirmada.
- Medir durante el ensayo: heap libre/mínimo, mayor bloque libre, watermark de pila de comunicación y loop, watchdog/brownout y reinicios. El informe de compilación solo mide memoria estática. Para diagnosticar puede usarse un debugger o una compilación de instrumentación temporal autorizada; no se añadió telemetría nueva al JSON ni instrumentación permanente.
- El firmware no imprime URL, token, SSID o contraseña. Serial solo informa estado/código/duración y sensores. El token solo se añade al encabezado después de exigir `https://`, CA no vacía, reloj sincronizado y longitud configurada; el backend exige además su formato hexadecimal. Usar endpoint sin credenciales/query y compilar con **Core Debug Level: None**, evitando logs verbosos de bibliotecas o respuestas que reflejen credenciales.
- HTTPClient recibe un cliente seguro explícito; una URL `http://` se rechaza antes de iniciar solicitud. Redirecciones deshabilitadas: no se reenvía el encabezado a un destino diferente ni existe degradación a HTTP. DNS/SNI pueden revelar dominio, pero no transportan el token de aplicación.

## Adquisición y memoria de vibraciones

La tarea de red trabaja con una copia de lectura y no toca I²C, ADC o GPIO. El loop continúa leyendo el 801S, reportando humedad/MPU y procesando orientación mientras el otro task espera red. No se añadió espera de NTP/TLS dentro del loop. Comparten CPU/heap/Serial, por lo que falta medir impacto real del handshake.

`vibracionPendiente` y su generación están controladas por el loop; se transmiten por copia en la cola. Solo un 201 con la misma generación borra el pendiente. Un pulso observado después de preparar la copia cambia generación e impide borrarlo con una confirmación anterior. Wi-Fi/NTP/TLS/HTTP fallidos no lo borran. `vibracionDetectada` se reinicia para el reporte serial de un segundo, independientemente de la memoria de transmisión.

Se conserva presencia de vibración observada, no un registro de cada pulso ni su hora. La memoria es volátil: un reset/corte de alimentación la pierde. El sondeo existente cada ~2 ms y la lectura de humedad de 10 muestras con delay(2), además de I²C/Serial, ya tienen ventanas en las que pueden perderse pulsos cortos. No se cambió a interrupciones ni se inventa captura garantizada.

Si el MPU no se detecta al inicio, no se envía el bloque multisensor con ceros ficticios; el firmware omite el envío. Falta verificar el dispositivo físico. La Adafruit MPU6050 **2.2.9** instalada devuelve siempre true en `getEvent()` y su `_read()` no propaga el resultado de lectura I²C. Por ello la comprobación actual no demuestra detección de desconexión del sensor durante ejecución; `isfinite` tampoco demuestra origen real de una lectura. Es una limitación de integridad a ensayar con hardware, no un motivo para inventar lecturas o cambiar la biblioteca/pines en esta revisión. No se certifica continuidad de datos reales si falla el bus/sensor.

Se usa resta unsigned de millis para los intervalos; su desbordamiento no exige por sí solo reiniciar. Generación uint32 también puede envolver; no se promete contabilidad ilimitada de pulsos. No hay buffering offline de humedad/MPU ni garantía de entrega exactamente una vez: si la BD guarda pero la respuesta se pierde, el nodo conserva vibración y puede reportarla de nuevo.

## Configuración privada pendiente

En `secrets.example.h` se mantienen únicamente placeholders. No se generó ningún valor real:

| Campo de secrets.h | Valor requerido antes del ensayo |
| --- | --- |
| `WIFI_SSID` | Red 2,4 GHz disponible para el ESP32. Confirmar SSID real sin publicarlo. |
| `WIFI_PASSWORD` | Credencial privada de esa red. |
| `API_URL` | `https://DOMINIO_REAL/api/v1/readings`, sin usuario/contraseña/query/fragmento. Dominio coincidente con certificado. |
| `IOT_DEVICE_TOKEN` | 64 caracteres hexadecimales minúsculos, mismo token configurado privadamente en backend para LADERA-1. No generarlo ni imprimirlo en esta auditoría. |
| `API_ROOT_CA` | PEM de raíz verificada de la cadena final, actualmente vacío. Obtener de fuente oficial y verificar huella. No usar leaf renovable como raíz. |
| `NTP_SERVER` | Servidor accesible y confiable para la red del nodo; confirmar `pool.ntp.org` o sustituir por NTP local. |

También faltan DNS operativo, salida TCP 443 y NTP (habitualmente UDP 123), cadena completa servida por Nginx, vigencia/renovación de certificado y autorización del endpoint. No sustituirlos por TLS inseguro. La credencial real se configura en el archivo ignorado, no en el ejemplo; los binarios compilados con ella también son privados. No se inspeccionó si el secrets.h actual ya contiene estos campos.

## Verificaciones automáticas

No hay una suite de firmware ejecutable en host en el repositorio. Las pruebas web/backend no emulan TLS, SNTP o sensores ESP32. Se ejecutaron las suites existentes sin hardware, conservando fuentes y usando exclusivamente el clúster temporal aislado de las pruebas PostgreSQL, nunca la BD actual:

- Backend: **254 aprobadas, 0 fallidas, 0 omitidas**; npm test incluye compilación TypeScript. Confirma contrato/validaciones y autenticación esperados, no comportamiento físico.
- Frontend: **57 aprobadas, 0 fallidas, 0 omitidas**.
- Compilación del sketch corregido con placeholders: **correcta**, flash **1.068.076 bytes / 1.310.720 (81 %)**, RAM global **50.720 / 327.680 bytes (15 %)**; quedan 276.960 bytes según el informe de memoria estática, antes del uso dinámico. Variación frente a la compilación precedente: +12 bytes de flash, RAM global sin cambio.

Toolchain solicitado: Arduino CLI instalado, core ESP32 3.3.12, FQBN `esp32:esp32:esp32`; bibliotecas detectadas: Adafruit MPU6050 2.2.9, Unified Sensor 1.1.15 y BusIO 1.17.4. El FQBN coincide con verificaciones históricas; confirmar que corresponde al hardware antes de cargar. Se compila una copia temporal de los tres archivos del sketch y se copia **secrets.example.h**, no secrets.h, como configuración de esa copia. Nunca se ejecuta upload.

```powershell
# Ejecutado sobre copia con placeholders, usando core local instalado:
& 'C:/Program Files/Arduino IDE/resources/app/lib/backend/resources/arduino-cli.exe' compile --fqbn esp32:esp32:esp32 --jobs 2 --build-path build/tls-check tmp/tls-check/landsis_ladera1
```

El resultado previo a esta revisión era 1.068.064 bytes flash y 50.720 bytes RAM global; no debe confundirse con el resultado del sketch corregido. Ni uno ni otro mide consumo dinámico durante TLS.

## Aceptación física pendiente

Preparar un ensayo con datos reales y cuenta/base autorizadas, sin publicar secretos ni cambiar umbrales:

1. Inspeccionar cableado, alimentación y hardware HD-38, 801S, MPU6050. Confirmar detección MPU, unidades y lectura real. Obtener autorización expresa antes de cargar y conservar firmware/configuración anteriores para reversión privada.
2. Arranque en frío con NTP bloqueado: adquisición continúa, no hay POST. Habilitar NTP sin reset: sincroniza y empieza TLS. Repetir arranque sin AP y recuperar Wi-Fi; repetir pérdida/reconexión antes/después de sincronizar.
3. Certificado válido con nombre y CA correctos: 201 y fila real correspondiente en servidor. Confirmar cadencia en condiciones sanas y medir separación/latencia; no asumir exactitud de 10 s a partir de la constante.
4. CA incorrecta, dominio no coincidente y certificado vencido: rechazo TLS y ningún POST autenticado. Endpoint HTTP y redirección: ningún reenvío sin cifrar. Confirmar también renovación de certificado manteniendo confianza correcta.
5. DNS inaccesible/incorrecto, TCP rechazado, servidor silencioso, handshake que no progresa, HTTP 401/403/500/503: medir tiempo de retorno y recuperación al restaurar causa sin reset. Probar respuesta anómala de cabeceras continuas en ensayo controlado para caracterizar el límite residual antes de afirmar tolerancia a cualquier servidor.
6. Pulsos 801S durante cada fallo y durante POST: pendiente permanece hasta 201; pulso posterior a copia no se borra con ACK anterior. Verificar que no se afirma registro individual de pulsos ni conservación tras corte de energía.
7. Desconectar/reconectar MPU durante operación en ensayo seguro: confirmar qué entrega realmente la biblioteca; no aceptar lecturas plausibles como prueba de bus sano. Documentar resultado antes de afirmar continuidad de lecturas reales.
8. Ensayo continuo propuesto de **24–72 horas**, incluyendo caídas y recuperación: registrar cadencia, reinicios/watchdog/brownout, duración TLS, heap mínimo, mayor bloque libre y watermark de pila. Comparar ciclos repetidos tras calentamiento; sin descenso sostenido atribuible a fugas. La duración es una propuesta de aceptación, no un ensayo realizado ni una garantía de vida útil.
9. Revisar Serial y registros del servidor para ausencia de credenciales, verificar que no se habilitaron logs verbosos y mantener POST público cerrado hasta aprobar autenticación/TLS.

## Referencias y evidencia

Se revisaron las fuentes instaladas de `NetworkClientSecure.cpp`, `ssl_client.cpp`, `HTTPClient.cpp`, `NetworkManager.cpp`, `STA.cpp`, `Stream.cpp`, `esp32-hal-time.c`, opciones lwIP/SNTP y Adafruit_MPU6050.cpp. Esa inspección identifica rutas y límites, no sustituye medición en la placa.

- [Espressif: reloj y SNTP](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/system_time.html).
- [Espressif: medición y reducción de RAM](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/performance/ram-usage.html).
- Informe precedente: `docs/seguridad-despliegue-produccion.md`.
