# Recuperación de cuentas — Incremento 3: API

Se reutilizan el transporte/plantilla del incremento 1 y el servicio transaccional
del incremento 2. No se agregan dependencias, tablas, vistas, envíos de bienvenida,
confirmaciones de cambio ni alertas de riesgo.

## Configuración y dependencia de esquema

**005 no se aplica automáticamente ni se ha aplicado a la base principal.**
Antes de utilizar estas rutas contra la base principal, autorizar/aplicar 005
siguiendo la [guía del incremento 2](recuperacion-cuentas-incremento-2.md), con el
backend detenido. El login del incremento 2 también depende de credential_version.

El arranque en `server.ts` compone los servicios existentes. El correo permanece
deshabilitado por defecto (`RECOVERY_EMAIL_ENABLED=false`). Para habilitarlo en
un despliegue posterior, configurar privadamente ese valor a `true`, las variables
SMTP del incremento 1, MAIL_FROM y FRONTEND_URL. No compartir `.env` ni poner
secretos en variables del frontend. Este incremento no modifica el `.env` real.

FRONTEND_URL debe ser la base del frontend, sin credenciales, query ni fragmento.
Requiere HTTPS, salvo HTTP en loopback para desarrollo fuera de producción.
Una base `https://sitio.example/landsis/` produce enlaces
`https://sitio.example/landsis/reset-password#token=...`. El origen y la ruta no
dependen de Host, Forwarded ni otros encabezados de la solicitud. El token se
transporta en el fragmento para no llegar a logs del servidor del frontend.
**Esa vista todavía no existe** y deberá leer el fragmento en el incremento de UI.

Con correo habilitado y configuración inválida, el arranque falla con un error
sin valores secretos. Con correo deshabilitado, forgot-password conserva 202
sin consultar usuarios ni emitir tokens; reset-password continúa disponible
para un token válido ya emitido y necesita 005. La respuesta genérica no confirma
entrega ni existencia de la cuenta.

Importar app/security no crea transporte SMTP ni abre conexiones. Las pruebas
inyectan mail/recovery/users; el único punto que crea SMTP real es el arranque
con el indicador explícito habilitado. No se ejecuta verify ni se envía correo
al iniciar.

## Contratos

Ambas rutas son públicas, sin cookie obligatoria, pero requieren:

```text
Content-Type: application/json
X-Landsis-Request: 1
```

Se mantiene el middleware actual de mutaciones, Cache-Control: no-store y JSON
máximo de 8 KiB. Sin cabecera: 403; tipo incorrecto: 415; JSON inválido: 400;
cuerpo demasiado grande: 413. No se habilita CORS. El futuro frontend usará el
cliente HTTP existente y el mismo origen/proxy.

### POST /api/v1/auth/forgot-password

```json
{ "email": "usuario@example.com" }
```

Únicamente se admite el campo email, usando el validador existente; se recorta
y convierte a minúsculas igual que en login. Formato inválido: 400.

Para toda entrada válida admitida por IP:

```text
202
{"message":"Si la cuenta puede recuperarse, recibirás un correo con instrucciones."}
```

La respuesta se emite antes de consultar usuarios, generar tokens o enviar.
Para cuentas activas se genera mediante el servicio existente y se envía con
sendPasswordRecovery. Las inexistentes/inactivas no reciben tokens ni mensajes.
Fallas de persistencia, SMTP, saturación de cola y límite por cuenta no cambian
el cuerpo/estado de respuesta. Un fallo SMTP deja el hash emitido hasta sustituirlo
o vencer; no se reutiliza el enlace anterior ni se reintenta automáticamente.
Un contador/registro operativo registra únicamente un mensaje fijo de fallo,
sin excepción original, email, enlace, credenciales ni contenido.

### POST /api/v1/auth/reset-password

```json
{ "token": "64 caracteres hexadecimales minúsculos", "password": "nueva contraseña" }
```

Solo esos dos campos. Mantiene la política de 12–128 caracteres Unicode y scrypt.
El servicio existente comprueba hash/vigencia/estado y consume el token, cambia
el hash e incrementa credential_version en una transacción. La validez definitiva
se revalida bajo bloqueo; la ruta no duplica esa lógica.

| Estado | Significado |
|---|---|
| 200 | Contraseña restablecida; iniciar sesión con la nueva contraseña |
| 400 | Formato/política inválidos, o enlace inexistente/expirado/usado/manipulado |
| 429 | Límite de solicitudes o capacidad de operaciones simultáneas |
| 503 | Fallo interno de restablecimiento, sin detalles de PostgreSQL |

Todos los tokens de formato correcto rechazados por persistencia reciben el
mismo mensaje: `El enlace de recuperación no es válido o ha vencido.`
Un cuerpo de formato inválido tiene un error de validación genérico distinto.
No inicia sesión, no establece una nueva cookie ni envía confirmación adicional.
Las cookies anteriores se rechazan en su siguiente petición autenticada.
El frontend debe manejar el error 400 sin tratarlo como sesión vencida.

## Límites y disponibilidad

Límites locales de ventana fija de quince minutos:

| Operación | Límite |
|---|---|
| Forgot por IP | 5 solicitudes; incluye cuerpos inválidos que pasan la cabecera/tipo |
| Forgot por correo normalizado | 3 solicitudes; excedentes responden 202 sin trabajo |
| Reset por IP | 10 solicitudes |
| Reset por hash de token | 5 intentos con cuerpo válido |
| Reset simultáneo | 2 operaciones, antes de scrypt/transacción |
| Cola de recuperación | 20 tareas en total, incluidas activas; 2 simultáneas |

Cada mapa tiene como máximo 1000 entradas y elimina ventanas vencidas; las claves
por cuenta/token son SHA-256, no valores originales. Los límites por cuenta se
aplican aunque no exista la cuenta. Exceder el límite por IP/token devuelve 429
con Retry-After: 900. Si ya hay dos resets activos también devuelve ese estado.
No se confía automáticamente en X-Forwarded-For. Detrás de un proxy las IP pueden
compartir límite; configurar únicamente proxies conocidos en un despliegue futuro.

La cola en memoria procesa también búsquedas de cuentas inexistentes; SMTP y
PostgreSQL quedan fuera del camino de respuesta de forgot. El transporte SMTP
conserva los tiempos máximos por fase/inactividad del incremento 1. Una tarea
bloqueada conserva su cupo, pero no permite crecimiento ilimitado. No hay plazo
total de tarea garantizado ni coordinación distribuida: estas restricciones
corresponden a la beta de una sola instancia.

Los contadores y tareas pendientes se pierden al reiniciar; tareas descartadas
por saturación no se reintentan. Varios enlaces solicitados pueden llegar en
orden distinto: solo el último token emitido es válido. La recuperación no bloquea
el login. El proveedor SMTP puede aceptar sin garantizar entrega final.

## Verificación

Desde backend: `npm.cmd test`. Compila CommonJS a `backend/dist` (ignorado) y
ejecuta regresión completa. `recovery-api.test.cjs` prueba validación, URLs,
seguridad HTTP, respuesta independiente de consultas/SMTP lentos, límites y
fallos sanitizados. Se conserva la integración PostgreSQL aislada del incremento
2 y se amplía con el flujo real por ambos endpoints, transporte SMTP simulado,
tokens expirados/usados/manipulados y revocación/login posterior.

No se carga `.env` real ni se conecta a la base principal o a SMTP. Los clusters
de prueba y logs sintéticos se generan en `backend/tmp`, ignorado por Git, y se
detienen al terminar. En Windows puede requerirse ejecutar las pruebas fuera
del sandbox para que pg_ctl cree su proceso restringido.

Resultado de entrega: compilación TypeScript/CommonJS exitosa y **231 pruebas
aprobadas, cero fallidas y cero omitidas**, con PostgreSQL 17.11 aislado y SMTP
simulado. La migración principal y la conexión SMTP real continúan pendientes.
