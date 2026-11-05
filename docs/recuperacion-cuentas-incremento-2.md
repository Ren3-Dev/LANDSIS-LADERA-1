# Recuperación de cuentas — Incremento 2

Implementa persistencia de tokens y revocación de sesiones. No agrega endpoints,
vistas, envíos de correo ni criterios de riesgo. El correo queda reservado para
recuperación y futura infraestructura de alertas; no se conectan notificaciones
independientes de cambio ni bienvenida. El módulo Nodemailer del incremento 1
permanece sin cambios.

## Diseño

- `createPasswordRecovery().issue(userId)` genera 32 bytes con `randomBytes`,
  devuelve el token hexadecimal solo al llamador y persiste su SHA-256.
  Devuelve `null` si el usuario no existe o está inactivo.
- `reset(token,password)` valida formato y política, deriva con el scrypt
  existente y delega el consumo transaccional. El resultado `false` cubre token
  inexistente, sustituido, expirado, usado o usuario inactivo. No crea sesión.
- La tabla contiene una fila por usuario, hash único y fechas TIMESTAMPTZ cuya
  diferencia debe ser exactamente quince minutos. El reloj es PostgreSQL.
- Emisión, consumo y reset local adquieren primero `ROW EXCLUSIVE` en users,
  después bloqueo de usuario y después modifican tokens. El bloqueo de tabla
  permite otras recuperaciones concurrentes y evita inversión de bloqueos con
  el `SHARE ROW EXCLUSIVE` existente en PATCH/bootstrap.
- El consumo vuelve a comprobar hash y `expires_at > clock_timestamp()` tras
  esperar el bloqueo. No usa la hora congelada de inicio de transacción.
- Borrar el token, cambiar hash e incrementar `credential_version` se confirma
  en una sola transacción; un error revierte todos esos cambios.
- El comando local conserva su interfaz, normalización, política y scrypt;
  ahora incrementa versión y elimina tokens pendientes atómicamente. No altera
  nombre, rol o estado: una cuenta inactiva permanece inactiva.

La sesión captura la versión interna de credenciales al iniciar sesión.
`requireAuth` compara esa versión con PostgreSQL en cada solicitud y rechaza
la cookie obsoleta con 401 y eliminación. Así también funciona un cambio desde
otro proceso CLI. La versión no se incluye en el JSON público y no cambia
el contrato, roles ni permisos. Un login concurrente que haya leído la versión
anterior no obtiene una sesión utilizable después del restablecimiento.
Las solicitudes que ya superaron autenticación antes del cambio pueden terminar;
no se cancelan operaciones en curso. El almacén de sesiones sigue en memoria.

## Aplicar la migración principal — pendiente de autorización

**No se ha aplicado a la base principal.** El código nuevo necesita la migración
005 antes de iniciar el backend contra esa base; sin ella las consultas de
usuarios fallarán. No desplegar el backend nuevo antes del esquema.

Después de recibir autorización:

1. Resguardar la base por el procedimiento local y detener todas las instancias
   del backend y comandos de administración.
2. Comprobar que 004 ya está aplicada (`users` y `roles` existentes) y que 005
   no se aplicó antes. El script no es idempotente; no repetirlo.
3. En PowerShell, desde la raíz, ejecutar con el host, puerto, nombre y usuario
   que realmente correspondan a la base destino. Este comando solicita datos
   sin leer ni mostrar el archivo `.env`; PostgreSQL pide la contraseña oculta:

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1
$landsisPsql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$landsisDbHost = Read-Host 'Host PostgreSQL'
$landsisDbPort = Read-Host 'Puerto PostgreSQL'
$landsisDbName = Read-Host 'Base destino'
$landsisDbUser = Read-Host 'Usuario PostgreSQL'
& $landsisPsql --host=$landsisDbHost --port=$landsisDbPort --dbname=$landsisDbName --username=$landsisDbUser --password --set=ON_ERROR_STOP=1 --file=database/005_create_password_resets.sql
if ($LASTEXITCODE -ne 0) { throw 'Migración fallida; no iniciar backend hasta revisar.' }
```

Si `psql` está en otra ubicación, sustituir únicamente esa ruta. La migración
incluye BEGIN/COMMIT; ON_ERROR_STOP detiene ante un error. No pasar contraseñas
como argumentos ni publicarlas. No aplicar 004 nuevamente a una base existente.

4. Verificar en la herramienta PostgreSQL conectada a esa misma base:

```sql
SELECT column_default, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='users' AND column_name='credential_version';
SELECT count(*) AS invalid_versions FROM users WHERE credential_version < 0;
SELECT count(*) AS reset_tokens FROM password_reset_tokens;
```

   Inicialmente: entero NOT NULL/default 0; cero versiones negativas y tabla de
   tokens vacía. No consultar ni exportar hashes de contraseña o de tokens.
5. Desde `backend`, ejecutar `npm.cmd run build` y arrancar el backend nuevo.
   Volver a iniciar sesión; el reinicio ya elimina todas las sesiones en memoria.
   Verificar login y `/api/v1/auth/me`. El comando local sigue siendo
   `npm.cmd run reset-password`, exclusivamente en una terminal interactiva.

No hay rollback automático: ante error de despliegue, mantener el servicio
detenido y revisar antes de revertir esquema o restaurar una copia.

## Pruebas

`npm.cmd test` desde backend compila en `backend/dist` (ignorado) y ejecuta la
regresión completa. Las pruebas unitarias usan dobles de persistencia.

`password-recovery-postgres.test.cjs` crea su propio CLUSTER en
`backend/tmp/recovery-pg-*`, con usuario/datos sintéticos, un puerto libre,
escucha exclusiva en 127.0.0.1 y autenticación trust solo en ese clúster.
No carga dotenv ni utiliza variables PG* o credenciales de la base principal.
Aplica 004/005 únicamente allí y detiene el servidor al terminar. Los archivos
de prueba permanecen ignorados para diagnóstico; el usuario puede retirarlos
con el servidor ya detenido. No contienen datos ni credenciales reales.

Busca binarios en `C:\Program Files\PostgreSQL\17\bin`; alternativamente:

```powershell
$env:LANDSIS_TEST_PG_BIN = 'C:\ruta\postgresql\bin'
npm.cmd test
```

Sin `initdb`/`pg_ctl`, el caso de integración se informa omitido. Si están
presentes y el clúster falla al iniciar, la prueba falla: no declara que verificó
concurrencia. En entornos Windows restringidos, pg_ctl puede necesitar ejecutar
las pruebas fuera del sandbox para crear su token de proceso restringido.

Se comprueban restricciones, sustitución/emisión concurrente, doble consumo,
expiración durante bloqueo, rollback después de eliminar token, carrera con
reset local, todas las sesiones anteriores por HTTP, nuevo/antiguo password y
contrato público. No se envían correos.

Verificación de entrega: `npm.cmd test` completado con compilación TypeScript
CommonJS exitosa y **212 pruebas aprobadas, cero fallidas y cero omitidas**.
Incluye PostgreSQL 17.11 aislado con nueve subcasos de integración reales.
La migración principal continúa pendiente de autorización.

## Límites pendientes

Todavía no hay recuperación pública funcional: faltan endpoints, límites por
IP/cuenta, coordinación de envío y vistas. La futura ruta debe limitar intentos
y concurrencia antes de scrypt y no exponer errores SQL. El token se devuelve
solo a ese servicio interno y no debe ir a logs o respuestas públicas.
No se agrega limpieza periódica: queda como máximo una fila por usuario y las
filas expiradas no pueden consumirse. Un contador INTEGER agotado produce un
error transaccional, sin cambiar contraseña ni consumir token.

Referencias de implementación: [bloqueos PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html)
y [funciones de tiempo](https://www.postgresql.org/docs/17/functions-datetime.html).
