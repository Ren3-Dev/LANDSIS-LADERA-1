# Auditoría técnica final — LANDSIS: LADERA-1

Fecha: 2 de noviembre de 2026, America/Guatemala. Alcance: inspección del árbol de trabajo actual, documentación, compilación y pruebas seguras. No se modificaron código fuente, configuraciones, migraciones ni datos de aplicación. Los builds regeneraron artefactos ignorados en `dist/`. Se generaron este informe y el log de pruebas adjunto. No se enviaron correos ni se intervino el hardware.

## 1. Resumen ejecutivo

El proyecto implementa un prototipo de adquisición y consulta de telemetría con autenticación humana y PostgreSQL. **No implementa todavía evaluación de riesgo ni alertas de emergencia.** El semáforo es una base visual que indica «Pendiente de configuración» (`frontend/src/components/RiskPanel.tsx`). No hay calibración definitiva de humedad, cálculo de inclinación ni validación geotécnica.

Existe evidencia documental histórica de transmisión física multisensor y recuperación de comunicaciones, descrita en `firmware/landsis_ladera1/README.md`. No se reprodujo físicamente en esta auditoría y no acredita el firmware actualmente cargado ni el montaje definitivo. El MPU6050 está integrado en el código y aparece en la evidencia histórica; su funcionamiento físico actual requiere confirmación.

Resultados actuales: backend compila y aprueba **228/228 pruebas ejecutadas**; frontend aprueba **29/29** y compila. Se excluyó expresamente la suite PostgreSQL que crea y modifica un clúster temporal. PostgreSQL local 17.11 se inspeccionó mediante una transacción `READ ONLY`: cinco tablas de aplicación, 1.261 mediciones y estructura compatible con las migraciones 001–006. No se verificó despliegue de producción.

La auditoría corresponde a un árbol con numerosos cambios previos modificados y sin seguimiento; HEAD es `cfabf5256274b928b8d6836eaad5eb191b71fd7d`. Ese commit por sí solo **no reproduce** el estado auditado. No se revirtieron cambios existentes ni se hicieron commits.

## 2. Arquitectura e inventario implementado

### Componentes y versiones

| Componente | Implementación y estado | Evidencia |
|---|---|---|
| Hardware | ESP32-WROOM-32 documentado; HD-38 mediante ADC, 801S digital y MPU6050 I²C en el sketch; montaje actual no inspeccionado | `firmware/landsis_ladera1/README.md`, `landsis_ladera1.ino` |
| Firmware | Arduino C++, Wire, Adafruit MPU6050/Unified Sensor; WiFi, HTTPClient y FreeRTOS del core | `firmware/landsis_ladera1/landsis_ladera1.ino`, `telemetria.h` |
| Toolchain firmware | Core ESP32 3.3.12 y placa `esp32:esp32:esp32` en compilaciones históricas; bibliotecas Adafruit sin versiones fijadas en repositorio | `firmware/landsis_ladera1/README.md` |
| Runtime local | Node.js 24.21.0, npm 11.19.0 observados en esta ejecución | `node --version`, `npm.cmd --version` |
| Backend instalado | Express 5.2.1, TypeScript 7.0.2, pg 8.23.1, dotenv 18.0.5, Nodemailer 10.1.2, tsx 4.23.15 | `backend/package.json`, `npm.cmd ls --depth=0` |
| Frontend instalado | React/React DOM 19.3.0, TypeScript 5.9.3, Vite 7.3.6; CSS y gráfica SVG propios | `frontend/package.json`, `npm.cmd ls --depth=0`, `MoistureChart.tsx` |
| Base local | PostgreSQL 17.11, comprobado por `SHOW server_version` | Inspección SQL de solo lectura de esta auditoría |

Las versiones instaladas no deben confundirse con los rangos declarados: React declara `^19.2.0` y Vite `^7.1.0`. Los lockfiles permiten resolver las versiones concretas. No se instalaron dependencias.

Estructura: `firmware/` conserva el sketch serial original y el sketch HTTP separado; `backend/src/` separa rutas, controladores de lecturas, validación, persistencia, autenticación, configuración y correo; `frontend/src/` separa cliente API, tipos, componentes y presentación; `database/` contiene seis scripts SQL; `docs/` contiene guías técnicas y documentos RUP; ambas aplicaciones tienen `tests/`.

### Flujo real de datos

1. `leerHumedadPromedio()` promedia ADC; el loop retiene eventos digitales de vibración y lee eventos Adafruit.
2. Cada intervalo de envío se copia una lectura a una cola FreeRTOS. `tareaComunicacion()` forma JSON camelCase y hace POST HTTP por WiFi. El JSON serial snake_case es diagnóstico y no es el contrato HTTP.
3. `createReadingsRouter()` recibe JSON y `isReading()` valida estructura, ADC y bloque MPU antes de persistir.
4. `insertReading()` registra el nodo e inserta su medición en una transacción PostgreSQL. Solo después del commit se responde 201. `received_at` es hora de recepción del servidor, no hora de adquisición del nodo.
5. El dashboard autenticado consulta catálogo, última lectura o historial. `frontend/src/api/telemetry.ts` valida la respuesta. La actualización es manual; no hay streaming ni polling automático.

Evidencia: `backend/src/app.ts`, `routes/readings.ts`, `controllers/readings.ts`, `readings/reading.ts`, `data/readings.ts`; `frontend/src/App.tsx`, `api/telemetry.ts`.

### Endpoints y permisos

| Método y ruta | Acceso y función |
|---|---|
| `GET /health` | Público; estado del proceso, no comprueba PostgreSQL ni sensores |
| `POST /api/v1/readings` | Público, sin identidad autenticada del dispositivo; valida y almacena telemetría |
| `GET /api/v1/readings` | Usuario activo; filtros `nodeId`, `from`, `to`, `limit` |
| `GET /api/v1/readings/latest` | Usuario activo; `nodeId` opcional |
| `GET /api/v1/nodes` | Usuario activo; catálogo |
| `POST /api/v1/auth/login` | Público; credenciales y límite de intentos; crea cookie |
| `GET /api/v1/auth/me` | Sesión activa |
| `POST /api/v1/auth/logout` | Revoca la cookie presentada; no exige previamente sesión válida |
| `POST /api/v1/auth/forgot-password` | Público, limitado; respuesta genérica 202; envío condicionado a configuración |
| `POST /api/v1/auth/reset-password` | Público, limitado; consume token y cambia contraseña |
| `GET, POST /api/v1/users` | ADMINISTRADOR; lista y crea |
| `PATCH, DELETE /api/v1/users/:id` | ADMINISTRADOR; modifica nombre/rol/estado o elimina lógicamente con restricciones |

Evidencia: `backend/src/app.ts`, `auth/security.ts`, `routes/password-recovery.ts`, `routes/nodes.ts`, `routes/readings.ts`.

Las mutaciones humanas exigen JSON y `X-Landsis-Request: 1`. Las sesiones son opacas, duran ocho horas y se almacenan como hashes en memoria del proceso; cookie HttpOnly, SameSite Strict y Secure en producción. Reiniciar el proceso pierde las sesiones; varias instancias no comparten sesiones ni límites. Las contraseñas usan scrypt con sal aleatoria y comparación segura. `credential_version` revoca sesiones tras restablecimiento. El rol CONRED permite consulta; no acredita autorización institucional para recibir alertas. Evidencia: `auth/security.ts`, `sessions.ts`, `password.ts`, `data/users.ts`.

### Servicios y despliegue

Se requieren alimentación y WiFi para ESP32, conectividad LAN hacia API, Node.js y PostgreSQL. SMTP es opcional para recuperación y requiere configuración privada y proveedor externo. No se inspeccionaron valores de secretos para el informe.

Local: backend en puerto configurable, frontend Vite con proxy `/api`; `LANDSIS_HOST` puede limitar la interfaz de escucha. Producción: el frontend estático necesita servidor y proxy del mismo origen; Express no entrega por sí mismo ese build. `NODE_ENV=production` exige HTTPS para que la cookie Secure funcione; recuperación exige URL HTTPS salvo localhost en desarrollo. No se encontró configuración de despliegue automatizado o infraestructura productiva en los archivos inspeccionados. No se comprobó dominio, servicio permanente, TLS, backups operativos ni monitoreo de producción. Evidencia: `backend/src/server.ts`, `frontend/vite.config.ts`, `frontend/README.md`, `backend/src/config/recovery.ts`.

## 3. Firmware, comunicaciones y pendientes físicos

| Aspecto | Hallazgo verificable |
|---|---|
| HD-38 | `PIN_HUMEDAD=34` en código; diez muestras ADC con `delay(2)`, promedio entero; transmite RAW. No calcula porcentaje ni detecta de forma específica desconexión/cortocircuito. Un RAW dentro de rango no prueba salud del sensor. |
| 801S | `PIN_VIBRACION=27`, activo HIGH en código; polling con pausa de 2 ms y ventanas ocupadas de promedio/lectura. Puede perder pulsos cortos. No mide frecuencia ni intensidad. |
| MPU6050 | SDA 21/SCL 22, I²C 100 kHz; búsqueda 0x68/0x69; rangos 8 g y 500 grados/s, filtro 21 Hz. Son ajustes existentes, no calibración ni parámetros nuevos propuestos. |
| Unidades | Aceleración m/s², giro rad/s y temperatura MPU en °C; no son inclinación, desplazamiento ni temperatura del suelo. |
| Intervalos | Adquisición/reporte aproximadamente cada segundo; transmisión nominal cada **10.000 ms** en `telemetria.h`. El tiempo real puede aumentar por lectura, envío en curso y red. |
| Reconexión | Auto-reconexión WiFi y solicitud periódica cada 10 s; timeouts de conexión y lectura de 2 s por fase; comunicación en tarea separada. |
| Reintentos | El siguiente ciclo toma una muestra nueva. No retransmite persistentemente cada muestra perdida, no hay backlog ni almacenamiento offline. |
| Vibración retenida | Se conserva hasta un 201; contador evita borrar eventos posteriores a la copia enviada. Se pierde al reiniciar; un booleano no conserva cantidad ni hora de los eventos. |
| Identidad | JSON fija `nodeId: LADERA-1`; carece de credencial de dispositivo, número de secuencia y hora de adquisición. |
| Fallos MPU | Sin MPU al arrancar o con valores no finitos se omite **todo** HTTP, incluso humedad/vibración aunque la API acepte payload sin MPU. No hay reinicialización periódica; no se comprueba el resultado de `getEvent()` ni se diagnostica desconexión sobrevenida de forma suficiente. |

Evidencia: `firmware/landsis_ladera1/landsis_ladera1.ino`: `setup`, `loop`, `iniciarMPU`, `leerHumedadPromedio`; `telemetria.h`: `tareaComunicacion`, `iniciarComunicacion`.

La guía del firmware todavía describe transmisión cada 5 s; prevalece el código de 10 s. La versión realmente cargada no se verificó. Las dependencias físicas pendientes de comprobar incluyen alimentación estable, encapsulado, fijación/orientación del MPU, cableado real, contacto del HD-38 con el medio, sensibilidad del 801S y cobertura WiFi del sitio. No hay diagnóstico de batería/RSSI/uptime ni evidencia actual de autonomía, protección ambiental o estabilidad prolongada. Core y bibliotecas deben registrarse para reproducir la instalación; no se propone cambiar pines ni calibraciones durante la auditoría.

## 4. Umbrales y niveles de riesgo — prioridad principal

**Existente:** ADC bruto, vibración booleana, siete campos MPU y semáforo inactivo. **Pendiente:** evaluación de Normal/Precaución/Rojo, configuración de criterios, cálculo de inclinación, histéresis, persistencia temporal, historial de alertas y política ante datos atrasados. No hay umbrales de riesgo fijos ni configurables en el código auditado. El rango ADC 0–4095 valida entrada; no es un umbral de riesgo.

Datos inválidos: la API rechaza sin guardar; bloques MPU parciales se rechazan y el bloque ausente se almacena NULL. Pérdida de enlace: no llegan muestras y no hay evaluador de desconexión. El frontend conserva la semántica de última recepción y explícitamente informa que no se definió un intervalo de atraso (`TelemetryViews.tsx`). No asigna Normal por falta de datos. No existen mecanismos de falsas alarmas de riesgo; promedio ADC y memoria de vibración no sustituyen esa lógica.

### Propuesta sin implementación ni valores científicos

1. Definir y aprobar una matriz experimental: variables, unidades, orientación/referencia del MPU, calibración de humedad, criterio de vibración, combinación de variables y transiciones Normal/Precaución/Rojo. Si faltan datos o configuración, usar estado técnico «No evaluable», separado de los tres niveles.
2. Implementar un evaluador pequeño en backend, comprobable como función, ejecutado sobre lecturas válidas persistidas. Conservar datos originales. Parametrizar criterios por nodo y versionar cambios con autor/fecha; administración restringida. No añadir un framework.
3. Definir persistencia de condición, histéresis y reglas de recuperación para evitar oscilaciones; sus valores requieren ensayo y aprobación. No interpretar una única vibración como deslizamiento ni el MPU como inclinación sin referencia y método acordados.
4. Registrar eventos de cambio de nivel, medición de origen, motivos y versión de configuración; exponer estado e historial por API. Evitar que actualizar la pantalla recalcule o dispare alertas.
5. Definir antigüedad máxima y disponibilidad por sensor como condiciones técnicas. No convertir ausencia, invalidez o desconexión en nivel Normal. Determinar si un modo degradado es admisible y cómo se informa.
6. Probar límites exactos, persistencia, histéresis, configuración incompleta, ceros/NULL, atraso, reinicios y eventos repetidos con datos sintéticos antes del nodo físico.

Son propuestas pendientes de revisión; no existen las tablas ni rutas descritas en ellas. La clasificación será experimental hasta contar con evidencia y validación especializada externa.

## 5. Correo de emergencia

### Infraestructura reutilizable y carencias

`backend/src/config/mail.ts` valida configuración, destinatario simple, TLS/STARTTLS, certificados y tiempos de espera. `mail/service.ts` ofrece `send()` inyectable, sanitiza errores y revisa rechazos reportados por el transporte. `mail/templates.ts` demuestra texto/HTML con escape. Puede reutilizarse sin duplicar SMTP.

El único flujo automático de envío encontrado es recuperación (`routes/password-recovery.ts`, activación en `server.ts`). La función/plantilla de contraseña modificada existe, pero no se encontró integrada al reset. No hay plantilla de emergencia, destinatarios suscritos/autorizados para alertas, disparador desde mediciones, historial de envíos, deduplicación o reintento durable.

`RecoveryQueue` limita a 20 trabajos y dos simultáneos, reside en memoria, puede descartar cuando está llena y no reintenta. Es útil como referencia de límites; no ofrece trazabilidad durable de emergencias. La respuesta 202 de recuperación no certifica envío ni entrega. `docs/configuracion-gmail-incremento-6.md` registra preparación anterior con envíos deshabilitados y configuración pendiente: no demuestra la configuración efectiva actual ni entrega SMTP. No se probó conexión ni se enviaron mensajes durante esta auditoría.

### Propuesta para ensayos controlados

- Deshabilitar por defecto las alertas de correo mediante configuración explícita; comenzar con transporte simulado que capture mensajes en memoria, como `tests/mail.test.cjs` y `recovery-api.test.cjs`.
- Seleccionar una lista explícita de cuentas de prueba bajo control de participantes, autorizada por administrador. No enviar automáticamente a todos los usuarios, ni inferir autorización por rol CONRED, ni aceptar destinatarios desde el POST IoT.
- Disparar a partir de un evento persistido de transición según política aprobada; decidir qué niveles notifican, supresión de repetidos y cuándo permitir un nuevo aviso. No establecer aquí un nivel o tiempo definitivo.
- Usar asunto y cuerpo visibles: «PRUEBA EXPERIMENTAL — LANDSIS LADERA-1». Incluir «Prototipo universitario experimental. No es una alerta oficial de CONRED». Añadir identificador del evento/nodo, hora con zona, nivel experimental, mediciones/unidades, criterio y versión, estado de calidad y enlace autenticado al dashboard. No incluir secretos ni enlaces de recuperación.
- Para trazabilidad, proponer un registro persistente por evento/destinatario autorizado, con clave única, estado pendiente/aceptado por SMTP/fallido, intentos y fechas. Procesar después del commit sin bloquear recepción de mediciones. Reintentar solo fallos transitorios con límite y espera acordados; conservar estados inciertos para revisión. Una aceptación SMTP no demuestra llegada a bandeja y no garantiza ausencia absoluta de duplicados si se pierde la respuesta.
- Guardar identificadores internos y categorías de error sanitizadas; acceso restringido a datos personales. Evitar cuerpos completos, direcciones en logs generales, contraseñas, tokens y respuestas SMTP sin filtrar. Para tesis, evidencia anonimizada del evento y recepción en cuenta de prueba.
- La prueba real de entrega queda para una fase posterior autorizada con destinatario concreto. Esta auditoría no activa servicios ni envíos.

## 6. PostgreSQL y modelo entidad-relación actual

La consulta local utilizó `BEGIN READ ONLY`, timeout de sentencia y `ROLLBACK`, con metadatos de `information_schema.columns`, `pg_constraint`, `pg_indexes`, versión y conteos. El primer intento dentro del aislamiento falló; la inspección fuera del aislamiento tuvo éxito. No se consultaron filas con nombres, correos, contraseñas o hashes.

| Tabla | Columnas actuales | Restricciones y relaciones |
|---|---|---|
| `nodes` | `node_id TEXT NOT NULL` | PK, texto no vacío |
| `sensor_readings` | `id INTEGER` identidad; `node_id TEXT`; `soil_moisture_raw INTEGER`; `vibration_detected BOOLEAN`; `received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`; `accel_x/y/z`, `gyro_x/y/z`, `temperature DOUBLE PRECISION` | PK id; primeros cinco campos NOT NULL; FK node_id → nodes; ADC 0–4095 y nodo no vacío; siete MPU todos NULL o todos presentes |
| `roles` | `id SMALLINT` identidad, `name TEXT NOT NULL` | PK; nombre único restringido a ADMINISTRADOR, INVESTIGADOR, CONRED |
| `users` | `id INTEGER` identidad; `name TEXT`; `email TEXT`; `password_hash TEXT`; `role_id SMALLINT`; `active BOOLEAN DEFAULT TRUE`; `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`; `credential_version INTEGER DEFAULT 0`; `deleted_at TIMESTAMPTZ` | PK; excepto deleted_at, NOT NULL; FK role_id → roles; email único, normalizado y longitud 3–254; nombre no vacío 1–100; versión ≥0 |
| `password_reset_tokens` | `user_id INTEGER`; `token_hash TEXT`; `created_at`, `expires_at TIMESTAMPTZ`, todos NOT NULL | PK/FK user_id → users ON DELETE CASCADE; hash único de 64 hexadecimales; expires_at = created_at + 15 minutos |

Evidencia de definición: `database/001_create_sensor_readings.sql` a `006_soft_delete_users.sql`; implementación: `backend/src/data/*.ts`. El catálogo local confirma columnas, tipos, nulabilidad, restricciones e índices descritos. Los defaults/identidades se documentan desde los scripts SQL; no se extrajeron separadamente del catálogo en esta auditoría.

Índices: PK de las cinco tablas; UNIQUE de roles.name, users.email y token_hash; `sensor_readings_node_received_idx(node_id, received_at DESC, id DESC)` y `password_reset_tokens_expires_idx(expires_at)`. No hay índice separado observado para historial global por fecha; evaluar rendimiento solo si los volúmenes lo justifican. El CHECK MPU garantiza completitud, no rango físico ni finitud para inserciones SQL directas; la API sí exige números finitos.

Conteos observados: **1.261 lecturas, 1 nodo, 3 roles, 5 usuarios y 0 tokens**. Son una fotografía local, no cifras de producción, usuarios necesariamente activos ni prueba de procedencia física de cada fila.

El esquema tiene los efectos de 001–006. No hay tabla de historial de migraciones en el esquema público inspeccionado: no se puede acreditar fecha/ejecución exacta de cada script solamente por catálogo. No se identificó una migración de esquema pendiente entre las seis existentes; no deben volver a aplicarse automáticamente. Los documentos de aplicación de 005 y reparación de 006 proporcionan antecedentes, no sustituyen esta comprobación.

Relaciones para el DER: `nodes 1 → 0..N sensor_readings`; `roles 1 → 0..N users`; `users 1 → 0..1 password_reset_tokens`. Cada lectura exige nodo y cada usuario exige rol. No existe relación usuario–nodo ni tablas de umbrales, alertas o notificaciones. Las sesiones están en memoria, fuera del DER. `deleted_at` conserva integridad y usuarios históricos; email sigue siendo único aunque se elimine lógicamente. El PNG existente `docs/diagramas/landsis-entidad-relacion-actual.png` se inventarió, pero su fidelidad visual no se verificó; usar este esquema comprobado como referencia de actualización.

## 7. Pruebas, compilación y evidencia integral

| Verificación actual | Resultado y límite |
|---|---|
| Backend `npm.cmd run build` | Correcto; TypeScript compila |
| Backend, nueve archivos `*.test.cjs`, excluyendo `password-recovery-postgres.test.cjs` | Primera ejecución con fallos HTTP `connect EACCES 127.0.0.1`; repetición fuera del aislamiento: **228 aprobadas, 0 fallidas/omitidas**, duración runner 7.987 ms aproximadamente |
| Suite PostgreSQL aislado | No ejecutada: crea clúster, aplica SQL y modifica datos sintéticos. Es independiente de la base principal, pero se optó por evitar operaciones de datos en esta auditoría |
| Frontend `npm.cmd test`, tres archivos | **29 aprobadas, 0 fallidas/omitidas**, duración runner 4.944 ms aproximadamente |
| Frontend `npm.cmd run build` | Correcto: TypeScript y Vite 7.3.6; 45 módulos. Bundle JS 256,00 kB, gzip 79,17 kB; imagen de marca 1.060,20 kB. No se observaron advertencias en la salida mostrada |
| Firmware actual | No compilado ni cargado aquí. La guía registra compilación histórica: 970.088 bytes flash y 49.968 bytes RAM; no atribuir esas cifras al árbol actual |
| Cobertura | Sin reporte actual de líneas/ramas/funciones. Éxito de pruebas no equivale a cobertura total |

Log íntegro de la repetición segura backend: `docs/auditoria-backend-pruebas-2026-11-02.log`. Para reproducir el alcance, desde backend ejecutar build y pasar al runner todos los `tests/*.test.cjs` excepto `password-recovery-postgres.test.cjs`. **No se ejecutó `npm test` completo del backend**. Hay diez archivos backend de pruebas, uno excluido; el conteo de Node incluye padres y subpruebas, no requisitos distintos. No se afirma una cantidad ejecutada para la suite excluida.

Pruebas unitarias: validación de lecturas/consultas, hashes/sesiones, plantillas/configuración y lógica de recuperación. Integración HTTP: Express temporal en loopback, persistencia inyectada/simulada; contratos SQL con dobles. `password-recovery-postgres.test.cjs` contiene pruebas con PostgreSQL temporal real para integridad/concurrencia/autenticación y SMTP simulado, hoy no ejecutadas. Frontend usa renderizado estático y fetch simulado; no es E2E en navegador.

Evidencia histórica: `firmware/landsis_ladera1/README.md` describe prueba normal, caída de backend y caída/restauración de hotspot del 4 de octubre, con HTTP 201, IDs y consultas PostgreSQL. `frontend/README.md` registra consultas reales anteriores y revisión con backend sintético. `docs/rup/pruebas/informe-pruebas-automatizadas-2026-10-16.md` informa 191/12 pruebas; `docs/correccion-login-migracion-006.md` informa 240/28 en otro estado. Esas cantidades históricas y la actual no deben mezclarse: difieren en fecha, archivos y exclusiones.

**No se produjo hoy una nueva prueba ESP32 → API → PostgreSQL → navegador**. Es necesaria con versión de firmware identificada, hora, medición correlacionada y usuario autenticado. La existencia de filas no demuestra que provengan del nodo físico. Tampoco se probó precisión, estabilidad prolongada, recuperación de sensor, corte eléctrico o entrega real de correo.

## 8. Riesgos antes de instalación

| Prioridad | Riesgo y efecto | Evidencia |
|---|---|---|
| Alta | Sin evaluador ni alertas: no puede demostrarse aún el ciclo de aviso experimental | `RiskPanel.tsx`; ausencia de modelo/rutas en `backend/src` y `database/` |
| Alta | Un MPU ausente al arranque impide toda transmisión; fallo posterior insuficientemente diagnosticado | `landsis_ladera1.ino`, condición de envío y llamada getEvent |
| Alta | Ingesta pública y HTTP sin autenticación del nodo: un cliente con acceso puede suplantar nodeId e insertar telemetría | `app.ts`, `telemetria.h`, autorregistro en `data/readings.ts` |
| Alta | Sin calibración/montaje definitivo ni criterios aprobados, mediciones no sustentan clasificación geotécnica | sketch y paneles RAW/MPU |
| Media | Sin antigüedad máxima ni actualización automática, una lectura antigua puede seguir visible | `frontend/src/App.tsx`, `TelemetryViews.tsx` |
| Media | Pérdida de muestras en desconexión/reinicio; sin idempotencia, tiempo de adquisición o secuencia | `telemetria.h`, contrato `reading.ts`, tabla sensor_readings |
| Media | Polling puede perder pulsos; booleano no conserva intensidad ni frecuencia | `loop`, `leerHumedadPromedio` |
| Media | Sesiones/límites/cola de correo en memoria y despliegue sin verificar | `sessions.ts`, `security.ts`, `recovery-limits.ts` |
| Media | Documentación de 5 s desactualizada, cambios sin commit y evidencia dispersa dificultan reproducción | guía firmware, Git inicial, documentos de incrementos |

Para pruebas de laboratorio, delimitar red y participantes. Antes de exposición fuera de una LAN controlada, resolver protección de ingesta/transporte. No se implementa ni se establece aquí un mecanismo nuevo sin revisión de alcance.

## 9. Inventario para Capítulo V de la tesis

| Elemento | Base justificable del repositorio | Evidencia adicional pendiente |
|---|---|---|
| Plan de desarrollo | Incrementos en README y docs; matriz `docs/rup/Trazabilidad/LANDSIS_Matriz_Trazabilidad_RUP_v0_2.docx` | Cronograma real, aprobación, responsables y trazabilidad final; contenido del DOCX no revisado en detalle |
| Arquitectura/componentes | Código y sección 2 de este informe | Diagrama final de despliegue, fotos y conexiones del montaje real |
| Casos de uso | Captura, consulta, gestión de usuarios, login y recuperación derivados de rutas | Especificaciones y aceptación de actores; riesgo/correo siguen propuestos |
| UML | Módulos y flujo permiten secuencias de recepción, login y recuperación | Elaborar/revisar diagramas y separar explícitamente diseño futuro de implementación |
| DER | SQL, catálogo local y sección 6 | Validar/actualizar PNG existente y registrar versión |
| Implementación | Firmware, backend y frontend con separación clara | Congelar versión revisada y explicar decisiones/calibración sin atribuir validación inexistente |
| Pruebas unitarias/integración | Suites, log actual y documento histórico de pruebas | Ejecutar suite PostgreSQL aislada en fase acordada; conservar ambiente y logs |
| Funcionales | Escenarios y contratos en tests; antecedentes de beta | Recorrido en navegador con roles y nodo físico actual, capturas anonimizadas, esperado/obtenido |
| Integridad de datos | Constraints, FK, transacciones y pruebas con dobles; catálogo comprobado | Ensayos negativos en base exclusiva, rollback/concurrencia y comparación de datos |
| Manual de usuario | README frontend y vistas existentes | Manual consolidado con capturas, roles, recuperación, filtros y significado de estados |
| Instalación/despliegue | README firmware/frontend, scripts SQL y docs de correo/autenticación | Guía unificada 001–006, configuración privada, HTTPS/proxy, restauración y verificación en equipo destino |
| Limitaciones/trabajos futuros | Secciones 3–8 y guías existentes | Resultados de campo y delimitación académica aprobada |

También existe `docs/rup/entrevistas/LANDSIS_Entrevista_CONRED_27-07-2026.docx`; se inventarió, sin atribuir aprobación técnica ni requisitos a su contenido no examinado. No se verificaron normas de formato o rúbrica oficial de la Universidad Mariano Gálvez; este inventario técnico no certifica cumplimiento institucional.

## 10. Plan final por prioridad y criterio de cierre

1. **P0 — Fijar línea base y condiciones del ensayo.** Revisar cambios pendientes sin sobrescribirlos; identificar versiones cargadas, montaje, alimentación y red; corregir documentación de intervalos en una tarea posterior. Cierre: versión reproducible y lista del montaje confirmado.
2. **P0 — Aprobar criterios experimentales y política de fallos.** Resolver calibración/referencia y uso de humedad, inclinación y vibración; definir datos no evaluables, atraso y comportamiento sin MPU. Cierre: matriz de criterios y escenarios de aceptación aprobada, sin umbrales inventados.
3. **P1 — Completar evaluación e historial.** Implementar el evaluador backend, configuración versionada, eventos persistidos y lectura por dashboard; probar transiciones y supresión de oscilaciones. Cierre: datos sintéticos producen estados y eventos reproducibles; fallos no producen falsos Normal.
4. **P1 — Completar correo experimental.** Reutilizar SMTP, lista de prueba autorizada, plantilla de prototipo, registro de intentos, deduplicación y política de reintentos. Cierre inicial: pruebas simuladas; cierre de entrega: recepción única controlada y evidencia anonimizada, bajo autorización posterior.
5. **P1 — Preparar instalación y protección de comunicaciones.** Comprobar acceso LAN, alcance de ingesta, recuperación y tratamiento de sensores; decidir protección necesaria según exposición real. Cierre: prueba de desconexión/reconexión y fallos con comportamiento documentado.
6. **P2 — Ejecutar regresión e integración de datos en entorno exclusivo.** Suite completa con PostgreSQL temporal, pruebas del evaluador/correo y compilación firmware reproducible. Cierre: logs, versiones y resultados, sin tocar datos reales.
7. **P2 — Ensayo integral físico.** Correlacionar serial/JSON, respuesta 201, fila SQL, usuario autenticado, dashboard, evento experimental y mensaje de prueba. Incluir desconexiones, sensor ausente, valores inválidos y recuperación; acordar duración y criterios antes de medir. Cierre: casos esperado/obtenido y evidencias con hora, versión y responsables.
8. **P2 — Consolidar Capítulo V y manuales.** Actualizar UML/DER, matriz, instalación, usuario y limitaciones; separar evidencia histórica de la final. Cierre: paquete académico trazable sin credenciales ni datos personales.

### Conclusión

**Para realizar pruebas integrales y producir evidencia técnica válida necesitamos confirmar el montaje y firmware actuales, acordar criterios experimentales y calibraciones, completar evaluación e historial de riesgo, implementar correo controlado con destinatarios autorizados y trazabilidad, definir fallos/atraso y protección de comunicación, y ejecutar una campaña reproducible ESP32–API–PostgreSQL–dashboard–evento–correo de prueba.** La base de telemetría, usuarios y persistencia ya permite preparar esa campaña; el ciclo de alertas todavía no está implementado. Ningún resultado actual constituye validación geotécnica ni alerta oficial de CONRED. Las soluciones quedan propuestas para revisión, sin implementación en esta auditoría.
