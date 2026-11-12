# Estado de migración de PostgreSQL

El 6 de noviembre de 2026, a las 12:29:37 de Guatemala, se tomó una instantánea de la base `landsis`. El destino se obtuvo de la configuración privada del backend y se confirmó mediante una conexión local de Windows. El servidor y `pg_dump` eran PostgreSQL 17.11. La conexión de inventario usó una transacción de solo lectura y exportó la misma instantánea que usó `pg_dump -Fc` para toda la base.

## Inventario y cotejo de la restauración

| Tabla | Origen en la instantánea | Restauración temporal |
| --- | ---: | ---: |
| `public.inclination_email_state` | 1 | 1 |
| `public.nodes` | 1 | 1 |
| `public.password_reset_tokens` | 1 | 1 |
| `public.roles` | 3 | 3 |
| `public.sensor_readings` | 2.433 | 2.433 |
| `public.users` | 5 | 5 |

El único nodo tiene lecturas. Hay tres cuentas activas y dos eliminadas lógicamente. Por rol de aplicación, hay una cuenta activa de administración, dos activas de CONRED y dos de investigación eliminadas lógicamente.

## Estructuras de las migraciones

| Migración | Evidencia en el catálogo del origen |
| --- | --- |
| 001 | `sensor_readings` con identidad, clave primaria, fecha de recepción y restricciones de nodo y rango RAW. |
| 002 | Siete columnas opcionales de MPU y restricción validada de bloque completo o ausente. |
| 003 | `nodes`, clave foránea desde `sensor_readings` e índice por nodo, fecha e ID. |
| 004 | `roles` y `users`, relación de rol, unicidad de correo y los tres roles de aplicación. |
| 005 | `users.credential_version` con valor inicial cero, `password_reset_tokens`, relación con borrado en cascada, vigencia de 15 minutos e índice por expiración. |
| 006 | `users.deleted_at` de tipo `timestamp with time zone` y admisión de nulos. |
| 007 | `inclination_email_state` con relaciones a nodo y lecturas, estado de entrega y restricciones de contadores. |

Se comprobaron las estructuras existentes sin ejecutar migraciones.

## Archivo verificado

- Archivo `private-backups/landsis-pre-vps-preliminar-20261106T182937Z.dump`.
- Tamaño de **78.249 bytes**.
- SHA-256 `a7cc4cbb412b7d972f7bd2a52ec18d75eb48c45ce88a89e5d3f60ae63f101c6c`.
- `pg_restore --list` y la lectura completa con `pg_restore --exit-on-error --file=NUL` finalizaron correctamente.
- El ensayo restauró el archivo en una base vacía de un clúster temporal independiente de PostgreSQL 17 en Windows. Coincidieron los conteos de las seis tablas, las columnas, las restricciones, los índices, las secuencias, el rango de lecturas y los agregados de roles y nodos.
- El ensayo usó `--no-owner --no-privileges`. Los propietarios y permisos de producción deberán verificarse en el VPS. El dump conserva los metadatos del volcado original.

## Estado para el corte

El archivo está listo para transferirse al VPS como respaldo preliminar verificado. Debe conservarse en un directorio privado y comprobarse su SHA-256 en destino. A las 12:31:46 de Guatemala no se observaron nuevos IDs de lectura desde la instantánea. Como no hubo una pausa coordinada de escrituras, queda pendiente tomar el respaldo final después de detenerlas y cotejar la restauración en destino antes de activar la recepción.

## Revisión antes del corte definitivo

El 6 de noviembre de 2026 a las 13:43:53 de Guatemala, el backend local respondió en el puerto 3000 y el listener correspondía a `node.exe`, PID 13848. PostgreSQL 17.11 seguía operativo. La última lectura persistida fue la ID 2433, recibida el 3 de noviembre a las 23:26:08 de Guatemala. El conteo se mantuvo en 2.433 durante la comprobación.

La comparación con el respaldo preliminar se hizo en una instantánea de solo lectura. Coincidieron el esquema, las filas de las seis tablas y los valores de las tres secuencias. La comparación de filas incluyó cambios que no alteran conteos, como una modificación de usuario. No se observaron otras sesiones de cliente conectadas a `landsis` al inicio y al cierre de la comprobación.

El backend es el escritor identificado. Puede insertar lecturas y nodos, administrar usuarios y recuperaciones, y actualizar el estado de avisos. El ESP32 escribe a través del backend. Una consola administrativa, un cliente SQL o un script con permisos también podrían escribir al conectarse. El servicio PostgreSQL debe seguir activo para generar el respaldo.

### Pausa local y respaldo final completados

1. Obtener autorización explícita para la pausa. Coordinar que nadie use el dashboard para cambios de usuarios o recuperación, ni ejecute scripts o consultas de escritura. Mantener cerrado el POST público en el VPS.
2. Identificar de nuevo el listener con `Get-NetTCPConnection -LocalPort 3000 -State Listen`. Detener el backend desde su consola de inicio con `Ctrl+C`, o mediante el mecanismo de parada de su supervisor si lo hubiera. Dejar que terminen las solicitudes en curso antes de detenerlo. Verificar que el listener desapareció y no se relanza. Mantener detenido cualquier escritor hasta cerrar el corte.
3. Revisar `pg_stat_activity` y comprobar que no quedan sesiones escritoras o transacciones pendientes en `landsis`. Repetir el inventario. Con las credenciales privadas que usa el backend, ejecutar `pg_dump -Fc` para toda la base desde PostgreSQL 17 con un nombre nuevo `landsis-pre-vps-final-<UTC>.dump` dentro de `private-backups/`. Usar un archivo parcial durante el volcado y promoverlo solo tras las verificaciones.
4. Verificar con `pg_restore --list`, `pg_restore --exit-on-error --file=NUL` y `Get-FileHash -Algorithm SHA256`. Cotejar esquema, conteos, secuencias y contenido con la instantánea del origen. Ensayar la restauración final en un clúster independiente. Registrar los seis conteos, el último ID, el tamaño y el SHA-256 junto con el nombre final. El respaldo preliminar se conserva.

Con la pausa autorizada se verificó la identidad del proceso en el puerto 3000 y que no tenía conexiones activas. Se detuvo con Ctrl+C. PostgreSQL siguió activo, sin otras sesiones de cliente ni transacciones preparadas en `landsis` al comprobar la pausa. El backend local quedó detenido.

- Dump final `private-backups/landsis-pre-vps-final-20261106T195226Z.dump`, tomado el 6 de noviembre de 2026 a las 13:52:26 de Guatemala. Tamaño de **78.249 bytes**.
- SHA-256 `6d0fb986c9f4ab93d6d088703d825c0178810691dd6808c9e2e4b25fe09ebe45`.
- El listado, la lectura completa y el ensayo en un clúster PostgreSQL 17.11 independiente finalizaron correctamente. Coincidieron esquema, filas, conteos y las tres secuencias. Los seis conteos de la tabla de inventario se mantienen, con lecturas de ID `1` a `2433`.
- Los últimos valores de las secuencias fueron `roles_id_seq = 3`, `sensor_readings_id_seq = 2433` y `users_id_seq = 5`. El origen seguía coincidiendo después del ensayo. Se conservaron los respaldos anteriores.

### Transferencia privada al VPS

Desde PowerShell en el equipo de origen, usar el destino SSH que ya funciona.

```powershell
$file = 'landsis-pre-vps-final-20261106T195226Z.dump'
$vps = Read-Host 'Destino SSH, usuario@host o alias'
$dump = (Resolve-Path -LiteralPath (Join-Path 'private-backups' $file)).Path
$expected = '6d0fb986c9f4ab93d6d088703d825c0178810691dd6808c9e2e4b25fe09ebe45'
$hash = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $expected -or (Get-Content -LiteralPath "$dump.sha256").Trim() -cne "$expected  $file") {
  throw 'El SHA-256 o su archivo de verificación no coincide'
}
ssh $vps 'umask 077; mkdir -p "$HOME/landsis-cutover" && chmod 700 "$HOME/landsis-cutover"'
if ($LASTEXITCODE -ne 0) { throw 'Falló la preparación del directorio privado' }
scp -- $dump "$dump.sha256" "${vps}:landsis-cutover/"
if ($LASTEXITCODE -ne 0) { throw 'Falló la transferencia' }
```

### Restauración en Ubuntu

Ejecutar desde una sesión SSH propia. Se reutiliza `landsis_owner` tal como existe y se crea una base nueva `landsis_prod`, separada de `landsis_restore_check`. El bloque se detiene si falta `landsis_owner`, si tiene privilegios elevados o si `landsis_prod` o `landsis_app` ya existen. Mantener el backend del VPS fuera de servicio durante esta etapa si ya estaba activo.

```bash
set -euo pipefail
umask 077
cd "$HOME/landsis-cutover"
dump=landsis-pre-vps-final-20261106T195226Z.dump
chmod 600 "$dump" "$dump.sha256"
sha256sum --check --strict "$dump.sha256"
pg_restore --list "$dump" >/dev/null
pg_restore --exit-on-error --file=/dev/null "$dump"

sudo -u postgres psql -X -v ON_ERROR_STOP=1 -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_roles r WHERE r.rolname = 'landsis_owner'
      AND NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls)
      AND NOT EXISTS (SELECT FROM pg_auth_members m WHERE m.member = r.oid)
  ) THEN
    RAISE EXCEPTION 'landsis_owner debe existir sin privilegios elevados ni membresías';
  END IF;
  IF EXISTS (SELECT FROM pg_database WHERE datname = 'landsis_prod')
     OR EXISTS (SELECT FROM pg_roles WHERE rolname = 'landsis_app') THEN
    RAISE EXCEPTION 'landsis_prod o landsis_app ya existe. Revisar antes de continuar.';
  END IF;
END $$;
BEGIN;
CREATE ROLE landsis_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
COMMIT;
SQL

sudo -u postgres psql -X -v ON_ERROR_STOP=1 -d postgres \
  -c "SET password_encryption = 'scram-sha-256'" -c '\password landsis_app'
sudo -u postgres createdb --owner=landsis_owner --template=template0 \
  --encoding=UTF8 landsis_prod
sudo -u postgres pg_restore --dbname=landsis_prod --role=landsis_owner \
  --no-owner --no-privileges --exit-on-error --single-transaction < "$dump"

sudo -u postgres psql -X -v ON_ERROR_STOP=1 -d landsis_prod <<'SQL'
BEGIN;
SET ROLE landsis_owner;
REVOKE ALL ON DATABASE landsis_prod FROM PUBLIC;
GRANT CONNECT ON DATABASE landsis_prod TO landsis_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO landsis_app;
GRANT SELECT ON public.roles TO landsis_app;
GRANT SELECT, INSERT ON public.nodes, public.sensor_readings TO landsis_app;
GRANT SELECT, INSERT, UPDATE ON public.users, public.inclination_email_state TO landsis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_tokens TO landsis_app;
GRANT USAGE ON SEQUENCE public.sensor_readings_id_seq, public.users_id_seq TO landsis_app;
COMMIT;
SQL

sudo -u postgres psql -X -v ON_ERROR_STOP=1 -d landsis_prod <<'SQL'
SELECT 'inclination_email_state' AS tabla, count(*) AS filas FROM public.inclination_email_state
UNION ALL SELECT 'nodes', count(*) FROM public.nodes
UNION ALL SELECT 'password_reset_tokens', count(*) FROM public.password_reset_tokens
UNION ALL SELECT 'roles', count(*) FROM public.roles
UNION ALL SELECT 'sensor_readings', count(*) FROM public.sensor_readings
UNION ALL SELECT 'users', count(*) FROM public.users;
SELECT min(id) AS primer_id, max(id) AS ultimo_id FROM public.sensor_readings;
SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename;
SQL
```

Cotejar la salida con el inventario del **dump final** antes de apuntar el backend a la nueva base. El volcado ya contiene las estructuras 001–007. `landsis_app` puede actualizar `users`, lo que también permite el bloqueo que usa el backend para proteger la administración de usuarios. Los objetos restaurados pertenecen a `landsis_owner`. [PostgreSQL 17 sobre restauración y cambio de rol](https://www.postgresql.org/docs/17/app-pgrestore.html), [privilegios de bloqueo](https://www.postgresql.org/docs/17/sql-lock.html).

Comprobar que `pg_hba.conf` permita la conexión `host landsis_prod landsis_app 127.0.0.1/32 scram-sha-256` antes de cualquier rechazo aplicable. Si hace falta, editar únicamente esa regla y recargar. Mantener PostgreSQL en loopback.

```bash
sudo -u postgres psql -X -At -d postgres -c 'SHOW hba_file'
# Solo si falta la regla, abrir el archivo indicado y agregarla en el orden correcto.
sudoedit "$(sudo -u postgres psql -X -At -d postgres -c 'SHOW hba_file')"
test "$(sudo -u postgres psql -X -At -d postgres \
  -c 'SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL')" = 0
sudo systemctl reload postgresql
psql -X -W -h 127.0.0.1 -p 5432 -U landsis_app -d landsis_prod \
  -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM public.sensor_readings'
```

### Aceptación del backend

1. Editar `/etc/landsis/backend.env` con `sudoedit`. Configurar `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGDATABASE=landsis_prod`, `PGUSER=landsis_app` y la contraseña privada. Conservar el resto de la configuración operativa. Comprobar propietario `root:root` y modo `0600`.
2. Ejecutar `sudo nginx -t`, `sudo systemctl restart landsis` y `curl -fsS http://127.0.0.1:3000/health`. Conservar el POST público cerrado. En el navegador, abrir el dominio HTTPS e iniciar sesión con una cuenta activa restaurada. Abrir el historial y comprobar una lectura conocida del inventario. Probar también que el historial sin sesión devuelve `401`. `/health` solo confirma que escucha el proceso.
3. Con el ESP32 disponible, validar TLS y autenticación en un acceso de ensayo restringido. Tras aceptarlo, habilitar recepción en Nginx y comprobar un `201` de una lectura real. En la base `landsis_prod`, consultar el nuevo ID y confirmar que aparece en el historial. Una segunda sesión SQL debe ver la fila confirmada. La prueba queda pendiente hasta disponer del nodo.

```bash
sudo -u postgres psql -X -d landsis_prod -v ON_ERROR_STOP=1 \
  -c 'SELECT id, received_at FROM public.sensor_readings ORDER BY id DESC LIMIT 1'
```

Si falla la aceptación, conservar ambos respaldos y mantener cerrada la recepción. Si el VPS ya recibió escrituras, respaldarlo y cotejar esas escrituras antes de reabrir el origen para evitar dos historiales divergentes.
