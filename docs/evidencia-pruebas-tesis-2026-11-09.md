## 5.9.3 Diseño de Pruebas

Se examinaron las entradas, salidas y estados observables del prototipo LANDSIS: LADERA-1. Los casos cubrieron datos válidos, ausentes o inválidos, así como fallos simulados. Las pruebas unitarias y de componentes emplearon datos sintéticos. La integración HTTP y con PostgreSQL real se trató como evidencia histórica cuando existía un registro. Los identificadores siguientes se asignaron para este informe.

| ID | Componente | Objetivo | Tipo | Resultado | Evidencia |
| --- | --- | --- | --- | --- | --- |
| CP-01 | Credenciales y sesiones | Comprobar scrypt, política, expiración y revocación | Unitaria | Ejecutada el 09/11, aprobada | [Backend filtrado](evidencias-pruebas-tesis-2026-11-09/backend-casos-sin-red.txt) |
| CP-02 | API de usuarios y lecturas | Verificar sesión y permisos por rol | Integración HTTP | Histórica, aprobada en la regresión documentada | [Corrección 006](correccion-login-migracion-006.md), `backend/tests/auth.test.cjs` |
| CP-03 | Recepción IoT | Verificar token de dispositivo, asociación con el nodo y contrato de recepción | Integración HTTP | Histórica, aprobada en la regresión del 05/11 | [Verificación de firmware](verificacion-final-firmware-produccion.md), `backend/tests/device-auth.test.cjs` |
| CP-04 | API de orientación | Validar estados y estructura, y separar la última orientación por nodo y lectura | Unitaria | Ejecutada el 09/11, aprobada | [Backend filtrado](evidencias-pruebas-tesis-2026-11-09/backend-casos-sin-red.txt), `orientation.test.cjs` |
| CP-05 | Persistencia de usuarios y lecturas | Comprobar consultas parametrizadas, transacciones y reversión simulada | Componente con doble SQL | Ejecutada el 09/11, aprobada | [Backend completo sin red](evidencias-pruebas-tesis-2026-11-09/backend-suites-sin-red.txt) y [backend filtrado](evidencias-pruebas-tesis-2026-11-09/backend-casos-sin-red.txt) |
| CP-06 | Recuperación de cuenta | Verificar hash de tokens, consumo, controles de configuración y límites | Unitaria y componente | Ejecutada el 09/11, aprobada en los casos seleccionados | Ambas salidas de backend |
| CP-07 | Avisos de inclinación y correo | Verificar disparador, destinatarios, fallos aislados, plantillas y diagnóstico SMTP | Componente con dobles | Ejecutada el 09/11, aprobada | [Backend completo sin red](evidencias-pruebas-tesis-2026-11-09/backend-suites-sin-red.txt) |
| CP-08 | Dashboard | Comprobar autenticación, recuperación, telemetría, actualización y estados visuales | Componente y cliente API simulado | Ejecutada el 09/11, aprobada | [Frontend](evidencias-pruebas-tesis-2026-11-09/frontend.txt) |
| CP-09 | ESP32 y API | Observar respuesta a movimientos y transmisión local | Caja negra física | Histórica, parcial | [Validación física](../firmware/landsis_ladera1/VALIDACION_FISICA_2026-11-03.md) y [calibración](../firmware/landsis_ladera1/CALIBRACION_GRADOS_2026-11-03.md) |
| CP-10 | PostgreSQL | Cotejar esquema y contenido restaurado | Integridad y restauración | Histórica, satisfactoria en clúster temporal | [Estado de migración](estado-migracion-postgresql.md) |
| CP-11 | Gmail | Confirmar recepción y presentación de mensajes de prueba | Funcional manual | Histórica, satisfactoria en dos envíos controlados | [Prueba de correo](prueba-correo-controlada-2026-11-03.md) |
| CP-12 | Nodo, aplicación y avisos | Correlacionar telemetría, persistencia, dashboard y aviso automático ante evento físico | Extremo a extremo | Pendiente | [Aceptación física](verificacion-final-firmware-produccion.md) y [avisos de inclinación](avisos-inclinacion-2026-11-03.md) |

## 5.9.4 Implementación de las Pruebas

El 9 de noviembre de 2026 se inspeccionaron las dependencias de las pruebas y se seleccionaron archivos completos o casos individuales ejecutables sin conexiones de red. Se excluyeron las pruebas HTTP con sockets, incluso los servidores temporales de loopback, y la suite que inicializa un clúster PostgreSQL. Se utilizaron dobles de persistencia y de correo, transporte MIME en memoria y solicitudes `fetch` simuladas. El código del backend se compiló a un directorio temporal nuevo y se ejecutaron copias intactas de los archivos de prueba seleccionados. Se conservó la salida del compilador y de los runners.

## 5.9.5 Entorno y Configuración de las Pruebas

La ejecución local utilizó Windows x64, Node.js 24.21.0, npm 11.19.0, TypeScript 7.0.2 para compilar el backend y el cargador `tsx` instalado para el frontend. La referencia de Git fue `9e478d970a25bde905892ae9f51b751a72d81372`. El expediente de migración ya estaba presente como archivo local sin seguimiento en Git. Los procesos se iniciaron con `NODE_ENV=test`, zona `America/Guatemala`, cachés de transformación y compilación deshabilitadas y las variables de conexión, correo, dispositivo y configuración sensible retiradas del entorno heredado. La resolución de dependencias CommonJS de las copias del backend se realizó con `NODE_PATH` apuntando a `backend/node_modules`. Se usaron las dependencias ya instaladas.

Los encabezados de las salidas registran el comando exacto, directorio, fecha y código de salida. Para reproducir el backend, se crea un directorio temporal con `tests/` y se copian los archivos nombrados por ambos comandos y su auxiliar `authenticated-app.cjs`. Se compila desde la raíz con el `tsconfig.json` existente y se indica como `--outDir` el subdirectorio `dist/` de esa copia. Se ejecutan allí los dos comandos Node. El frontend se ejecuta desde `frontend/`. [Compilación](evidencias-pruebas-tesis-2026-11-09/compilacion-backend.txt), [backend completo sin red](evidencias-pruebas-tesis-2026-11-09/backend-suites-sin-red.txt), [backend filtrado](evidencias-pruebas-tesis-2026-11-09/backend-casos-sin-red.txt), [frontend](evidencias-pruebas-tesis-2026-11-09/frontend.txt).

## 5.9.6 Detalle de Hardware para Pruebas de Caja Negra

El prototipo documentado emplea un ESP32-WROOM-32, sensor de humedad HD-38 mediante ADC, detector de vibración 801S con salida digital y MPU6050 mediante I²C. La evidencia del 3 de noviembre corresponde a una conexión USB en COM3 y a lecturas Serial a 115200 baudios. El registro confirma respuesta del MPU6050 en ese montaje. Para la transmisión local se utilizó una red Wi-Fi compartida por el nodo y la computadora. El teléfono empleado como referencia auxiliar en el ensayo angular tuvo cambios de posición. [Auditoría técnica](auditoria-tecnica-final-2026-11-02.md), [validación física](../firmware/landsis_ladera1/VALIDACION_FISICA_2026-11-03.md), [calibración](../firmware/landsis_ladera1/CALIBRACION_GRADOS_2026-11-03.md).

## 5.9.7 Detalle de Software para Pruebas de Caja Negra

El sistema documentado comprende una API Node.js con TypeScript y Express, una interfaz React y persistencia PostgreSQL. La verificación histórica de firmware utilizó Arduino CLI, core ESP32 3.3.12 y FQBN `esp32:esp32:esp32`. La compilación histórica con valores de ejemplo acreditó la construcción del sketch. Las comprobaciones de la interfaz de esta sesión se realizaron mediante renderizado estático, respuestas simuladas y temporizadores controlados. Las comprobaciones previas de la API utilizaron instancias temporales de Express o el entorno local consignado en cada registro. [Verificación del firmware](verificacion-final-firmware-produccion.md), [auditoría técnica](auditoria-tecnica-final-2026-11-02.md).

## 5.9.8 Pruebas Unitarias

Se probaron el hash scrypt, el manejo de sesiones, la estructura y caché de orientación, el análisis de fechas, la configuración de recuperación y correo, el limitador y la cola, las plantillas y la regla experimental del aviso. También se comprobó que el diagnóstico SMTP filtre detalles sensibles utilizando respuestas y errores sintéticos. [Backend completo sin red](evidencias-pruebas-tesis-2026-11-09/backend-suites-sin-red.txt), [backend filtrado](evidencias-pruebas-tesis-2026-11-09/backend-casos-sin-red.txt).

## 5.9.9 Pruebas de Integración

Las pruebas existentes de HTTP cubren autenticación, roles, token de dispositivo, recepción y consulta de lecturas, orientación, historial diario, catálogo de nodos y recuperación de cuentas. Se ubican en `backend/tests/` bajo `auth`, `device-auth`, `readings`, `orientation`, `daily-readings`, `nodes` y `recovery-api` con sufijo `.test.cjs`. La regresión histórica del 5 de noviembre también documenta la ejecución de `password-recovery-postgres.test.cjs`, que usa un clúster real temporal para verificar migración, concurrencia y autenticación. El 9 de noviembre solo se ejecutaron interacciones entre componentes con dobles, como el controlador de recepción con guardado y observador de avisos simulados. [Auditoría](auditoria-tecnica-final-2026-11-02.md), [verificación del 05/11](verificacion-final-firmware-produccion.md).

## 5.9.10 Prueba de Funcionalidad

| Prueba física documentada, 03/11/2026 | Resultado histórico observado | Evidencia y límite |
| --- | --- | --- |
| A. Nodo inmóvil | 180 lecturas angulares y 179 registros de estado NORMAL. Máximos absolutos de 0,0438° en roll y 0,0373° en pitch | [Validación física](../firmware/landsis_ladera1/VALIDACION_FISICA_2026-11-03.md). Ventana de 179,13 s |
| B. Inclinación pequeña sostenida | PRECAUCION con contadores 6/0/0 | [Validación física](../firmware/landsis_ladera1/VALIDACION_FISICA_2026-11-03.md). Ángulos del sensor |
| C. Inclinación media sostenida | ALERTA y posterior registro 6/6/0. Hubo un cruce breve del umbral crítico | [Validación física](../firmware/landsis_ladera1/VALIDACION_FISICA_2026-11-03.md). Maniobra sin patrón externo |
| D. Inclinación grande posterior | CRITICO 6/6/6 sostenido en 20 lecturas | [Calibración](../firmware/landsis_ladera1/CALIBRACION_GRADOS_2026-11-03.md). Frontera externa exacta de 2° pendiente |
| E–F. Perturbación y retorno | Retorno aproximado a NORMAL 0/0/0 tras la inclinación grande. Una perturbación posterior y la recuperación repetida del baseline anterior quedaron no concluyentes. El cierre adoptó una referencia nueva | [Calibración](../firmware/landsis_ladera1/CALIBRACION_GRADOS_2026-11-03.md). Repetibilidad sin verificar |
| Transmisión local | Inicialmente sin Wi-Fi ni HTTP 201. Tras restablecer alimentación y red, el registro Serial mostró cuatro respuestas HTTP 201 y se documentaron diez filas nuevas, IDs 1650–1659, con los siete campos MPU | [Validación física](../firmware/landsis_ladera1/VALIDACION_FISICA_2026-11-03.md). Ventana local acotada |

El 3 de noviembre se documentaron dos envíos manuales de prueba a cuentas autorizadas. Se confirmó la recepción de ambos y se conserva una captura de la segunda cuenta. En las pruebas automatizadas del avisador se comprobó la lógica con correo simulado. La entrega automática ante un evento físico en producción queda pendiente. [Prueba de correo](prueba-correo-controlada-2026-11-03.md), [avisos de inclinación](avisos-inclinacion-2026-11-03.md).

## 5.9.11 Registro de Resultados de las Pruebas

| Fecha y carácter | Backend aprobadas / fallidas | Frontend aprobadas / fallidas | Alcance y evidencia |
| --- | ---: | ---: | --- |
| 09/11/2026, ejecutada | **48 / 0** | **58 / 0** | 35 de seis archivos completos y 13 de seis archivos filtrados. Frontend, 11 archivos. Compilación y runners con salida 0 entre las 04:25 y 04:26 de Guatemala. [Compilación](evidencias-pruebas-tesis-2026-11-09/compilacion-backend.txt), [35 casos](evidencias-pruebas-tesis-2026-11-09/backend-suites-sin-red.txt), [13 casos](evidencias-pruebas-tesis-2026-11-09/backend-casos-sin-red.txt), [58 casos](evidencias-pruebas-tesis-2026-11-09/frontend.txt) |
| 05/11/2026, histórica | 254 / 0 | 57 / 0 | Incluyó PostgreSQL temporal. [Verificación de firmware](verificacion-final-firmware-produccion.md) |
| 03/11/2026, histórica | 252 / 0 | Sin repetición | Incluyó seis pruebas de avisos. [Avisos de inclinación](avisos-inclinacion-2026-11-03.md) |
| 02/11/2026, histórica | 228 / 0 | 29 / 0 | Resultado final reportado. Backend excluyó PostgreSQL temporal y se repitió tras un problema de loopback. [Auditoría](auditoria-tecnica-final-2026-11-02.md) |
| 16/10/2026, histórica | 191 / 0 | 12 / 0 | Resultado final reportado, tras reejecución del backend. [Informe RUP](rup/pruebas/informe-pruebas-automatizadas-2026-10-16.md) |

Los conteos actuales corresponden a los resultados emitidos por Node.js, incluidas las subpruebas. El filtro de nombres excluyó los casos HTTP antes de su ejecución. Cada registro conserva su propio alcance. Se carece de una medición instrumental de cobertura.

Para los anexos se dispone de las salidas de consola originales y de la [captura real de Gmail](rup/pruebas/evidencias/gmail-segunda-cuenta-2026-11-03.png), previa revisión de datos personales visibles. El [registro Serial de orientación](../logs/orientacion-fisica-2026-11-03.log) y el [registro de transmisión](../logs/transmision-2026-11-03.log) permiten anexar extractos con sus marcas de tiempo. Si se requieren figuras, pueden obtenerse capturas de las salidas conservadas e identificarse como visualizaciones del registro. No se generaron capturas nuevas.

## 5.9.12 Pruebas de Integridad a los Datos y a la Base de Datos

Los dobles de PostgreSQL permitieron comprobar consultas parametrizadas, orden y filtros de lecturas, confirmación y reversión transaccional, y liberación de conexiones en los casos seleccionados. La integridad en el motor se respalda por separado con los registros históricos. La aplicación controlada de la migración 005 documentó restricciones e índices válidos y conservación de las filas previas. El expediente del 6 de noviembre reportó las estructuras 001–007 y un ensayo de restauración del respaldo final en un clúster PostgreSQL 17.11 independiente. Según el cotejo, coincidieron esquema, filas y tres secuencias. Los conteos fueron 2.433 lecturas, un nodo, tres roles, cinco usuarios, un token de restablecimiento y una fila de estado de avisos. Son datos de la instantánea histórica. El 9 de noviembre se trabajó exclusivamente con dobles. [Aplicación 005](aplicacion-controlada-migracion-005.md), [corrección 006](correccion-login-migracion-006.md), [estado de migración](estado-migracion-postgresql.md).

## 5.9.13 Pruebas de Componentes

El script `test` de `backend/package.json` compila a `backend/dist` y lanza todos los archivos `tests/*.test.cjs`. En esta sesión se sustituyó su invocación por una compilación con destino temporal y dos llamadas selectivas al runner. Se ejecutaron completos `check-smtp`, `inclination-alert`, `mail`, `password-recovery`, `reset-password` y `users-store`. Se filtraron `auth`, `daily-readings`, `nodes`, `orientation`, `readings` y `recovery-api`. Se excluyeron por completo `device-auth` y `password-recovery-postgres`.

El script `test` de `frontend/package.json` ejecuta `tests/*.test.tsx` con Node.js y `tsx`. Se ejecutaron los 11 archivos existentes. Cubren autenticación y recuperación, historial y lecturas diarias, recepción y actualización de datos, orientación, referencia de inclinación, aviso del nodo, humedad, panel de estados y vistas del nodo único.

| Limitación | Estado | Verificación pendiente |
| --- | --- | --- |
| HTTP y permisos de servidor en la revisión actual | Casos con loopback excluidos | Regresión aislada de rutas, roles y credenciales IoT |
| PostgreSQL real en la revisión actual | Suite excluida. Ensayo de restauración histórico disponible | Integración y concurrencia sobre un clúster de pruebas autorizado |
| Interfaz en navegador con API real | Renderizado estático y cliente simulado en esta sesión | Recorrido autenticado y correlación de una lectura real |
| Firmware en el entorno definitivo | Ensayo físico local histórico y compilación con valores de ejemplo | TLS, recuperación de conectividad, estabilidad y consumo dinámico con la placa |
| Exactitud angular, humedad y detección física | Respuesta del MPU observada. Repetibilidad, tasa de falsos positivos y tabla angular controlada incompletas | Montaje rígido y referencias conocidas, calibración de humedad y ensayo del detector de vibración |
| Aviso automático en producción | Transporte simulado y dos envíos manuales históricos | Correlación autorizada de evento físico, persistencia y recepción del aviso |
| Interpretación del riesgo | Umbrales de inclinación experimentales | Validación metrológica y, para cualquier conclusión geotécnica o predictiva, evaluación específica independiente |
