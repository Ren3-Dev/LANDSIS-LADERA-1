# Plan de despliegue de producción — LANDSIS: LADERA-1

> Actualización posterior: se implementó la preparación de token IoT, TLS en firmware
> y plantillas de producción. Consultar `seguridad-despliegue-produccion.md` para el
> estado vigente y verificaciones pendientes. Esta auditoría conserva sus hallazgos
> originales; no constituye una autorización para publicar recepción.

Auditoría: 5 de noviembre de 2026, Guatemala. Alcance: repositorio versionado completo (157 archivos), configuración, SQL, firmware, documentación y pruebas. Los documentos históricos aportan contexto; no sustituyen comprobar el entorno actual. Este informe es el único cambio previsto en archivos versionados. No se desplegó, no se modificó código funcional ni firmware y no se ejecutaron migraciones sobre la base actual.

## 1. Dictamen

**El sistema es viable en un único VPS Ubuntu con despliegue nativo, pero todavía no está listo para producción pública de extremo a extremo.** React puede servirse como archivos estáticos con Nginx, Express como un único proceso systemd y PostgreSQL 17 en loopback. No se necesita Docker ni un cambio de arquitectura.

La aplicación web dispone de compilación de producción y autenticación. Los obstáculos principales son el transporte HTTP del ESP32, la ausencia de autenticación del emisor de lecturas, la configuración del proxy y la falta de una restauración verificada de la base actual. Es posible preparar primero un entorno privado de ensayo; eso no equivale a habilitar la recepción IoT pública.

## 2. Estado técnico observado

| Componente | Evidencia y preparación |
| --- | --- |
| Backend | `backend/package.json`: `build` ejecuta `tsc`; `start` ejecuta `node dist/server.js`. CommonJS/NodeNext, salida ES2022. Express 5, pg, dotenv y nodemailer. No hay scripts de producción dependientes de PowerShell. |
| Escucha | `backend/src/server.ts` admite `PORT` y `LANDSIS_HOST`. Sin host explícito puede escuchar fuera de loopback: producción debe usar `LANDSIS_HOST=127.0.0.1`. No hay que abrir TCP 3000 al público. |
| Frontend | React 19 + Vite 7 + TypeScript. `build` verifica tipos y genera `frontend/dist`. `src/api/http.ts` usa `/api/v1/` y cookie `same-origin`; no necesita una URL absoluta de API para el mismo dominio. `API_PROXY_TARGET` en `vite.config.ts` solo afecta al servidor de desarrollo; no configura el proxy de producción. |
| Rutas web | Se debe desplegar en la raíz del dominio y usar fallback SPA para `/reset-password` y las demás rutas de recuperación. No está preparado aquí un despliegue bajo subdirectorio. `vite preview` no es el servicio de producción previsto. |
| SQL | Siete scripts en `database/`, numerados 001–007. No existe ejecutor de migraciones ni tabla de versiones. Casi todos son de aplicación única; repetirlos falla. 003 incorpora nodos históricos y FK; 005 añade versión de credenciales y tokens; 006 eliminación lógica; 007 estado de avisos. |
| Persistencia | Pool pg configurado por entorno; SQL parametrizado. Las lecturas y registro de nodo se guardan en una transacción; 201 se emite tras commit. La orientación calculada se mantiene en memoria, no en las tablas de lecturas. |
| Validación IoT | `readings/reading.ts` valida forma exacta, ADC, tipos, números finitos, bloque MPU completo y orientación. La validación de contenido no acredita identidad del emisor. POST registra automáticamente cualquier identificador de nodo válido. |
| Sesiones y roles | Cookie opaca, HttpOnly, SameSite=Strict, Secure si `NODE_ENV=production`, ruta `/api`; contraseñas con scrypt. Roles y usuarios en PostgreSQL. Sesiones y límites de solicitudes en memoria: los reinicios cierran sesiones y reinician límites. Un solo proceso es suficiente para el diseño actual. |
| CORS | Deshabilitado intencionalmente. Mantener frontend y API bajo el mismo origen. Cabecera `X-Landsis-Request` y JSON en mutaciones humanas. No hace falta añadir CORS. |
| Recuperación | Deshabilitada por defecto. Al habilitarla requiere `FRONTEND_URL` HTTPS, SMTP y migración 005; las consultas actuales de usuarios también necesitan 006. Enlaces con token en fragmento; tokens con hash y caducidad en BD. Sin SMTP la solicitud conserva respuesta genérica pero no envía correo. |
| Avisos | `ALERT_EMAIL_ENABLED` requiere SMTP y tabla 007. Si su inicialización falla, el backend continúa sin avisos: comprobar entrega y estado, no asumir que escuchar el puerto implica correo operativo. |
| Salud | `/health` confirma el proceso HTTP, **no** conexión a BD, esquema o SMTP. Verificar esos servicios separadamente. |
| Firmware | Sketch HTTP activo en `firmware/landsis_ladera1/`; el sketch raíz es antecedente. `telemetria.h` crea `WiFiClient` y usa `HTTPClient.begin(cliente, API_URL)`. No configura cliente TLS, CA ni validación de certificado. Ejemplo de endpoint orientado a PC local mediante HTTP. |

No se ha comprobado físicamente el MPU6050 en esta auditoría. No se cambian ni se validan como definitivos calibraciones, pines ni niveles experimentales de riesgo.

## 3. Bloqueantes y acciones mínimas

1. **ESP32 sin HTTPS validado.** Cambiar solo el texto del endpoint a `https://` no proporciona TLS al cliente actual. Una redirección HTTP→HTTPS de Nginx tampoco resuelve esto. Se requiere una tarea posterior autorizada para cliente seguro, validación de CA/certificado, reloj cuando corresponda, endpoint de dominio y ensayo físico de conexión/reconexión. No usar `setInsecure()` como solución. Mientras se mantenga la restricción de no tocar firmware, queda pendiente el flujo IoT HTTPS completo.
2. **POST de lecturas público sin autenticación.** `app.ts` exige sesión a GET/HEAD pero no a POST; conocer `nodeId` permite insertar datos y crear nodos. Antes de publicar la recepción se necesita control del emisor: restricción en Nginx por origen si existe una IP de salida fija, conocida y verificada; en caso contrario, definir autenticación de dispositivo en una tarea posterior que también afectaría al firmware. No inventar una IP permitida ni exponer el POST abierto. Hasta resolverlo, denegar POST IoT en el borde. HTTPS por sí solo no autentica al dispositivo.
3. **Límites por IP detrás del proxy.** Express no configura `trust proxy`; login y recuperación verían la IP de Nginx y compartirían sus cuotas. Configurar confianza limitada al proxy loopback en `app.ts` y hacer que Nginx sobrescriba `X-Forwarded-For` con `$remote_addr`. No confiar globalmente en cabeceras enviadas por clientes. La cookie Secure actual se establece explícitamente por entorno: este problema afecta principalmente identificación de IP y límites, no exige quitar Secure.
4. **Infraestructura de producción ausente.** Faltan configuración Nginx, certificado/renovación, unidad systemd, entorno privado y reglas de acceso. Habilitar solamente SSH administrativo según origen y HTTP/HTTPS; PostgreSQL y Node en loopback. Dominio, DNS, Ubuntu elegido y recursos del VPS aún no están confirmados.
5. **Base actual sin inventario y restauración demostrada.** La consulta local de solo lectura no pudo completarse en el entorno restringido. No se conocen por esta auditoría versión real, número actual de filas o migraciones efectivamente aplicadas. No se debe deducir el esquema actual de informes antiguos. Hacer inventario y ensayo antes del corte, sin repetir 001–007 sobre un dump completo.
6. **Validaciones pendientes del entorno final.** Reinstalar dependencias desde lockfiles en Ubuntu, ejecutar pruebas allí, repetir auditoría de vulnerabilidades con red y verificar restauración, TLS, cookie y recuperación real. Las compilaciones de Windows no demuestran por sí solas funcionamiento completo en Linux.

## 4. Archivos que necesitan cambios posteriores

| Archivo o ubicación | Cambio mínimo y condición |
| --- | --- |
| `backend/src/app.ts` | Confianza restringida del proxy. |
| `backend/.env.example` | Documentar `LANDSIS_HOST`, modo de producción y URL HTTPS de ejemplo; conservar secretos fuera del repositorio. |
| Configuración privada del VPS `/etc/landsis/backend.env` | Crear con `NODE_ENV=production`, host, puerto, PG*, URL y opciones de correo. No versionar. |
| Nuevo ejemplo de unidad systemd y configuración Nginx | Documentar o versionar plantillas sin credenciales, con rutas de release y dominio sustituibles. |
| `firmware/landsis_ladera1/telemetria.h`, `secrets.example.h` y README | Tarea posterior de HTTPS y, si corresponde, autenticación IoT. **No modificados aquí**. `secrets.h` continúa siendo privado. |
| Rutas/controlador de lecturas | Solo si el control de emisor requiere autenticación en aplicación; no necesario si una restricción de red comprobada es suficiente. |
| `backend/tests/password-recovery-postgres.test.cjs` | Ruta predeterminada a PostgreSQL es de Windows; no bloquea producción. En Ubuntu basta definir `LANDSIS_TEST_PG_BIN=/usr/lib/postgresql/17/bin`. |
| README principal y frontend | Sustituir/acompañar instrucciones históricas de Windows y aclarar estado real de migraciones. Documentación, no bloqueo de ejecución. |

No se requiere cambiar `frontend/src/api/http.ts`, crear una variable `VITE_API_URL` ni modificar las migraciones existentes para trasladar una BD completa. No añadir un framework de migraciones solo para este despliegue; basta un registro operativo de scripts verificados y aplicados con parada ante errores.

## 5. Dependencias, portabilidad y secretos

- Ambos componentes tienen `package-lock.json`; no se encontraron dependencias `file:`/`link:` ni enlaces locales en los lockfiles. Reinstalar con `npm ci` en Linux; no copiar `node_modules` desde Windows. Vite utiliza herramientas con binarios de plataforma.
- La dependencia local de pruebas del frontend es explícita: carga tsx desde `../backend/node_modules/tsx/dist/loader.mjs`. Instalar dependencias de desarrollo del backend antes de probar frontend. No afecta a los estáticos publicados.
- No se encontraron rutas absolutas Windows en código de ejecución de frontend/backend. Sí hay instrucciones Windows en documentación y ruta predeterminada del test PostgreSQL. No hay scripts de arranque systemd o PM2 existentes.
- No hay campo `engines` que fije Node. Se verificó localmente Node v24.21.0 y npm 11.19.0. Usar Node 24 mantenido y fijar versión exacta al implementar; Vite 7 exige como mínimo Node 20.19 o 22.12 según su documentación. No actualizar dependencias indiscriminadamente para desplegar.
- No se detectaron credenciales reales en el escaneo textual de archivos versionados: los candidatos corresponden a pruebas sintéticas y ejemplos. Git versiona `.env.example` y `secrets.example.h`; `.env`, variantes privadas y `secrets.h` están ignorados. La búsqueda de rutas históricas de `.env`, `secrets.h` y archivos de claves no devolvió coincidencias en las referencias Git locales.
- Esta comprobación es heurística; no certifica ausencia de secretos en binarios, imágenes de evidencia, documentos Office/PDF, ramas remotas no descargadas o todo el contenido histórico bajo otros nombres. Revisar esos artefactos antes de hacer público el repositorio. No se volcaron valores privados al informe.
- Los respaldos contienen datos personales y hashes de contraseña: fuera de Git y del directorio público de Nginx, permisos restringidos, transferencia por SSH y copia externa cifrada. `.gitignore` ya excluye `/private-backups/`.

## 6. Comandos previstos de instalación y compilación

**Solo planificación: ninguno de los siguientes comandos de servidor, migración o corte fue ejecutado.** Los nombres `landsis.example.org`, `USUARIO_ORIGEN` y las rutas de release son ejemplos que deben sustituirse por valores confirmados; no son credenciales. Se asume un Ubuntu soportado con systemd, Node instalado en `/usr/bin/node` y PostgreSQL 17 disponible. Comprobar rutas reales antes de crear la unidad.

```bash
sudo apt update
# Si PostgreSQL 17 no está en los repositorios configurados, preparar antes
# el repositorio oficial PGDG para la versión concreta de Ubuntu.
apt-cache policy postgresql-17 postgresql-client-17
sudo apt install nginx postgresql-17 postgresql-client-17 certbot python3-certbot-nginx
node --version
npm --version
psql --version
sudo adduser --system --group --home /srv/landsis landsis
```

Instalar Node 24 desde una fuente oficial/verificada en el paso de implementación, antes de compilar; no asumir que `apt install nodejs` entrega esa versión. Preparar una release propiedad del usuario de despliegue, legible para `landsis` y los estáticos para `www-data`. No ejecutar compilaciones ni pruebas como root.

```bash
cd /srv/landsis/releases/RELEASE/backend
npm ci
LANDSIS_TEST_PG_BIN=/usr/lib/postgresql/17/bin npm test
npm audit --omit=dev
cd ../frontend
npm ci
npm test
npm run build
npm audit
cd ../backend
# Después de pruebas; el servicio solo requiere dependencias de producción.
npm prune --omit=dev
```

Mantener `frontend/dist` y `backend/dist` de la misma release; activar posteriormente un enlace `/srv/landsis/current` hacia la release validada. La primera instalación debe crear y verificar ese enlace antes de arrancar servicios. No usar enlaces a carpetas de Windows.

Variables privadas mínimas: `NODE_ENV=production`, `LANDSIS_HOST=127.0.0.1`, `PORT=3000`, `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGDATABASE=landsis`, `PGUSER` y `PGPASSWORD` definidos de forma privada. Si se habilita recuperación: `RECOVERY_EMAIL_ENABLED=true`, `FRONTEND_URL=https://landsis.example.org/`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM`. Avisos: `ALERT_EMAIL_ENABLED=true` únicamente después de verificar 007 y correo. Ninguna variable sensible debe usar prefijo `VITE_`.

### Servicio recomendado: systemd

systemd evita otro gestor y consumo adicional; PM2 también podría ejecutar `dist/server.js` en modo fork con una instancia, pero no aporta una necesidad actual. No usar modo cluster: sesiones, orientación y límites son locales al proceso.

Ejemplo previsto de `/etc/systemd/system/landsis.service`:

```ini
[Unit]
Description=LANDSIS LADERA-1 API
After=network.target postgresql.service

[Service]
Type=simple
User=landsis
Group=landsis
WorkingDirectory=/srv/landsis/current/backend
EnvironmentFile=/etc/landsis/backend.env
ExecStart=/usr/bin/node /srv/landsis/current/backend/dist/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
UMask=0077

[Install]
WantedBy=multi-user.target
```

Crear el entorno con permisos `0600` y propietario root; systemd lo carga antes de bajar privilegios. El servicio no debe tener permisos de escritura sobre el código. El usuario de BD de ejecución no debe ser superusuario; si se restaura como propietario, completar después una separación simple entre propietario/migrador y usuario de ejecución con permisos de tablas/secuencias. Comprobar INSERT, SELECT, UPDATE y DELETE requeridos por usuarios, tokens y avisos.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now landsis
sudo systemctl status landsis --no-pager
sudo journalctl -u landsis -n 50 --no-pager
curl --fail http://127.0.0.1:3000/health
```

No interpretar `/health` como validación suficiente del despliegue.

### Nginx y HTTPS

Bloque HTTP inicial para emitir el certificado; reemplazar dominio y revisar conflicto con el sitio predeterminado. `proxy_pass` sin sufijo conserva `/api/`:

```nginx
server {
    listen 80;
    server_name landsis.example.org;
    root /srv/landsis/current/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        # No habilitar POST IoT público hasta resolver el control del emisor.
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Este fragmento no es una configuración final publicable: añadir antes una regla que deniegue POST a `/api/v1/readings` (con y sin barra final), conservando acceso GET autenticado, o el control de origen ya validado. No cachear respuestas de API. No publicar `.env`, fuentes backend, dumps o todo el repositorio con `root`.

```bash
sudo nginx -t
sudo systemctl reload nginx
# Después de DNS correcto y puertos 80/443 accesibles:
sudo certbot --nginx -d landsis.example.org --redirect
sudo nginx -t
sudo certbot renew --dry-run
curl --fail https://landsis.example.org/
curl --fail https://landsis.example.org/reset-password
curl -i https://landsis.example.org/api/v1/auth/me
# Sin cookie: último comando debe devolver 401, no index.html.
```

Revisar timer de renovación, acceso SSH antes de activar firewall, listener local de BD y del backend y ausencia de exposición de 3000/5432. Probar login en navegador HTTPS y atributos de cookie, cierre de sesión, roles, límites por IP y ruta de recuperación. La prueba real SMTP requiere una cuenta de ensayo y autorización para enviar; no se enviaron correos en esta auditoría.

## 7. Transferencia y respaldo de PostgreSQL

### Inventario y ensayo previo

Consultar la BD origen con conexión privada, primero en transacción de solo lectura: `SHOW server_version`, tamaño, codificación, colación, tablas, columnas, restricciones, índices y secuencias. Revisar especialmente `users.credential_version`, `users.deleted_at`, `password_reset_tokens` e `inclination_email_state`. Registrar conteos por tabla, IDs mínimo/máximo y fechas de lecturas sin exportar datos personales al informe público. Confirmar versión origen: no asumir que es 17 por una ruta instalada.

Para origen hasta 17, usar herramientas 17 compatibles. Si origen es superior a 17, detener el plan y evaluar compatibilidad: no prometer una restauración hacia una versión mayor de servidor inferior. PostgreSQL documenta los límites entre versiones de dump/restore.

Respaldar **toda la base**, esquema y datos, sin filtrar usuarios o lecturas. Incluye roles de aplicación, hashes scrypt, estado de usuarios eliminados, credenciales versionadas, nodos, tokens de recuperación, secuencias y avisos. Los roles PostgreSQL del servidor no son las filas de `public.roles`: crear un rol de conexión nuevo y privado en destino evita trasladar contraseñas administrativas del servidor. Revisar ACL y privilegios requeridos.

Ejemplo de exportación desde PowerShell en el origen, con contraseña por prompt o archivo pgpass protegido (no en argumentos):

```powershell
New-Item -ItemType Directory -Force -Path private-backups
& 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe' -h localhost -p 5432 -U USUARIO_ORIGEN -d landsis -Fc -f private-backups/landsis-pre-vps.dump
if ($LASTEXITCODE -ne 0) { throw 'Falló el respaldo; detener el traslado.' }
Get-FileHash private-backups/landsis-pre-vps.dump -Algorithm SHA256
```

Confirmar antes la ubicación real de pg_dump. No copiar el directorio de datos de Windows a Ubuntu. Transferir dump por SSH/SCP y comparar SHA256 en destino. Preparar de forma administrativa un rol no superusuario `landsis_owner`, contraseña mediante prompt `\password`, y una **base vacía de ensayo**, propiedad de ese rol. Ejemplo en Ubuntu:

```bash
sha256sum /var/backups/landsis/landsis-pre-vps.dump
pg_restore --list /var/backups/landsis/landsis-pre-vps.dump
sudo -u postgres createdb --owner=landsis_owner --template=template0 landsis_restore_check
pg_restore -h 127.0.0.1 -U landsis_owner -d landsis_restore_check \
  --no-owner --no-privileges --exit-on-error --single-transaction \
  /var/backups/landsis/landsis-pre-vps.dump
```

Restaurar primero en ensayo y después en una base destino nueva/vacía, nunca sobre una base poblada ni con `--clean`. Verificar esquema, conteos exactos por tabla, extremos de IDs/fechas, constraints, índices, valores de secuencias y permisos. Comprobar hashes/huellas de datos en privado si se necesita evidencia de igualdad; no imprimir hashes de contraseñas. Probar login con usuario existente y consultas históricas. Comprobar la próxima identidad en ensayo sin consumir ni alterar secuencias del origen.

**No ejecutar 001–007 encima del dump completo.** Si faltan migraciones, identificar exactamente cuáles con el esquema, ensayarlas sobre la copia y aplicar solo las pendientes en orden con backend detenido. Para una instalación completamente vacía sin dump sí se ejecutan 001–007 secuencialmente:

```bash
# Ejemplo de UNA migración previamente confirmada pendiente:
psql -X -h 127.0.0.1 -U landsis_owner -d landsis -v ON_ERROR_STOP=1 \
  -f database/007_inclination_email_state.sql
```

El ejemplo no significa que 007 esté pendiente. Registrar archivo, checksum, fecha, resultado y esquema; no hay detección automática. No ejecutar bootstrap `create-admin` al transferir usuarios existentes. El script npm recompila y necesita devDependencies, por lo que su uso en una instalación nueva debe planificarse antes de podarlas.

### Corte sin pérdida de filas ya persistidas

1. Ensayar restauración, permisos y aplicación antes del corte. Conservar release y base local intactas.
2. Detener escrituras al origen y cambios de usuarios/contraseñas; detener backend local. Hacer dump final después de detener escrituras y guardar inventario final.
3. Transferir y restaurar en una base destino vacía; cotejar inventario antes de arrancar el nuevo backend. Asegurar una sola instancia receptora activa.
4. Activar release, Nginx/TLS y recepción solo cuando el control IoT esté resuelto; comprobar lectura nueva real con respuesta 201 y fila persistida. No simular datos de sensores en producción.
5. Verificar usuarios, roles, historial, recuperación y avisos según funciones habilitadas. Conservar origen y dump protegidos hasta cerrar la validación.

El firmware no tiene almacenamiento offline durable: el intervalo de corte o caída puede perder muestras aún no recibidas; el procedimiento conserva las filas persistidas hasta la pausa, no garantiza captura continua. Las sesiones en memoria no se transfieren y será necesario volver a iniciar sesión. La orientación en memoria vuelve a estar disponible con nueva telemetría válida; no se reconstruye desde un dump. Los enlaces de recuperación anteriores pueden apuntar al dominio local antiguo; comprobarlo y solicitar un enlace nuevo cuando corresponda.

Programar posteriormente respaldo periódico `pg_dump -Fc`, checksum, verificación de salida y copia cifrada externa al VPS, con frecuencia y retención acordadas según pérdida tolerable y espacio disponible. Ensayar restauración periódica: listar el archivo no demuestra que restaura. No ejecutar borrados automáticos de respaldos sin definir retención. El dump y el inventario previo a cada cambio se conservan para reversión.

## 8. Reversión ante fallos

- Antes de recibir escrituras en VPS: detener nuevo backend, volver al backend/origen intactos y al endpoint anterior mediante el procedimiento de operación autorizado; no borrar la base fallida. Cambios de endpoint del ESP32 requerirán su procedimiento posterior y acceso al dispositivo. DNS no ofrece reversión instantánea por cachés.
- Si solo falla una release y el esquema sigue compatible: detener backend, apuntar `current` a la release anterior, restaurar configuración anterior de Nginx si procede, ejecutar `nginx -t`, recargar y arrancar backend. La sesión se perderá por reinicio. Registrar causa y comprobar consultas.
- Si ya existen nuevas lecturas o usuarios en VPS: detener escrituras y respaldar primero la base del VPS. No volver silenciosamente a la base local ni restaurar el dump antiguo encima de datos nuevos. Preferir revertir código compatible conservando la BD del VPS; si no es posible, restaurar una copia separada y reconciliar con revisión de IDs, nodos, usuarios y dependencias, sin un `INSERT` masivo improvisado. Acordar cualquier pérdida antes de proceder.
- Si falla una migración: parar implementación, inspeccionar resultado y transacción; restaurar el respaldo en una base nueva si se requiere. No inventar scripts inversos destructivos ni eliminar columnas/datos para volver atrás. Mantener la base anterior disponible.

## 9. Mejoras opcionales y recursos

- Fijar versiones de Node/npm y documentar engines; independizar tsx de los tests frontend solo si aporta mantenibilidad.
- Agregar cierre ordenado SIGTERM de servidor/pool y chequeo de disponibilidad de BD, sin cambiar `/health` inadvertidamente. Hoy systemd puede reiniciar el proceso, pero no hay drenaje explícito de peticiones en curso.
- Limitar recursos y rotación de logs después de medir; no imponer un límite de memoria arbitrario. scrypt usa aproximadamente 128 MiB por derivación y permite concurrencia: considerar picos de autenticación, compilación y PostgreSQL en conjunto. No se hizo ensayo de carga ni se justifica todavía un tamaño exacto de VPS.
- La imagen de marca compilada pesa aproximadamente 1,06 MB; optimizarla es opcional. No requiere otro servidor frontend.
- Persistir sesiones/orientación o añadir colas durables sería un alcance mayor; no es necesario para un único proceso si se aceptan sus límites actuales. No se propone aquí cambiar el modelo experimental de riesgo.

## 10. Orden recomendado y criterios de aceptación

1. Confirmar dominio, Ubuntu, acceso administrativo, versión real de BD y política de copias; inventariar el esquema actual.
2. Resolver diseño mínimo de transporte HTTPS y control del emisor IoT en una tarea posterior autorizada. Hasta entonces no publicar recepción.
3. Aplicar configuración restringida de proxy, entorno privado, unidad systemd y Nginx; mantener puertos internos cerrados.
4. Reinstalar dependencias y validar compilación/pruebas en Ubuntu; repetir auditoría de dependencias con acceso al registro.
5. Restaurar dump de ensayo, cotejar usuarios/lecturas y aplicar solamente migraciones faltantes confirmadas. Probar recuperación con cuenta de ensayo cuando se autorice envío.
6. Ensayar HTTPS real con ESP32 y procedimiento de reversión. Mantener firmware, calibración y umbrales fuera de esta auditoría.
7. Ejecutar corte con pausa de escrituras, dump final, verificación, activación y observación. Criterios: login/roles, API JSON y cookie correctos, restauración cotejada, TLS renovable, servicio tras reinicio, inserción IoT auténtica 201, BD no expuesta y copia externa recuperable.

## 11. Verificaciones realizadas

- Frontend: `npm test`: **57 aprobadas, 0 fallidas**. `npm run build`: correcto, Vite 7.3.6, 54 módulos; JS aproximadamente 270,35 kB (83,25 kB gzip).
- Backend: `npm test` incluye build TypeScript correcto. Primera ejecución restringida: 241 pruebas, 76 aprobadas y 165 fallidas; conexiones HTTP locales fallan con `EACCES` y el clúster PostgreSQL temporal no completa. Estos resultados no se interpretan como defectos funcionales sin repetir fuera de esa restricción.
- Repetición del backend con acceso local fuera de la restricción: **252 aprobadas, 0 fallidas, 0 omitidas**, aproximadamente 49,46 segundos. Incluye pruebas de migraciones, concurrencia, autenticación y recuperación con un clúster PostgreSQL temporal aislado; no usa la BD real. La diferencia de total corresponde a subpruebas que sí llegaron a ejecutarse.
- Intento de consulta a la base actual: solo lectura, no completado en el entorno restringido; no se certifica el esquema ni los datos actuales.
- `npm audit --omit=dev` en backend y `npm audit` en frontend: no completados, `ENOTFOUND registry.npmjs.org`. No se declara que las dependencias estén libres de vulnerabilidades.
- No se ejecutó `npm ci` contra el registro ni se verificó Linux real en esta sesión. Las pruebas usaron dependencias ya instaladas. No se compiló/cargó firmware ni se envió correo real.
- Revisión de lockfiles, configuración, rutas y secretos textuales sin divulgar valores privados. No se creó dump de datos reales.

## Referencias oficiales consultadas

- [Vite 7 y requisitos de Node](https://vite.dev/blog/announcing-vite7) y [compilación de producción](https://vite.dev/guide/build).
- [Express: configuración de trust proxy](https://expressjs.com/en/api/application/).
- [PostgreSQL 17: pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) y [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
- [PostgreSQL para Ubuntu](https://www.postgresql.org/download/linux/ubuntu/).
- [Nginx: proxy_pass y cabeceras](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
- [Ubuntu: certificados TLS y Certbot](https://ubuntu.com/server/docs/how-to/security/obtain-tls-certificates/).
