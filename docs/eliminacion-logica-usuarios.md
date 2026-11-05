# Eliminación lógica de usuarios

Archivos de esta tarea:

- backend/src/data/users.ts: consultas vigentes y eliminación transaccional.
- backend/src/auth/security.ts: endpoint y DELETE JSON sin cuerpo.
- backend/src/data/password-resets.ts: excluir eliminados en emisión, consumo y reset local.
- backend/src/auth/bootstrap.ts: excluir administradores eliminados.
- database/006_soft_delete_users.sql: columna deleted_at.
- frontend/src/components/UsersPanel.tsx: botón y diálogo nativo de confirmación.
- backend/tests/users-store.test.cjs: bloqueo, conflictos y rollback.
- backend/tests/reset-password.test.cjs: expectativa del filtro de eliminación.
- backend/tests/password-recovery-postgres.test.cjs: migración e integración real aislada.
- frontend/tests/auth.test.tsx: contrato DELETE/204.
- docs/eliminacion-logica-usuarios.md: despliegue y comprobación.

Había cambios previos sin confirmar al iniciar; esta lista identifica el alcance añadido
por esta tarea y no representa todos los cambios pendientes del repositorio.

DELETE /api/v1/users/:id reutiliza sesión, rol ADMINISTRADOR y protección de mutaciones
(X-Landsis-Request: 1 y Content-Type: application/json). No requiere cuerpo.
Responde 204 sin contenido; 401 sin sesión, 403 sin permiso/cabecera,
404 para cuentas inexistentes o eliminadas y 409 para autoeliminación o último
administrador activo. Un identificador inválido produce 400 y un fallo de persistencia 503.

## Migración y despliegue

Aplicar manualmente database/006_soft_delete_users.sql una sola vez, después de 005,
con el backend detenido y un respaldo verificado según el procedimiento del entorno.
Después desplegar backend y frontend juntos. El código depende de deleted_at;
no arrancar la nueva versión antes de migrar. La migración agrega una columna nullable
y no elimina filas. No se ha aplicado contra la base real durante esta tarea.

active conserva su significado de habilitación; deleted_at indica eliminación.
Los correos continúan reservados por la restricción UNIQUE existente.
No se ofrece restauración ni reutilización de correos.

La transacción usa el mismo bloqueo SHARE ROW EXCLUSIVE de PATCH/bootstrap:
serializa cambios de estado, rol y eliminación antes de contar administradores activos
no eliminados. Puede retrasar brevemente otras escrituras de usuarios/recuperación.
Incrementa credential_version y elimina enlaces pendientes en la misma transacción.
La consulta por id/correo excluye eliminados: cada nueva petición autenticada se rechaza,
incluso en otros procesos con sesiones en memoria. Una petición ya autorizada antes de
confirmar la eliminación puede terminar; no se cancelan trabajos en curso.
La recuperación revalida deleted_at bajo bloqueo, tanto al emitir como al consumir.
Los usuarios y referencias históricas permanecen; no se modifica telemetría ni firmware.

## Comprobación manual (cuentas de prueba)

1. Aplicar 004, 005 y 006 en una base de prueba; iniciar backend y frontend.
2. Iniciar sesión como administrador; crear otra cuenta y entrar con ella en otro navegador.
3. En Usuarios, elegir Eliminar: comprobar nombre/correo y Cancelar sin cambios.
4. Confirmar Eliminar: comprobar estado de carga, respuesta 204, mensaje y listado actualizado.
5. En el otro navegador consultar auth/me o telemetría: debe responder 401.
   Login con las credenciales eliminadas debe responder 401. Recuperación conserva
   respuesta genérica sin emitir un enlace utilizable; un enlace previo debe fallar.
6. Intentar autoeliminación: 409 y mensaje visible. Repetir DELETE de la cuenta eliminada: 404.
7. Con INVESTIGADOR/CONRED no aparece Usuarios; DELETE directo responde 403.
   Sin sesión responde 401. Omitir la cabecera con sesión administrativa: 403.
8. Comprobar creación/edición, login/logout, recuperación de una cuenta vigente y consulta
   de nodos/mediciones. Comprobar en SQL que la fila eliminada existe con deleted_at.

## Pruebas automatizadas

backend: npm test (incluye compilación). frontend: npm test y npm run build.
La integración PostgreSQL usa un cluster temporal propio, nunca PGDATABASE del entorno.
Requiere initdb/pg_ctl (LANDSIS_TEST_PG_BIN si no están en la ruta prevista) y conexiones
locales permitidas. Incluye competencia DELETE/PATCH por los últimos administradores,
autorización, revocación, recuperación, retención de fila y exclusión del listado.
SMTP es simulado: no envía Gmail real ni activa correos de alerta.
El cliente tiene una prueba de DELETE/204 y cabeceras; la interacción visual del diálogo
se comprueba con el procedimiento manual anterior.

Resultado de ejecución (22 de octubre de 2026): backend npm test, 240/240 correctas,
sin omisiones, incluida integración PostgreSQL y concurrencia; frontend npm test,
28/28 correctas; compilaciones backend TypeScript y frontend TypeScript/Vite correctas.
La primera ejecución dentro del sandbox falló por EACCES al conectar a localhost;
la ejecución final con permiso de conexiones locales terminó correctamente.
git diff --check no encontró errores de espacios. No se ejecutó la comprobación visual
manual ni un envío real por Gmail.
