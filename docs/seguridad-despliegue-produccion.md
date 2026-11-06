# Seguridad para el despliegue de producción

Implementación: 5 de noviembre de 2026. Complementa `plan-despliegue-produccion.md`. No se desplegó, no se modificó la base actual ni se cargó firmware al ESP32.

## Autenticación de dispositivo

`POST /api/v1/readings` requiere un único encabezado `X-Landsis-Device-Token`: 32 bytes aleatorios codificados como 64 caracteres hexadecimales minúsculos. El servidor usa `IOT_DEVICE_TOKEN` y `IOT_NODE_ID` (LADERA-1). Compara hashes SHA-256 mediante `timingSafeEqual`, con buffers de tamaño fijo. El token queda vinculado al identificador exacto del nodo, sin nuevas tablas o dependencias.

- Token ausente, mal formado, incorrecto o encabezado duplicado: 401 antes de parsear JSON o acceder a persistencia.
- Token válido y JSON válido de otro nodo: 403 sin insertar.
- Token válido y JSON inválido: se conserva validación y respuesta 400.
- Lectura válida autorizada: mismo JSON y HTTP 201 después de commit.
- GET/HEAD conservan sesión humana y roles; la cookie humana no reemplaza el token de dispositivo.
- Configuración ausente/inválida: POST falla cerrado con 503; `server.ts` impide arrancar sin configuración válida.

El token es una credencial portadora; TLS protege su transporte. No hay modo anónimo de compatibilidad: actualizar coordinadamente backend y firmware. No incluir el token en URL, JSON, frontend o variables `VITE_`. No se añaden firmas o mecanismos antirrepetición. El diseño configura un único nodo.

## Configuración privada y rotación

Generar una vez en una terminal privada:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex')+'\n')"
```

El comando imprime el secreto: no capturar ni guardar la salida en documentación, chats, logs o archivos versionados. La línea contiene solo el generador. Copiar el mismo valor a `IOT_DEVICE_TOKEN` del entorno privado y a `IOT_DEVICE_TOKEN` del `secrets.h` ignorado por Git. Limpiar portapapeles e historial del portapapeles cuando corresponda. No se generaron secretos reales durante esta tarea.

En VPS copiar `deploy/backend.env.example` a `/etc/landsis/backend.env`, root:root, modo 0600. Configurar PGUSER/PGPASSWORD y el token privadamente; conservar la configuración SMTP existente si se usa correo. Los ejemplos no contienen credenciales válidas.

Actualizar manualmente el `secrets.h` existente con las declaraciones nuevas de `secrets.example.h`, conservando Wi-Fi. Añadir URL HTTPS de dominio, token, CA PEM y servidor NTP. No se modificó el archivo privado: una copia antigua no compilará hasta añadir esos campos. Revisar `git status` antes de compartir; no publicar binarios reales, que contienen el token.

Rotación: cerrar POST en Nginx, generar token nuevo, actualizar backend y firmware, reiniciar backend y cargar manualmente con autorización, verificar en privado y reabrir. Solo se admite un token a la vez; habrá interrupción. Revocar ante exposición. El nodo no dispone de almacenamiento offline durable de muestras.

## Firmware HTTPS

`telemetria.h` usa `WiFiClientSecure` y `setCACert(API_ROOT_CA)`, sin `setInsecure()` ni fallback HTTP. Solo admite URL que empiece por `https://` y deshabilita redirecciones para no reenviar credenciales. Configurar el nombre de dominio que figura en el certificado. Nginx debe servir la cadena `fullchain.pem`.

`API_ROOT_CA` queda vacío en el ejemplo: obtener la raíz PEM de una fuente oficial del emisor y comprobar su huella por un canal confiable. No confiar automáticamente en el certificado de la primera conexión, ni usar el leaf renovable como raíz. Registrar CA, vencimiento y actualización de firmware si cambia la cadena.

Se solicita hora UTC mediante `configTime` con `NTP_SERVER`; se espera notificación SNTP antes del primer intento TLS. Sin sincronización no se envían lecturas. No se bloquea el bucle de sensores. Confirmar acceso a NTP desde la red del nodo; `pool.ntp.org` es un ejemplo sustituible por NTP local. SNTP no autentica el tiempo: requiere una fuente/red de tiempo confiable. No se contratan servicios.

Se mantienen intervalo de 10 segundos, reconexión, JSON, colas, vibración, pines, calibración y lógica experimental. El handshake TLS tiene límite de 10 segundos y se conservan los timeouts HTTP previos; no representan un límite total de dos segundos por solicitud. Medir heap, pila y latencias en hardware antes de habilitar recepción.

### Pruebas físicas pendientes

1. Actualizar secretos privados, confirmar placa/core/bibliotecas y compilar con dominio y CA finales. Carga exclusivamente manual/autorizada.
2. Arranque en frío: antes de sincronizar hora no hay POST; después, TLS válido, lectura real 201 y fila persistida.
3. CA incorrecta, nombre incorrecto y certificado vencido deben impedir conexión. Endpoint HTTP y redirecciones no deben transmitir el token.
4. Token ausente/incorrecto/rotado: 401; otro nodo con token válido: 403; ninguna fila nueva. No imprimir encabezados para diagnosticar.
5. Cortar y recuperar Wi-Fi, DNS, NTP y backend; verificar continuidad de sensores/vibración, recuperación y memoria disponible. No suponer que las muestras durante la caída se conservan.
6. Repetir con certificado renovado. La compilación no demuestra estado físico del MPU6050 ni calibración definitiva.

## Plantillas y aislamiento

| Archivo | Destino/función |
| --- | --- |
| `deploy/backend.env.example` | `/etc/landsis/backend.env`, valores privados. |
| `deploy/landsis.service` | `/etc/systemd/system/landsis.service`, un proceso Node, usuario landsis, reinicio y código de solo lectura. |
| `deploy/nginx.conf.example` | Sitio Nginx: estáticos y API bajo el mismo dominio, TLS y cierre inicial del POST. |
| `deploy/landsis-api.conf` | `/etc/nginx/snippets/landsis-api.conf`, proxy común sin caché de API. |
| `deploy/postgresql.conf.example` | Fragmento para VPS nuevo: PostgreSQL solo localhost. |
| `deploy/pg_hba.conf.example` | Reglas locales previstas y rechazo remoto; revisar orden/roles antes de aplicar. |

Node escucha por defecto en 127.0.0.1 y en producción rechaza hosts distintos de 127.0.0.1/::1. La plantilla Nginx usa 127.0.0.1. Un ensayo LAN requiere host explícito en development; no se deshabilita la autenticación y el firmware preparado continúa exigiendo HTTPS.

Express confía solo en 127.0.0.1/32 y ::1/128. Nginx sobrescribe X-Forwarded-For con `$remote_addr`, además de protocolo/host. Los usuarios/procesos locales del VPS deben ser confiables. No exponer 3000/5432 ni agregar un CDN/proxy adicional sin revisar esta confianza. Frontend mantiene `/api/v1/` relativo, cookie del mismo origen y CORS deshabilitado.

systemd requiere Node en `/usr/bin/node`, usuario `landsis` y enlace `/srv/landsis/current` a una release legible. Confirmar ruta real; no depender del shell interactivo. `ProtectHome` y `ProtectSystem` requieren que el código y estáticos estén en /srv y no necesiten escrituras. Un proceso conserva el comportamiento actual de sesiones/orientación en memoria, que se pierden al reiniciar.

## Activación futura (no ejecutada)

1. Elegir Ubuntu soportado, instalar Node 24 mantenido y PostgreSQL 17 desde repositorios apropiados. Seguir inventario/backup/restauración del informe anterior. No aplicar fragmentos a la BD actual. Autenticación IoT no requiere migraciones.
2. Crear usuario de sistema landsis y rol PG de ejecución `landsis_app` con permisos necesarios y mínimos, separado del propietario/migrador. Configurar PGUSER acorde. No sustituir pg_hba de una instalación poblada a ciegas.
3. Instalar dependencias con `npm ci` en backend y frontend como usuario no root; probar/compilar ambos. En Ubuntu usar `LANDSIS_TEST_PG_BIN=/usr/lib/postgresql/17/bin`. Tests frontend necesitan tsx instalado en backend. Luego `npm prune --omit=dev` en backend. No copiar node_modules de Windows.
4. Preparar release/enlace current, entorno privado, unidad systemd y snippet Nginx. Dar lectura al backend para landsis y a los estáticos para www-data; no publicar el repositorio entero.
5. Emitir certificado antes de instalar bloque 443: la plantilla completa no pasa nginx -t sin archivos de certificado. Usar inicialmente solo bloque 80, DNS correcto y `/var/www/letsencrypt` para `certbot certonly --webroot -w /var/www/letsencrypt -d DOMINIO_REAL`. Luego instalar bloque HTTPS, sustituir dominio/rutas y verificar renovación automática.
6. Conservar `limit_except GET HEAD { deny all; }` en lecturas. El borde devuelve 403 a escrituras, incluidas variantes de mayúsculas/barra final/subrutas. Sobre HTTP se bloquea /api/ sin redirigir credenciales. Login/recuperación/usuarios HTTPS conservan su funcionamiento.
7. Ensayar HTTPS en acceso privado restringido por red/SSH y con base de ensayo: 401 sin token/erróneo, 403 para nodo distinto, 201 autorizado. Revisar temporalmente el cierre solo dentro del ensayo protegido. No crear lecturas falsas de aceptación en producción ni pasar secretos como argumentos de curl/query/historial.
8. Solo tras aceptación de TLS/autenticación y pruebas físicas, quitar `limit_except` de lecturas, ejecutar nginx -t y recargar. No eliminar la autenticación del backend. No abrir recepción por confiar solamente en /health.

Comandos posteriores de verificación:

```bash
sudo systemd-analyze verify /etc/systemd/system/landsis.service
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now landsis
sudo systemctl reload nginx
sudo ss -lntp
curl --fail http://127.0.0.1:3000/health
curl -i https://DOMINIO_REAL/api/v1/auth/me
sudo certbot renew --dry-run
```

Verificar listeners loopback, firewall de proveedor/host sin perder SSH, cookie Secure/HttpOnly/SameSite, login/roles y límites por IP. /health no verifica BD/SMTP. Mantener prueba de recuperación/avisos con cuenta de ensayo autorizada según configuración existente; no se modificó su lógica ni se enviaron correos reales.

Para reversión conservar release, entorno y backup previos como indica el informe. No restaurar datos antiguos encima de nuevas lecturas; parar escrituras y respaldar antes. Volver a una release anónima solo dentro de red privada con POST público cerrado. No ejecutar scripts inversos destructivos.

## Parámetros pendientes al elegir VPS

- Ubuntu soportado, arquitectura, SSH con claves/sudo, rutas Node y disponibilidad PostgreSQL 17.
- IP, dominio, A/AAAA correctos (sin AAAA si IPv6 no funciona), puertos 80/443 y método ACME/renovación.
- RAM/CPU/disco y crecimiento real de BD. Medir picos de scrypt, compilación y PostgreSQL; no se fija tamaño sin medición.
- Credenciales privadas PG/nodo, ubicación externa de respaldos, frecuencia/retención y responsable de restauración.
- Red del ESP32: Wi-Fi, DNS, salida HTTPS y NTP, placa/core y acceso físico para carga.
- Emisor/CA/cadena final y mantenimiento de raíz de confianza del ESP32.
- Si hay correo: configuración SMTP privada existente, salida permitida y destinatario de ensayo autorizado; sin cambio de proveedor/lógica.

## Verificaciones

Archivos de implementación y pruebas: `backend/src/auth/device.ts` (nuevo),
`backend/src/app.ts`, `backend/src/server.ts`, `backend/src/controllers/readings.ts`,
`backend/.env.example`, `backend/tests/device-auth.test.cjs` (nuevo),
`backend/tests/auth.test.cjs`, `backend/tests/authenticated-app.cjs` y
`backend/tests/recovery-api.test.cjs`. Firmware: `telemetria.h`,
`secrets.example.h` y README del sketch activo. Infraestructura: los seis archivos
de `deploy/` listados arriba. Documentación: este archivo nuevo y nota de
actualización en `plan-despliegue-produccion.md`. No hay cambios de dependencias,
frontend, SQL, recuperación o avisos funcionales.

- Backend: `npm test` incluye compilación TypeScript; **254 aprobadas, 0 fallidas, 0 omitidas**. Incluye aceptación/rechazo IoT, duplicados, vínculo con nodo, validación de JSON, permisos de lectura y confianza loopback, además de la suite existente y PostgreSQL temporal aislado. No se usó la base actual. Las pruebas de telemetría antiguas inyectan una autorización explícita de prueba; la suite IoT usa el middleware real.
- Frontend: **57 aprobadas, 0 fallidas**; compilación TypeScript y Vite de producción correctas. No se cambió código frontend.
- La primera ejecución detectó una expectativa antigua sobre X-Forwarded-For y dobles de respuesta sin locals; se ajustó la prueba al proxy local y el acceso a locals para conservar esos dobles. La suite completa volvió a ejecutarse y pasó. No se modificó lógica de correo/recuperación.
- Las pruebas backend se ejecutaron con acceso a loopback fuera de la restricción que impedía conexiones locales; firmware se compila en copia temporal con placeholders, sin leer secretos reales.
- Firmware: compilación correcta con Arduino CLI, ESP32 core **3.3.12**, FQBN `esp32:esp32:esp32` y copia temporal con `secrets.example.h`. Flash **1.068.064 bytes (81 %)** y RAM global **50.720 bytes (15 %)**. Sin carga al dispositivo; estas cifras no miden heap ni pila durante el handshake. El intento restringido inicial no encontraba la plataforma instalada; la repetición usó el toolchain local existente y finalizó correctamente.

Siguen pendientes dominio/certificado, configuración privada, TLS físico, restauración de BD real, validación en Ubuntu de nginx/systemd y auditoría de dependencias con red. La recepción pública permanece cerrada por defecto.

Referencias: [cliente seguro de Espressif](https://github.com/espressif/arduino-esp32/blob/master/libraries/NetworkClientSecure/examples/WiFiClientSecure/WiFiClientSecure.ino), [trust proxy de Express](https://expressjs.com/en/api/application/).
