# Aplicación controlada de la migración 005

Fecha: 18 de octubre de 2026, America/Guatemala. Ejecutada tras autorización
explícita del usuario y verificación satisfactoria de sus precondiciones.

## Respaldo y restauración previa

Se verificó de nuevo el SHA-256 del respaldo original, sin sobrescribirlo:

```text
private-backups/landsis-pre-005-20261017234643-24148.dump
b57d2e059de54277f2a28660c1f7716556970e395602c24ac88e73896f5ad2d5
```

Se creó una base separada mediante TEMPLATE template0 en PostgreSQL local:
`landsis_restore005_verify_20261018000024_15780`.
Se restauró con pg_restore 17.11, `--exit-on-error --single-transaction`, código 0.
Las consultas confirmaron 4 usuarios, 3 roles y 1018 mediciones. Esa copia aún no
contiene 005; la base principal no fue modificada durante esta verificación.
La base temporal se conserva para inspección: no se eliminó ni se restauró encima
de landsis. No se consultaron/imprimieron contraseñas o filas personales.

Además de los conteos, se compararon resúmenes del contenido completo de users,
roles y sensor_readings entre la copia restaurada y la base principal. Coincidieron.
La comparación de users excluye únicamente credential_version para permitir
verificar el contenido anterior y posterior a la adición de esa columna.

Esto sí prueba que el archivo pudo restaurarse y que esos datos coinciden en
este entorno PostgreSQL local. No equivale a garantizar toda restauración futura,
otro equipo, otra versión o recuperación ante pérdida del disco. Se conserva la
limitación de que pg_dump no contiene roles globales/configuración externa.

## Precondiciones y ejecución

- La configuración efectiva correspondía a landsis en localhost:5432.
- El backend ya estaba detenido: puerto 3000 libre y sin procesos candidatos
  Node/tsx de servidor. No fue necesario terminar procesos del usuario.
- Se confirmaron cero otras sesiones cliente activas/transacciones abiertas y
  cero bloqueos de escritura de otros procesos sobre la base.
- No existían credential_version ni password_reset_tokens.
- El contenido de las tres tablas seguía coincidiendo con la copia restaurada.
- Se verificó el SHA-256 de 005 revisada:
  `31347bea50c53ffa71b6b6ab24ba3fef5a7250bf09f3582f3e1149f81b7d8caa`.

Se ejecutó una sola vez psql 17.11 con `-X`, `ON_ERROR_STOP=1`,
`lock_timeout=5s`, `statement_timeout=60s` y el archivo original
`database/005_create_password_resets.sql`. Se respetaron su BEGIN/COMMIT, sin
agregar otra transacción alrededor. Código de salida: 0.

## Verificación del esquema y conservación

| Elemento | Resultado |
|---|---|
| users.credential_version | INTEGER, NOT NULL, DEFAULT 0 |
| Versiones de usuarios existentes | Todas en 0 |
| password_reset_tokens | Existe y tiene 0 filas |
| PK | password_reset_tokens_pkey |
| UNIQUE | password_reset_tokens_token_hash_key |
| FK a users con cascada | password_reset_tokens_user_id_fkey |
| CHECK del hash | password_reset_tokens_token_hash_check |
| CHECK de duración exacta | password_reset_tokens_lifetime |
| CHECK de versión no negativa | users_credential_version_nonnegative |
| Índices válidos | PK, UNIQUE y password_reset_tokens_expires_idx |
| Usuarios / roles / mediciones | 4 / 3 / 1018 |
| Contenido previo de las filas | Igual antes y después |
| Respaldo original | SHA-256 intacto |

Las seis restricciones se verificaron validadas y los tres índices, válidos.
No se cambiaron contraseñas, roles, estado de usuarios o valores de telemetría.

## Servicio y comprobaciones HTTP

Se compiló el backend TypeScript/CommonJS y se inició `backend/dist/server.js`
en segundo plano con ventana oculta. PID al iniciar: 8848. Puerto: 3000.
RECOVERY_EMAIL_ENABLED=false se mantuvo explícitamente para ese proceso; no se
modificó `.env`, credenciales SMTP ni configuración persistente.
Los registros de arranque están en private-backups/backend-post005.stdout.log
y backend-post005.stderr.log, ignorados por Git.

Contra el servicio real:

- GET /health: 200, status ok.
- GET /api/v1/auth/me sin sesión: 401.
- GET /api/v1/readings sin sesión: 401.
- POST /api/v1/auth/login con cuenta/contraseña sintéticas inexistentes: 401,
  mensaje uniforme. Se verificó acceso a PostgreSQL sin error de esquema.

Para comprobar lecturas autenticadas sin pedir ni usar una contraseña real,
se abrió una instancia diagnóstica adicional en un puerto local efímero. Usó
el código real, el usuario activo de la base y una sesión sintética en memoria
conocida únicamente por esa instancia. Su pool tenía default_transaction_read_only=on:

- /api/v1/auth/me, /api/v1/nodes, /api/v1/readings?limit=1 y
  /api/v1/readings/latest devolvieron 200 con los contratos esperados.
- La versión y el hash no aparecieron en el usuario público.
- La sesión diagnóstica se revocó y devolvió 401 después.
- La instancia diagnóstica y su pool se cerraron al terminar. No se incorporó
  ninguna sesión de prueba al backend principal ni se desplegó un bypass.

El login positivo con contraseña se verifica en la suite automatizada sobre
datos sintéticos aislados. No se inició sesión con una contraseña de una cuenta
real de landsis durante esta intervención.

## Pruebas finales

- `backend`: `npm.cmd run build` y `npm.cmd test`; compilación correcta,
  **231 pruebas aprobadas**, cero fallidas y cero omitidas. La suite vuelve a
  compilar y usa su clúster PostgreSQL sintético propio, nunca landsis.
- `frontend`: `npm.cmd test`; **27 pruebas aprobadas**, cero fallidas y cero
  omitidas, con solicitudes simuladas.
- Total: **258 pruebas aprobadas**. No se modificaron fuentes de aplicación.
- Al terminar las suites se repitió la verificación de datos de landsis:
  4 usuarios, 3 roles, 1018 mediciones, contenido previo conservado, versiones
  iniciales cero, tabla de tokens vacía y respaldo original intacto.
- Se volvió a consultar /health del backend principal: 200, status ok.
  Los clústeres de prueba de la suite quedaron detenidos. El backend principal
  permanece iniciado; la base de restauración previa se conserva separada.

## Evidencia y restricciones

El registro privado de las fases, conteos, comparación y restricciones está en
`private-backups/migration005-controlled-verification.json`. Los auxiliares
operativos permanecen ignorados en backend/tmp; no contienen secretos embebidos.
No se cambió código de aplicación, firmware, frontend ni cálculos de riesgo.
No se enviaron correos ni se activaron alertas. No se hizo ninguna restauración
destructiva ni se sobrescribió el respaldo original.

La consulta de procesos de Windows requirió lectura fuera del sandbox por falta
de acceso CIM dentro de él. La restauración, precondiciones, aplicación SQL y
verificación posterior no reportaron errores. No fue necesaria una corrección
del esquema ni de los datos.
