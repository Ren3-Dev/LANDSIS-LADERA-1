# Incremento 5 — Preparación de PostgreSQL, sin aplicar 005

> Informe histórico de preparación. Posteriormente el usuario autorizó la
> aplicación controlada, completada el 18 de octubre de 2026. Véase el
> [informe de ejecución](aplicacion-controlada-migracion-005.md).

## Estado verificado

Inspección y respaldo del 17 de octubre de 2026, 23:46 (America/Guatemala).
Se cargó la configuración existente del backend respetando la precedencia del
entorno, sin imprimir ni modificar contraseñas, `.env` o credenciales.

| Dato | Resultado |
|---|---|
| Base real conectada | landsis |
| Host / puerto | localhost / 5432 (conexión observada a ::1) |
| Usuario de conexión | postgres |
| PostgreSQL / pg_dump / pg_restore | 17.11 |
| users | Existe; 4 filas al inspeccionar |
| roles | Existe; 3 filas: ADMINISTRADOR, INVESTIGADOR, CONRED |
| sensor_readings | Existe; 1018 filas al inspeccionar |
| Migración 004 | Esquema equivalente presente: columnas, nulabilidad, PK, correo único/normalizado, FK de rol y restricciones de roles |
| Migración 005 | Pendiente: no existe users.credential_version ni password_reset_tokens |

El repositorio usa scripts SQL sin historial de migraciones en una tabla de
control. La confirmación de 004 corresponde al esquema real y sus restricciones;
no demuestra el historial del comando concreto que lo creó. La inspección se
realizó con default_transaction_read_only=on en su propia conexión. No se
consultaron ni mostraron hashes, correos de usuarios o contraseñas.

## Respaldo generado y verificado

Archivo custom completo de la base (sin filtros de tablas ni esquemas):

```text
C:\Users\Augus\Documents\LANDSIS-LADERA-1\private-backups\landsis-pre-005-20261017234643-24148.dump
```

- pg_dump: código de salida 0.
- Archivo existente: 37178 bytes.
- pg_restore --list: código de salida 0; 23 entradas de catálogo.
- Se comprobó la presencia de TABLE DATA para users, roles y sensor_readings.
- SHA-256, también verificado mediante Get-FileHash:
  `b57d2e059de54277f2a28660c1f7716556970e395602c24ac88e73896f5ad2d5`.
- Catálogo: mismo nombre con sufijo `.list.txt`.
- Manifiesto de inspección/integridad: mismo nombre con sufijo `.manifest.json`.

La carpeta está fuera de frontend y de los directorios públicos de la aplicación;
el backend no la sirve. Se añadió `/private-backups/` a `.gitignore` y se comprobó
que archivo, catálogo y manifiesto están ignorados y no versionados. Hereda los
permisos locales del proyecto; no se cambiaron ACL ni se cifró el archivo.

**La lectura del catálogo no es una prueba de restauración.** No se restauró el
respaldo, ni se validaron todos sus bloques de datos o la disponibilidad de cada
dependencia durante una restauración. El checksum detecta cambios posteriores,
no prueba la corrección lógica de los datos. pg_dump obtiene una instantánea
consistente, pero las cantidades inspeccionadas antes no necesariamente reflejan
escrituras concurrentes posteriores. Este respaldo lógico de una base no incluye
la creación de roles globales/tablespaces del clúster, archivos de configuración,
credenciales SMTP ni archivos del proyecto. Fuente: [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html)
y [pg_restore 17](https://www.postgresql.org/docs/17/app-pgrestore.html).

El respaldo contiene datos reales y hashes de autenticación. No publicarlo ni
adjuntarlo a Git. Está en el mismo disco que el proyecto: no sustituye una copia
independiente ante pérdida del disco. No se creó otra copia ni se cambió ninguna
política de acceso.

## Revisión completa de 005

Se revisó íntegramente `database/005_create_password_resets.sql`. Su SHA-256 al
preparar este plan es:
`31347bea50c53ffa71b6b6ab24ba3fef5a7250bf09f3582f3e1149f81b7d8caa`.

En una transacción BEGIN/COMMIT:

1. Agrega users.credential_version INTEGER NOT NULL DEFAULT 0, con CHECK >= 0.
   Los usuarios existentes tendrán versión lógica inicial cero; sus hashes,
   identidades, roles y estado se conservan.
2. Crea password_reset_tokens con user_id como PK y FK a users(id), hash de token
   TEXT único y restringido a 64 caracteres hexadecimales minúsculos, created_at
   y expires_at TIMESTAMPTZ NOT NULL y duración exacta de quince minutos.
3. La FK usa ON DELETE CASCADE: solo borraría tokens dependientes si en el futuro
   se eliminara un usuario. Ejecutar la migración no elimina usuarios ni tokens.
4. Crea el índice de expires_at; PK/UNIQUE crean sus índices correspondientes.

No contiene DROP, DELETE, TRUNCATE, UPDATE de filas existentes ni operaciones
sobre sensor_readings o nodes. Es aditiva y no destructiva respecto de los datos
actuales. No es idempotente: no ejecutarla de nuevo si ya se aplicó.

## Plan de aplicación — requiere autorización explícita

**Estos comandos se presentan para una fase posterior. No se han ejecutado.**

1. Elegir una ventana de mantenimiento. Detener el backend y comandos de
   administración; no detener ni modificar el firmware. La recepción quedará
   temporalmente indisponible mientras el backend esté detenido. No prometer
   recuperación de mediciones que el nodo no haya podido transmitir.
2. Confirmar que el respaldo siga disponible y que no haya cambios de esquema
   o datos relevantes desde su creación. Si pasó tiempo, generar un respaldo
   nuevo antes de aplicar, sin sobrescribir el actual.
3. En PowerShell, comprobar integridad y aplicar una sola vez, con límites de
   espera. La contraseña se solicita interactivamente; no se escribe en el comando:

```powershell
Set-Location 'C:\Users\Augus\Documents\LANDSIS-LADERA-1'
$landsisPgBin = 'C:\Program Files\PostgreSQL\17\bin'
$landsisBackup = Join-Path (Get-Location) 'private-backups\landsis-pre-005-20261017234643-24148.dump'
$landsisMigration = Join-Path (Get-Location) 'database\005_create_password_resets.sql'
if ((Get-FileHash -LiteralPath $landsisBackup -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'b57d2e059de54277f2a28660c1f7716556970e395602c24ac88e73896f5ad2d5') { throw 'El respaldo cambió. Detener y revisar.' }
if ((Get-FileHash -LiteralPath $landsisMigration -Algorithm SHA256).Hash.ToLowerInvariant() -ne '31347bea50c53ffa71b6b6ab24ba3fef5a7250bf09f3582f3e1149f81b7d8caa') { throw 'La migración cambió. Revisar de nuevo.' }
& "$landsisPgBin\pg_restore.exe" --list $landsisBackup
if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el catálogo del respaldo.' }

# SOLO DESPUÉS DE AUTORIZACIÓN EXPLÍCITA:
& "$landsisPgBin\psql.exe" -X --host=localhost --port=5432 --username=postgres --dbname=landsis --password --set=ON_ERROR_STOP=1 --command="SET lock_timeout='5s'; SET statement_timeout='60s';" --file=$landsisMigration
if ($LASTEXITCODE -ne 0) { throw 'Migración fallida. Mantener backend detenido y revisar el esquema.' }
```

4. Verificar mediante consultas de solo lectura en esa misma base:

```sql
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='users' AND column_name='credential_version';
SELECT count(*) AS users_total,
       count(*) FILTER (WHERE credential_version = 0) AS version_zero,
       count(*) FILTER (WHERE credential_version < 0) AS invalid_versions
FROM users;
SELECT count(*) AS reset_tokens FROM password_reset_tokens;
SELECT count(*) AS roles_total FROM roles;
SELECT count(*) AS readings_total FROM sensor_readings;
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid='password_reset_tokens'::regclass;
```

   Esperado sin actividad concurrente desde este respaldo: 4 usuarios, todos con
   versión 0; 3 roles; 1018 mediciones; 0 tokens. Comparar con la línea base más
   reciente si se generó otro respaldo. Confirmar PK/FK/UNIQUE/CHECK, no limitarse
   a que exista la tabla. No consultar hashes o datos personales para esta revisión.
5. Compilar/iniciar el backend con la configuración actual. Verificar login y
   restauración de sesión con la interfaz normal, sin modificar contraseñas.
   Mantener Gmail/RECOVERY_EMAIL_ENABLED y alertas sin activar. No realizar
   solicitudes reales de recuperación como parte de esta aplicación de esquema.

## Reversión y restauración — plan, no ejecución

- Si falla antes de COMMIT, ON_ERROR_STOP hace terminar psql y la conexión
  cerrada revierte la transacción abierta. Confirmar el estado del catálogo antes
  de repetir. Si se pierde la conexión al confirmar, el resultado puede ser
  incierto: inspeccionar primero, nunca repetir ciegamente.
- Si 005 se confirma pero falla la aplicación, mantener el esquema aditivo y
  evaluar reparar/revertir el código compatible antes de tocar datos. No ejecutar
  DROP COLUMN/TABLE ni restaurar encima de landsis como reacción automática.
- Si se necesita restaurar, hacerlo primero en una base NUEVA, conservando
  landsis intacta. Este paso también necesita autorización posterior. Ejemplo:

```powershell
# SOLO PARA UNA RESTAURACIÓN POSTERIOR AUTORIZADA; no ejecutado.
$landsisRestoreDb = 'landsis_restore_pre005_20261017'
& "$landsisPgBin\createdb.exe" --host=localhost --port=5432 --username=postgres --password --template=template0 $landsisRestoreDb
if ($LASTEXITCODE -ne 0) { throw 'No se creó la base nueva; no continuar.' }
& "$landsisPgBin\pg_restore.exe" --host=localhost --port=5432 --username=postgres --password --dbname=$landsisRestoreDb --exit-on-error --single-transaction $landsisBackup
if ($LASTEXITCODE -ne 0) { throw 'Restauración no validada; conservar ambas bases y revisar.' }
```

Verificar allí tablas, restricciones, secuencias, conteos y acceso mediante una
instancia separada del código compatible con el esquema anterior a 005. El
backend actual requiere 005: no apuntarlo sin más a esa copia previa. Solo tras
validar y recibir autorización decidir cambio de destino/versión o reaplicación
de 005 a la copia. No se proporcionan comandos para borrar/sobrescribir la base
principal. Restaurar una instantánea anterior omitiría escrituras posteriores;
preservar/comparar los datos nuevos de la base original antes de cualquier cambio.

## Riesgos detectados y cierre

- ALTER TABLE necesita bloqueo ACCESS EXCLUSIVE sobre users; sesiones o
  transacciones abiertas pueden retrasarlo. Se limita la espera y se propone
  una ventana de mantenimiento. [Documentación ALTER TABLE 17](https://www.postgresql.org/docs/17/sql-altertable.html).
- El usuario configurado es postgres; se confirmó rolsuper=true, por lo que
  opera como superusuario y el alcance de sus privilegios es amplio.
  No se modificaron roles ni credenciales en este incremento.
- El código actual depende de 005 para autenticar; el esquema principal todavía
  no la tiene. No confundir health 200 con disponibilidad de autenticación.
- Respaldo no restaurado, no cifrado, misma unidad de disco y permisos heredados.
- pg_dump no incluye objetos globales ni archivos externos. La tabla roles del
  sistema LANDSIS sí está dentro del archivo.

Cambios efectuados: regla de exclusión en `.gitignore`, este plan y archivos
privados de respaldo/inspección. El auxiliar de inspección permanece ignorado en
backend/tmp. No se modificó código de aplicación, frontend, firmware, telemetría,
datos, credenciales ni configuración SMTP. No se ejecutaron migraciones ni
pruebas de aplicación que pudieran crear clústeres/migraciones de prueba.

**Estado final: respaldo verificado por catálogo; 005 pendiente de autorización.**
