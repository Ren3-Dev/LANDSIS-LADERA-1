# Validación física de orientación — 3 de noviembre de 2026

## Carga y alcance

ESP32 conectado por USB en COM3. Se usó la compilación verificada para `esp32:esp32:esp32`, core 3.3.12: 973756 bytes de flash y 50184 bytes de RAM global. Configuración local y cabeceras coinciden con las copias compiladas, excluidas las directivas `#line` agregadas por Arduino. Se conservaron nodeId LADERA-1, configuración de red y diez campos HTTP originales. No se modificaron fuentes, umbrales, sensores, backend, frontend ni base de datos durante esta carga.

El primer intento no entró en modo de programación (0x13) y no escribió flash. El segundo, con BOOT presionado por el usuario al conectar, escribió y verificó hashes correctamente; terminó con código 0 y reinicio por RTS. Se soltó BOOT y se observó ejecución de la nueva lógica por Serial a 115200, progreso CALIBRANDO y baseline 75/75. No se deduce ejecución únicamente del resultado de upload: la salida de orientación confirma el programa nuevo.

El usuario confirmó que la caja permaneció apoyada e inmóvil desde el reinicio. Esta posición es la referencia de prueba; si después se cambia su montaje, debe recalibrarse mediante reinicio ya instalado y reposo de al menos 80 s.

## A — Nodo inmóvil

Registro Serial local en `logs/orientacion-fisica-2026-11-03.log` (ignorado por Git), resumen en `logs/orientacion-etapa-A-2026-11-03.json`. Las marcas del log usan UTC; aquí se muestran horarios de Guatemala.

Ventana analizada: 09:53:13 a 09:56:13, 180 lecturas angulares durante 179,13 s. Baseline roll 0,6444° y baseline pitch -0,2411°, según precisión impresa. Son referencias de orientación del montaje, no calibración metrológica.

| Magnitud | Mínimo | Máximo | Media | Desviación estándar poblacional | Máximo absoluto |
| --- | ---: | ---: | ---: | ---: | ---: |
| Delta roll | -0,0438° | 0,0060° | -0,01381° | 0,01077° | 0,0438° |
| Delta pitch | -0,0373° | 0,0273° | -0,00571° | 0,01276° | 0,0373° |

Se encontraron 179 líneas de estado dentro de la ventana de las 180 líneas angulares, por la diferencia de milisegundos entre impresiones. Todas indicaron NORMAL; no se observó persistencia activada. El ruido de esta ventana quedó por debajo de 0,5° y no justifica cambiar automáticamente los umbrales. No demuestra estabilidad térmica prolongada ni exactitud absoluta.

## B — Inclinación pequeña sostenida

El usuario confirmó que inclinó ligeramente la caja y la mantuvo fija. Tras ajustes iniciales, el contador de precaución se reinició a las 09:57:44, antes de persistir. Posteriormente avanzó 1, 2, 3, 4, 5 y 6 a las 09:58:04, 09:58:14, 09:58:24, 09:58:34, 09:58:44 y 09:58:54, respectivamente. A las 09:58:54 apareció PRECAUCION con 6/0/0. La separación fue de aproximadamente 10 s entre incrementos, no a cada reporte de 1 s.

A las 09:59:05: delta roll -0,6969° y delta pitch -0,9294°, PRECAUCION 6/0/0. Se confirma respuesta a inclinación sostenida en el intervalo experimental pequeño. Los grados provienen del propio sensor; no se empleó patrón angular independiente y esto no certifica exactitud de magnitud física.

## C — Inclinación media sostenida

El usuario confirmó una inclinación mayor mantenida. El contador medio avanzó 1…6 desde 09:59:54 hasta 10:00:44 con separación aproximada de 10 s. A las 09:59:53 delta roll -1,7746°. A las 10:00:40 se observó 6/5/1, delta roll -2,0896°. La primera transición a ALERTA ocurrió a las 10:00:44 con 6/6/2. A las 10:00:52 el contador crítico volvió a cero; a las 10:01:05 se observó ALERTA 6/6/0, delta roll -1,8814° y delta pitch -0,3217°: persistencia del nivel medio confirmada. Un cruce breve sobre 2° no llegó a crítico y su contador volvió a cero al dejar de cumplirse ese umbral. La posición no se mantuvo estrictamente por debajo de 2° en todo el ensayo; se documenta ese cruce, sin presentarlo como una prueba de exactitud angular.

## Cierre de movimientos y pendientes

El usuario pidió detener las pruebas de movimiento después de C. Se cerró la captura Serial y se guardó el registro ya recibido; no se solicitó otro movimiento ni reinicio. El firmware nuevo quedó cargado. A, B y C tienen evidencia; la validación física completa aún no está terminada.

D >=2°; E movimiento breve; F retorno al baseline: pendientes de ejecución y registro. No se declaran aprobadas a partir de las pruebas anteriores.

El diagnóstico muestra intentos de reconexión Wi-Fi; todavía no se comprobó transmisión HTTP posterior a la carga. No se modificaron credenciales y no se inició el backend: se mantiene el orden solicitado de validar primero orientación. Riesgo global no implementado.

## Comprobación posterior de transmisión sin mover el nodo

Después del cierre de movimientos, el usuario autorizó comprobar transmisión aun quedando D–F pendientes. Se inició el backend existente con `npm run dev`. PostgreSQL ya estaba escuchando en 5432. `/health` respondió con `status: ok` tanto por 127.0.0.1:3000 como por la IP LAN actual 192.168.1.107:3000. No se modificó código de aplicación ni configuración.

La PC cambió de red/IP respecto a la revisión previa (192.168.0.181). La URL del nodo sigue apuntando a esa dirección anterior. Una comparación local sin revelar credenciales encontró que la conexión WLAN actual de la PC no coincide con el SSID configurado para el nodo, y ese SSID tampoco figuró en la consulta de redes visibles (una sola red identificada; no se interpreta como prueba de inexistencia o de ausencia en toda la zona).

Captura Serial de 35 s guardada en `logs/transmision-2026-11-03.log`: se observó `HTTP omitido: WiFi no disponible`, intentos periódicos de reconexión y estado 6; sin HTTP 201 en esa ventana. El cálculo de orientación continuó, baseline 75/75 y ALERTA 6/6/0 por la posición de prueba. No se movió ni reinició el nodo.

Consulta PostgreSQL de solo lectura a las 10:05:01 de Guatemala: último registro de LADERA-1 ID 1649, recibido a las 03:02:23 del mismo día. Los IDs 1647–1649 muestran cadencia histórica aproximada de 10 s, pero no prueban transmisión con la versión recién cargada. Se dejó pendiente aclarar con el usuario si la ubicación/red de prueba es temporal antes de proponer ajustes. No se cambiaron SSID, contraseña ni URL, ni se alteró la conectividad de Windows.

## Recuperación confirmada después de restablecer alimentación/red

El usuario informó que una batería se había descargado, que lo resolvió y que PC y ESP32 estaban otra vez en el mismo Wi-Fi. No se atribuye exclusivamente a la batería la causa de los fallos previos. Se repitieron comprobaciones sin mover ni ordenar reinicio del nodo: la PC volvió a 192.168.0.181 y `/health` respondió correctamente.

PostgreSQL confirmó diez registros nuevos de LADERA-1, IDs 1650–1659, recibidos entre las 10:25:41,949 y 10:27:11,521 de Guatemala. Sus nueve intervalos fueron 9,399; 11,369; 8,598; 10,102; 9,898; 10,220; 9,872; 10,404 y 9,710 s: cadencia aproximada de 10 s. Los siete campos MPU están presentes en todas esas filas; soil_moisture_raw sigue siendo crudo (4095 en esta muestra), no porcentaje. Las consultas fueron de solo lectura y no se enviaron datos de prueba desde la PC.

En nueva captura COM3/115200, anexada al log de transmisión, se observaron cuatro `HTTP: 201 accepted` con duraciones 256, 80, 331 y 155 ms. La orientación continuó independientemente de los envíos. Primero se vio CALIBRANDO 44/75 y después NORMAL 75/75, con persistencia 0/0/0: evidencia de un nuevo ciclo de calibración tras la interrupción de alimentación, sin recargar firmware. Baseline nuevo: roll -0,4761°, pitch -0,0773°. A las 10:26:52 se observaron delta roll 0,0001° y delta pitch 0,0009°. Esta observación tras recalibrar no sustituye la prueba F de retorno al baseline original.

La transmisión queda confirmada para esta ventana con el firmware nuevo; no demuestra estabilidad prolongada ni resuelve D–F. El backend se dejó ejecutando y la captura Serial terminó, liberando COM3. No se modificaron configuración, umbrales ni código, y no se implementó riesgo global. Al reinstalar en posición definitiva se requiere nuevo baseline inmóvil de al menos 80 s después del reinicio.
