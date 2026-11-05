# Incremento 10 — autenticación y usuarios

## Decisiones

Sesión opaca aleatoria de 32 bytes, guardada en memoria del único proceso backend
por su digest SHA-256. Expiración absoluta de 8 horas, comprobada por el servidor.
Cookie `landsis_session`, HttpOnly, SameSite=Strict, Path=/api, Max-Age=28800;
Secure cuando NODE_ENV=production. No hay JWT ni secreto de firma, ni tokens en
localStorage/sessionStorage. El navegador restaura la cookie y `/auth/me` valida
la sesión. Reiniciar backend termina todas las sesiones; no sirve para múltiples
instancias sin sustituir el almacén. Esta limitación es aceptada para la beta local.

`requireAuth` consulta el usuario actual en PostgreSQL en cada solicitud: los
usuarios inactivos no acceden y los permisos reflejan el rol actual. `requireRole`
controla administración en el servidor. Login devuelve usuario público y cookie,
no token en JSON. Logout revoca la sesión y elimina la cookie. Respuestas privadas
usan Cache-Control: no-store.

Mutaciones de auth/usuarios requieren JSON y `X-Landsis-Request: 1`, además de la
cookie Strict. No se habilita CORS: las peticiones externas con esta cabecera
requieren un preflight que la API no autoriza. El POST del ESP32 conserva su
validación original y no exige cookie ni esa cabecera. No habilitar CORS de manera
indiscriminada. HTTPS es necesario para uso en red/producción; HTTP queda para
desarrollo local. `NODE_ENV=production` exige entregar frontend/API mediante HTTPS.

Contraseñas: 12–128 caracteres Unicode, no solo espacios, sin requisitos de
mayúsculas/símbolos. No recortar ni normalizar la contraseña. `crypto.scrypt`
asíncrono: N=131072, r=8, p=1, salida 64 bytes y sal aleatoria de 16 bytes;
comparación mediante timingSafeEqual. La columna password_hash incluye algoritmo,
parámetros, sal y hash. No se necesita columna de sal separada. No se modifican
contraseñas con PATCH en esta fase.

Login limita a 10 intentos por IP/15 minutos, incluidos exitosos, y dos
verificaciones simultáneas; el registro está acotado a 1000 IP. El almacén admite
1000 sesiones activas. Son límites operativos de esta beta, no parámetros de sensores.
Detrás del proxy local las IP pueden compartir ese límite; no se confía
automáticamente en X-Forwarded-For. Reiniciar borra límites y sesiones. Un correo
inexistente realiza la misma derivación; contraseña incorrecta/correo inexistente
dan el mismo mensaje. Estado inactivo solo se informa tras contraseña válida.

Referencias: [Node crypto](https://nodejs.org/api/crypto.html),
[OWASP sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Migración y restricciones

`database/004_create_users_and_roles.sql`, una sola vez y en transacción:

- roles: id, nombre único restringido a ADMINISTRADOR/INVESTIGADOR/CONRED.
- users: id, name, email único normalizado a minúsculas, password_hash,
  role_id obligatorio con FK, active y created_at.
- Un usuario tiene exactamente un rol. Sin eliminación física ni updated_at.
- Sin cambios ni relaciones nuevas sobre nodes/sensor_readings.
- No contiene usuarios ni contraseñas iniciales.

PATCH serializa cambios de users dentro de una transacción para impedir
desactivar/cambiar rol al último administrador activo. Bootstrap usa el mismo
bloqueo y rechaza crear otro administrador si ya existe uno, incluso inactivo.
No es un mecanismo de restablecimiento de contraseñas. El email no se edita en
esta fase; los duplicados devuelven 409.

## Intervención local pendiente (no ejecutada por Codex)

1. Resguardar la base según tu procedimiento local y comprobar que existen las
   tablas de incrementos 001–003. La migración 004 no modifica mediciones.
2. Desde la raíz del proyecto, en PowerShell con `psql` instalado, ejecutar:

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1
$landsisDbUser = Read-Host 'Usuario PostgreSQL usado en backend/.env'
psql --host=localhost --port=5432 --dbname=landsis --username=$landsisDbUser --password --set=ON_ERROR_STOP=1 --file=database/004_create_users_and_roles.sql
```

El comando solicitará la contraseña PostgreSQL local; no escribirla en el comando
ni compartirla. Host/puerto/base deben coincidir con tu configuración local.
Si `psql` no está en PATH, ejecutar el SQL en la herramienta PostgreSQL que usas,
conectada a esa base; no ejecutar una segunda vez. Verificar roles:

```sql
SELECT name FROM roles ORDER BY id;
SELECT count(*) FROM users;
```

3. Crear el primer administrador en una terminal interactiva (no redirigir stdin):

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1\backend
npm run create-admin
```

Solicita nombre/correo y contraseña dos veces con entrada oculta. El script usa
backend/.env existente, no recibe contraseña por argumento y no imprime hashes.
Ctrl+C cancela. Si el admin existe, informa y no altera ninguna cuenta.

4. Detener la instancia anterior del backend y arrancar la nueva:

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1\backend
npm run build
npm start
```

No confundir un proceso antiguo en 3000 con la nueva API. Health no confirma que
la migración esté aplicada. Si hay un proceso anterior, detenerlo desde su terminal
antes de iniciar otro. PostgreSQL debe estar activo; no cambiar credenciales reales.

5. En otra terminal:

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1\frontend
npm run dev -- --port 5173 --strictPort
```

Abrir http://127.0.0.1:5173, iniciar sesión con la cuenta creada. El proxy mantiene
misma procedencia y reenvía Cookie/Set-Cookie. No se requiere instalar dependencias
nuevas respecto a incremento 9. Para una instalación limpia, `npm ci` en cada carpeta.

## Endpoints

| Método y ruta | Permiso | Resultado |
|---|---|---|
| POST /api/v1/auth/login | Público, JSON/cabecera | usuario público + cookie |
| GET /api/v1/auth/me | Sesión activa | usuario actual |
| POST /api/v1/auth/logout | JSON/cabecera | 204 y revocación |
| GET /api/v1/users | ADMINISTRADOR | listado público |
| POST /api/v1/users | ADMINISTRADOR | 201; name/email/password/role/active |
| PATCH /api/v1/users/:id | ADMINISTRADOR | name/role/active |
| GET /api/v1/nodes | Sesión activa, cualquier rol | contrato previo |
| GET /api/v1/readings | Sesión activa, cualquier rol | contrato previo |
| GET /api/v1/readings/latest | Sesión activa, cualquier rol | contrato previo |
| POST /api/v1/readings | Público, dispositivo | contrato previo |

User público: id, name, email, role, active, createdAt. Jamás password_hash,
passwordHash, sal, contraseña o token en JSON. Roles investigadores y CONRED
comparten acceso al dashboard; no se añade autorización más granular.

## Frontend y pruebas

AuthApp contiene restauración, login, logout y protección del dashboard existente.
LoginForm: campos accesibles, contraseña oculta y mensajes claros. UserNavigation:
nombre/rol y acceso Usuarios exclusivo admin. UsersPanel: lista, creación,
confirmación de contraseña, edición nombre/rol/estado, cancelación y errores.
api/http centraliza cookie, cabecera y notificación de 401; se descartan datos del
dashboard al perder sesión. Al volver a la pestaña se consulta me para actualizar
rol/estado. Logout fallido se informa sin afirmar que se revocó la sesión.

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1\backend
npm test
cd ..\frontend
npm run build
npm test
```

184 pruebas backend aprobadas (161 previas + 23 nuevas), build backend exitoso.
6 pruebas frontend aprobadas, build/TypeScript frontend exitosos. Las pruebas frontend
reutilizan tsx ya instalado en backend como ejecutor de pruebas: no es dependencia
de ejecución del frontend ni una nueva librería. Verifican markup/navegación y
cliente API con fetch simulado; no prueban interacción completa en navegador.
Backend usa dobles de persistencia, cubre SQL/transacciones, hashing/bootstrap,
sesiones, autorización, errores y compatibilidad POST IoT, sin escribir en base real.

Pendiente: aplicar migración real, bootstrap, login/logout/recarga, creación y edición
de usuarios reales y revisión visual. Con admin: comprobar Usuarios y crear cuentas
de INVESTIGADOR y CONRED; entrar con cada una y comprobar dashboard sin Usuarios.
Revisar contraseña incorrecta, cuenta inactiva, restauración al recargar y cierre de
sesión. Confirmar que mediciones existentes permanecen intactas. No se afirma que
estas pruebas manuales se hayan hecho.

Fuera de alcance: recuperación/cambio de contraseña, autenticación del dispositivo,
MFA, auditoría empresarial, sesiones distribuidas y clasificación científica de riesgo.

## Restablecimiento local de contraseña

Existe un comando de mantenimiento local para restablecer un usuario existente,
sin correo ni endpoint público. Ejecutar en PowerShell normal:

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1\backend
npm.cmd run reset-password
```

Solicita el email y una nueva contraseña con confirmación; ambas entradas de
contraseña están ocultas. Reutiliza la entrada oculta de create-admin y el mismo
hashPassword/scrypt/política de 12–128 caracteres. No pasar contraseñas por argumentos,
archivos o chat. Ctrl+C cancela. Usa la configuración local existente de backend/.env.

Normaliza el email igual que el login y actualiza solamente password_hash mediante
SQL parametrizado. La sal nueva está incluida en ese campo: no existe password_salt
separado y no se modifica el esquema. No cambia email, nombre, rol ni estado activo.
Si el usuario no existe o la confirmación/política falla, informa sin cambiar cuentas.
No imprime ni consulta hashes. Una cuenta inactiva sigue inactiva tras el reset.

Desde el incremento 2 de recuperación, el comando incrementa credential_version
y elimina tokens pendientes en la misma transacción; las sesiones anteriores
se rechazan en su siguiente solicitud. Requiere aplicar primero la migración 005;
ver [guía de recuperación](recuperacion-cuentas-incremento-2.md). El acceso a este comando depende del acceso local a la
configuración PostgreSQL: no es una funcionalidad expuesta en la API.

Verificación posterior a este cambio: build backend exitoso y 191 pruebas aprobadas
(184 anteriores + grupo y seis casos de reset). Pruebas de reset con persistencia
simulada, sin cambiar contraseñas reales ni agregar credenciales al repositorio.
