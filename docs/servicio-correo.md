# Servicio de correo — Incremento 1

Módulo opcional del backend, compatible con Node.js 24 y salida CommonJS.
No está conectado al arranque de Express, rutas, usuarios, sesiones ni telemetría.
Importar el módulo no carga `.env`, abre conexiones ni envía mensajes.

## Configuración local

Configurar manualmente en el entorno privado o en `backend/.env` las variables
indicadas en `backend/.env.example`. Ese archivo real está excluido de Git y no
debe compartirse. Ningún secreto SMTP debe aparecer en variables del frontend.

| Variable | Uso |
|---|---|
| SMTP_HOST | Host DNS del proveedor, sin esquema ni credenciales |
| SMTP_PORT | Puerto entero de 1 a 65535 indicado por el proveedor |
| SMTP_SECURE | `true` para TLS implícito; `false` para STARTTLS obligatorio |
| SMTP_USER | Usuario SMTP del proveedor |
| SMTP_PASSWORD | Contraseña SMTP o contraseña de aplicación del proveedor |
| MAIL_FROM | Una dirección simple de remitente autorizada por el proveedor |

Solicitar al proveedor sus parámetros SMTP y habilitar el remitente/dominio.
Usar 465 con `SMTP_SECURE=true`, o 587 con `SMTP_SECURE=false` según sus
instrucciones. Otros puertos admiten el modo TLS indicado por el proveedor.
No se permite entrega sin cifrado ni omitir validación de certificados.
Esta versión admite autenticación por usuario/contraseña; proveedores que
exijan exclusivamente OAuth2 requieren un incremento posterior.
Configurar SPF/DKIM y DMARC según el proveedor y el dominio antes de uso real.

`loadMailConfig` valida explícitamente la configuración sin imprimir sus valores.
No se invoca al arrancar la aplicación actual: correo sin configurar no rompe
el login ni la telemetría. El futuro punto de composición llamará a
`createSmtpMailService` después de cargar su entorno.

## Uso y límites

`createMailService(transport, from)` admite un transporte inyectado con
`sendMail`. Expone `sendPasswordRecovery`, `sendPasswordChanged` y `send` para
mensajes futuros con destinatario, asunto, HTML y texto. El llamador de `send`
es responsable de construir HTML seguro; ambas plantillas actuales escapan
todos los valores dinámicos. No acepta adjuntos, listas de destinatarios ni
cabeceras arbitrarias. No define criterios ni alertas automáticas de riesgo.

La plantilla de recuperación recibe un enlace ya construido por el futuro
servicio de autenticación a partir de una URL de frontend confiable. Solo
admite HTTPS o HTTP de loopback para desarrollo, sin credenciales embebidas.
La expiración de quince minutos y el uso único indicados en el texto deberán
ser implementados en ese incremento; este módulo no genera ni valida tokens.
La confirmación de cambio no contiene contraseñas ni enlaces de recuperación.

DNS/conexión/saludo tienen límites de 10 segundos; inactividad de socket,
20 segundos. Son límites por fase/inactividad, no un plazo total garantizado.
No hay reintentos, cola persistente, deduplicación ni garantía de entrega final.
Un rechazo del transporte produce `MailDeliveryError` sin el error original.
No registrar mensajes, enlaces, configuración ni errores originales SMTP en
futuros llamadores. Logger/debug de Nodemailer están desactivados, y se impide
acceso a archivos y URLs como fuentes de contenido.

## Verificación sin envíos reales

Desde `backend`, ejecutar `npm.cmd test`: compila a `backend/dist` (ignorado por
Git) y ejecuta todas las pruebas. `tests/mail.test.cjs` usa configuración
sintética, transporte inyectado y transporte stream de Nodemailer en memoria.
No carga el `.env` real, no verifica un servidor SMTP ni contacta destinatarios.
La conexión, certificados y entrega reales quedan pendientes de una prueba
manual autorizada en otro incremento.
