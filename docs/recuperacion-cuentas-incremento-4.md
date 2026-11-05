# Recuperación de cuentas — Incremento 4: React

La interfaz reutiliza el estilo del login (panel, tipografía, colores y controles)
y el cliente HTTP actual. No agrega React Router ni dependencias. No modifica
dashboard, telemetría, roles, firmware, SMTP o esquema PostgreSQL.

## Rutas y comportamiento

- `/`: login existente, con enlace «¿Olvidaste tu contraseña?».
- `/forgot-password`: vista pública con validación y normalización del correo.
  Envía POST a `/api/v1/auth/forgot-password`, usando JSON y
  `X-Landsis-Request: 1` mediante el cliente existente. Un resultado exitoso
  muestra siempre el mensaje genérico; los errores de conexión/límites se
  muestran sin inferir que la cuenta existe.
- `/reset-password#token=...`: vista pública que captura el token y retira
  fragmento/query mediante replaceState antes de montar React. Solo admite un
  parámetro token hexadecimal minúsculo de 64 caracteres en el fragmento.
  El token no se presenta en inputs ni se almacena en cookies o Web Storage.
  La ruta visible queda `/reset-password`.
- La confirmación de éxito reemplaza la vista en esa misma ruta. Es estado en
  memoria, sin sesión automática; ofrece regresar al login. Se descarta la
  sesión que AuthApp pudiera tener antes del cambio y se restaura normalmente
  al volver a `/`.

La contraseña debe contener 12–128 caracteres Unicode y no ser solo espacios.
La confirmación debe coincidir exactamente. No se recorta ni normaliza la
contraseña. Ambas entradas están ocultas y se vacían después de una respuesta
del servidor. Errores 400 del reset ofrecen solicitar otro enlace; los errores
429/503 y fallos de red permiten reintentar. No se envía confirmación por correo.

AuthApp conserva login/logout, autorización y restauración de sesión. Las
vistas públicas no esperan ni solicitan `/auth/me`; pueden mostrarse con el
backend inaccesible. Al volver al login se ejecuta la restauración existente.
Back/Forward y navegación por fragmentos actualizan la vista; se evita procesar
dos veces el token cuando una navegación produce popstate y hashchange.

## Seguridad y despliegue

`index.html` aplica `<meta name="referrer" content="no-referrer">` antes de los
recursos. Las vistas no incluyen recursos externos y React escapa su contenido.
No se registran tokens ni contraseñas. El token vive únicamente en memoria y
se envía en el cuerpo del POST mediante el cliente HTTP actual. No modifica
cookies de autenticación; conserva el mecanismo same-origin de la aplicación.

Recargar la URL ya limpia descarta el token: se informa enlace incompleto y
se ofrece solicitar uno nuevo. También se puede reabrir el enlace original
del correo mientras el servidor aún lo considere válido y sin usar.

El despliegue actual utiliza la raíz del origen. FRONTEND_URL debe corresponder
a esa ubicación; un despliegue futuro bajo subcarpeta necesitará adaptar las
rutas/base de Vite. El servidor de producción debe entregar index.html para
`/forgot-password` y `/reset-password`, conservando el proxy `/api` y los assets.
Vite ya proporciona el fallback SPA durante desarrollo/preview.

La operación real depende de la migración 005 autorizada y de habilitar/configurar
el correo según el incremento 3. **No se aplicó 005, no se configuró Gmail ni se
enviaron correos en este incremento.** No se ejecutó la suite backend que crea
migraciones en PostgreSQL aislado; el cambio es exclusivamente de interfaz.

## Verificación

Desde frontend:

```powershell
npm.cmd run build
npm.cmd test
```

Resultado: compilación TypeScript/Vite de producción exitosa y **27 pruebas
aprobadas, cero fallidas y cero omitidas** (15 nuevas y 12 de regresión).
La compilación genera `frontend/dist`, ignorado por Git. En este entorno Windows
tsx requirió ejecutar las pruebas fuera del sandbox por un error del sistema
`uv_os_get_passwd`; no se cambiaron dependencias para evitarlo.

Las pruebas verifican markup, rutas/eventos de historial, limpieza del fragmento,
política Unicode, confirmación y llamadas HTTP con fetch simulado. La revisión
en navegador se realizó adicionalmente con Vite en un puerto separado y una
API local simulada que no importa dotenv, SMTP o PostgreSQL. Se comprobó:

- Login -> solicitud; correo inválido y mensaje genérico tras solicitud válida.
- Token sintético retirado de la URL; formulario con contraseñas distintas.
- Respuesta de éxito simulada, confirmación y regreso al login sin sesión.
- Token ausente y respuesta simulada de token vencido, con opción de otro enlace.
- Navegación a un nuevo fragmento desde la misma ruta de reset.

La API temporal solo generó contadores de solicitudes y respuestas sintéticas;
no cambió contraseñas ni envió mensajes. Los procesos de revisión se detienen
al terminar. El script temporal quedó bajo `backend/tmp`, ignorado por Git.
