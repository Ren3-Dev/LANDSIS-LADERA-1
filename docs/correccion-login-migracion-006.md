# Corrección local del login por migración 006 pendiente

Fecha: 22 de octubre de 2026. Base verificada: landsis, localhost:5432.

## Causa comprobada

La migración 005 estaba presente (credential_version y password_reset_tokens),
pero faltaba users.deleted_at. La consulta real userStore.findByEmail devolvía
42703 (columna inexistente). El endpoint principal POST /api/v1/auth/login
respondía 503 con «No se pudo iniciar sesión. Intenta de nuevo.».
Los logs disponibles no incluían el detalle SQL porque el controlador lo captura.

El administrador ID 1 existía, estaba activo, tenía rol ADMINISTRADOR, el correo
esperado y una contraseña almacenada. No se imprimieron hashes ni credenciales.

## Intervención autorizada

Se creó private-backups/landsis-pre-006-1792694769674.dump (43 573 bytes).
Se verificaron catálogo del archivo, lectura completa mediante pg_restore sin
ejecutar SQL, y SHA-256. El manifiesto privado .dump.verification.json conserva
la evidencia. No se restauró ni recreó ninguna base de datos.

Se aplicó exclusivamente ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ,
el cambio de database/006_soft_delete_users.sql, dentro de una transacción con
lock_timeout=5s y statement_timeout=30s. Se mantuvo el backend en ejecución para
preservar sesiones en memoria; un bloqueo breve de users protegió la verificación.
La comparación dentro de la misma transacción confirmó que todos los datos
existentes de las tablas públicas permanecieron iguales, excluyendo únicamente
la nueva columna. Conteos al comprobar: 4 usuarios, 3 roles, 1 nodo,
1142 lecturas y 1 token de recuperación. Todos los deleted_at quedaron NULL.
La contraseña y credential_version del administrador coincidían antes y después.

No se cambiaron archivos de aplicación, contraseñas, estados de usuarios, Gmail,
firmware ni telemetría. Los scripts de diagnóstico quedaron en backend/tmp,
ignorado por Git; el respaldo está en private-backups, también ignorado.

## Comprobación posterior

La consulta de usuarios ya funciona. En el proceso principal: health 200,
auth/me sin sesión 401, lecturas sin sesión 401 y login sintético inexistente 401
(antes 503). En una instancia diagnóstica temporal sobre la base real, solo de
lectura y con una sesión propia: auth/me, nodes, readings?limit=1 y readings/latest
respondieron 200; la revocación de esa sesión respondió 401.

No se conoce ni se solicitó la contraseña del administrador: no se realizó un
login positivo con su contraseña real. La confirmación final consiste en volver a
iniciar sesión desde el frontend con las credenciales habituales. No se envió
correo real; recuperación, roles y eliminación se verifican mediante pruebas
automatizadas con datos sintéticos y PostgreSQL temporal separado.

Resultados finales: backend npm test, compilación TypeScript y 240/240 pruebas
correctas sin omisiones; frontend npm test, 28/28 correctas, y npm run build
TypeScript/Vite correcto. Incluyen login/logout, roles, recuperación, eliminación
lógica, concurrencia y lecturas. Registro de backend: backend/tmp/login-repair-tests.log.
