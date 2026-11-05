# Incremento 6 — Preparación de Gmail, sin habilitar envíos

## Estado de configuración

Se revisaron las variables sin mostrar contraseñas, direcciones privadas ni el
contenido completo de `.env`. Se agregaron exclusivamente cuatro valores no
secretos a `backend/.env`, conservando todos sus valores preexistentes:

| Variable | Estado / valor requerido |
|---|---|
| SMTP_HOST | Configurado: smtp.gmail.com |
| SMTP_PORT | Configurado: 465 |
| SMTP_SECURE | Configurado: true, TLS implícito |
| RECOVERY_EMAIL_ENABLED | Configurado: false; no habilitar todavía |
| SMTP_USER | Pendiente: usuario debe introducir manualmente su dirección completa de Google |
| SMTP_PASSWORD | Pendiente: contraseña de aplicación de Google, nunca la contraseña habitual |
| MAIL_FROM | Pendiente: dirección remitente; para esta prueba usar la misma cuenta controlada de SMTP_USER |
| FRONTEND_URL | Pendiente: URL real de la raíz del frontend; para desarrollo local previsto, http://127.0.0.1:5173/ |

No se crearon valores ficticios para las credenciales faltantes. El archivo real
sigue ignorado por Git. El ejemplo `.env.example` ahora documenta Gmail con TLS
y mantiene vacíos los campos privados. No se cambió configuración PostgreSQL,
NODE_ENV, puerto u otros valores ya existentes. No se reinició el backend ni se
activó recuperación durante esta preparación.

Completar las cuatro variables pendientes **manualmente en el entorno privado**;
no pegar sus valores en el chat, comandos con contraseñas, capturas o Git.
Google exige verificación en dos pasos para generar contraseñas de aplicación;
algunas cuentas de organización, con Protección Avanzada o con configuraciones
específicas no ofrecen esa opción. Si no está disponible, revisar la cuenta o
su administrador; no sustituirla por la contraseña habitual ni desactivar TLS.
Fuente: [Google — Contraseñas de aplicación](https://support.google.com/accounts/answer/185833?hl=es).

## Arquitectura y seguridad conservadas

El servicio SMTP existente utiliza las opciones de `loadMailConfig`, sin cambios
en transporte, plantillas, límites de tiempo o API de recuperación. La nueva
herramienta `src/check-smtp.ts` es únicamente un diagnóstico que reutiliza esa
configuración y Nodemailer. No crea otro sistema de correo ni expone sendMail.
No agrega dependencias. Importarla no carga `.env`, conecta ni imprime valores;
solo la ejecución explícita del CLI carga su entorno privado.

Se mantienen certificados válidos, TLS mínimo 1.2, conexión/saludo/DNS de diez
segundos y socket de veinte segundos. Logger/debug siguen desactivados. Los
errores reales de Google se reemplazan por mensajes/categorías fijos, sin causa
original, respuesta SMTP, dirección de cuenta o contraseña. El transporte se
cierra después de verificar, también ante errores.

La herramienta rechaza otro destino distinto de smtp.gmail.com:465/TLS, una
URL de frontend inválida o RECOVERY_EMAIL_ENABLED=true. No modifica variables
para activar la aplicación: la copia con flag true dentro de la validación solo
permite comprobar FRONTEND_URL sin cambiar el entorno real.

No hay ruta, tarea, listener de telemetría o temporizador que llame a un envío de
alerta de riesgo. El único llamador automático de correo de la aplicación está
en forgot-password y depende de RECOVERY_EMAIL_ENABLED. No se llama a la antigua
plantilla independiente de cambio de contraseña, ni se agregó bienvenida.

## Compatibilidad de URLs y encabezados

El backend actual respondió /health con status ok en http://127.0.0.1:3000.
Vite usa proxy /api hacia http://localhost:3000 salvo API_PROXY_TARGET configurado.
El cliente React mantiene JSON, X-Landsis-Request: 1 y credentials: same-origin;
la API conserva el middleware que exige esos encabezados. No se habilitó CORS.

Con FRONTEND_URL=http://127.0.0.1:5173/, los enlaces serán:

```text
http://127.0.0.1:5173/reset-password#token=...
```

Esta URL es propuesta para el frontend local, **no una configuración efectiva
ya encontrada**: FRONTEND_URL está pendiente. Antes de la prueba debe arrancarse
Vite en ese puerto y comprobar que abre /reset-password y que /api llega al backend.
El enlace debe usar el puerto del frontend, no 3000. Para otro equipo/móvil,
127.0.0.1 apuntaría a ese dispositivo; usar un origen HTTPS accesible y proxy API
del mismo origen, sin desactivar las validaciones. No se asume un dominio nuevo.

## Prueba controlada preparada — no ejecutada contra Google

1. Completar manualmente las variables pendientes y mantener recuperación en
   false. Abrir el frontend en la URL configurada. Desde backend ejecutar:

```powershell
npm.cmd run smtp:check
```

Este modo compila y valida configuración. No crea transporte ni abre conexión
externa. Actualmente fallaría porque faltan credenciales y FRONTEND_URL; esto
no demuestra un problema de red. No se muestra el valor que falta o es inválido.

2. Tras una **autorización explícita posterior para verificar la conexión**:

```powershell
# Solo después de autorización; no ejecutado en este incremento.
npm.cmd run smtp:check -- --verify-connection
```

Usa transporter.verify(): DNS, TCP, TLS y autenticación SMTP, sin MAIL FROM,
destinatarios ni mensaje. No exige activar la recuperación. Si falla, detener y
revisar la configuración en privado; no registrar respuestas originales ni hacer
reintentos indiscriminados. [Nodemailer — verify](https://nodemailer.com/smtp#verifying-the-configuration).

3. Un verify exitoso no demuestra que Gmail acepte MAIL_FROM ni que un mensaje
   llegue a bandeja de entrada. Para probar entrega se requerirá **otra autorización
   explícita de envío** que identifique una cuenta de prueba bajo nuestro control.
   Esa cuenta debe existir y estar activa en LANDSIS; no crear o cambiar usuarios
   reales sin autorización. Solo entonces preparar habilitación temporal de
   RECOVERY_EMAIL_ENABLED, reiniciar el backend y solicitar un único enlace con
   la interfaz existente. No hay autorización para esos pasos en este incremento.
4. El propietario revisará bandeja/spam, abrirá el enlace y realizará su prueba
   de restablecimiento sin compartir contraseñas o tokens. No agregar mensajes
   extra. Al terminar, deshabilitar nuevamente el correo y reiniciar el backend
   si ese es el alcance aprobado para la prueba. Las alertas permanecen sin activar.

## Estado de conectividad y pendientes

No se abrió una conexión SMTP a Google, no se autenticó la cuenta y no se enviaron
mensajes. La configuración efectiva no es todavía válida por los cuatro campos
faltantes. La compatibilidad de las opciones con Nodemailer se comprueba con
transportes simulados; la conectividad real y políticas de Gmail siguen pendientes.

Riesgos concretos: disponibilidad de contraseñas de aplicación según la cuenta,
autorización del remitente, límites/políticas de Google y entrega/spam todavía no
probados. Cambiar la contraseña principal de Google revoca contraseñas de aplicación,
según la documentación oficial. La URL local solo sirve en el mismo equipo.
No activar servicios de aplicaciones menos seguras ni omitir certificados para
resolver una falla.

Se agregó `tests/check-smtp.test.cjs` para modo local sin conexiones, configuración
inválida, verify simulado, cierre del transporte y sanitización de errores. Las
pruebas automatizadas usan datos sintéticos y no cargan credenciales reales.

Resultado de entrega: compilación TypeScript/CommonJS exitosa; 236 pruebas
backend y 27 frontend aprobadas (263 total), cero fallidas y cero omitidas.
La regresión backend utilizó su PostgreSQL aislado y transportes simulados.
No se tocó la base principal ni se ejecutó `--verify-connection`.
