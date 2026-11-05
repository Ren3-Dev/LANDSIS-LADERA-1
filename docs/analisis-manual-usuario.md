# LANDSIS LADERA-1 — Análisis para elaborar el Manual de Usuario

**Proyecto de graduación de Ingeniería en Sistemas de Información — Universidad Mariano Gálvez de Guatemala.**

**Fecha de análisis:** 4 de noviembre de 2026, referencia horaria America/Guatemala.  
**Naturaleza:** inventario técnico y planificación documental; no constituye el manual definitivo.  
**Fuente principal:** código del árbol de trabajo disponible, incluidos cambios previos modificados y archivos sin seguimiento. El estado no queda identificado únicamente por el último commit.

## 1. Resumen ejecutivo y alcance de la evidencia

El sistema implementa acceso con cuentas, tres roles, consulta de la última medición de LADERA-1, historial filtrado, selección de una medición diaria, detalle MPU6050 y administración de usuarios. Implementa recuperación de contraseñas por enlace, condicionada a configuración del correo. El dashboard presenta orientación relativa calculada por el firmware y un semáforo **experimental de inclinación**. El **riesgo global de deslizamiento no se evalúa**.

También existe un aviso visual por pérdida de comunicación después de inclinación ALERTA/CRÍTICO confirmada y un servicio opcional de correos ante inclinación CRÍTICO confirmada. Ninguno acredita una emergencia real, capacidad predictiva ni emisión oficial de alertas de CONRED.

La documentación del 3 de noviembre registra transmisión física multisensor y recepción de correos manuales. Son antecedentes con alcance acotado: no equivalen a una validación integral actual de navegador, dispositivo, base de datos, recuperación y correo automático. La evaluación angular física sigue siendo parcial y no certifica exactitud ni adecuación geotécnica de los parámetros.

### 1.1 Método y límites

- Se inspeccionaron frontend, backend, firmware pertinente, migraciones, pruebas y notas de validación. No se consultaron archivos privados de credenciales.
- Se analizó implementación y llamadas entre componentes; la existencia de una ruta por sí sola no se tomó como prueba funcional.
- No se inició un flujo real de usuarios, no se modificaron cuentas, no se insertaron mediciones, no se aplicaron migraciones, no se enviaron correos y no se intervino el hardware.
- Se ejecutaron verificaciones sin emitir compilados, descritas en la sección 10. No se obtuvo una cobertura porcentual de pruebas.
- Se creó exclusivamente este documento. No se redactó todavía el manual final ni se tomaron capturas.

### 1.2 Clasificación utilizada

| Estado | Significado en este análisis |
|---|---|
| Funcional en implementación | Flujo conectado entre interfaz y servicios correspondientes, con comportamiento identificable. Su comprobación real se indica por separado; no implica aceptación en producción. |
| Parcialmente implementada | Existe lógica utilizable, pero presenta límites relevantes de persistencia, configuración, entrega o alcance. |
| Pendiente / no disponible | No se encontró una operación accesible que cumpla esa capacidad. No implica que deba agregarse al alcance del proyecto. |

La evidencia se distingue como **código inspeccionado**, **pruebas automatizadas actuales**, **pruebas existentes inspeccionadas**, **validación histórica documentada** y **comprobación integral pendiente**.

## 2. Pantallas, navegación y rutas

### 2.1 Rutas de interfaz

| Pantalla | Ruta o mecanismo real | Acceso |
|---|---|---|
| Inicio de sesión | `/`, sin sesión | Público |
| Dashboard | `/`, estado interno `dashboard` después del acceso | Los tres roles activos |
| Historial | Menú «Historial», estado interno `history`; normalmente continúa en `/` | Los tres roles activos |
| Estado del nodo | Menú «Estado del nodo», estado interno `node`; normalmente continúa en `/` | Los tres roles activos |
| Usuarios | Menú «Usuarios», estado interno `users`; normalmente continúa en `/` | ADMINISTRADOR activo |
| Recuperar contraseña | `/forgot-password` | Público; solo cuentas elegibles reciben enlace |
| Establecer nueva contraseña | `/reset-password`, abierta desde el enlace del correo | Público con enlace válido para completar el cambio |
| Contraseña restablecida | Misma `/reset-password`, estado de éxito en memoria | Tras completar el cambio |

**No existen rutas independientes `/dashboard`, `/history`, `/node` o `/users` en la navegación implementada.** No deben inventarse para el manual o el plan de capturas. Las pantallas principales cambian mediante botones y estado React; recargar reconstruye la aplicación y vuelve al dashboard si la sesión sigue válida. El historial Atrás/Adelante del navegador se gestiona expresamente para recuperación, no para cada cambio del menú principal.

El enlace de recuperación lleva un secreto en su fragmento. La aplicación lo lee y retira de la barra de direcciones antes de montar React. Por privacidad, este documento no reproduce enlaces de recuperación. Recargar la dirección ya limpia pierde el token en memoria; abrir el enlace original aún puede servir si sigue vigente y sin usar.

Referencias: `frontend/src/main.tsx`, `frontend/src/AuthApp.tsx`, `frontend/src/recovery.ts`, `frontend/src/presentation.ts`, `frontend/src/components/UserNavigation.tsx`.

### 2.2 Servicios que respaldan las pantallas

Prefijo de API: `/api/v1`.

| Operación | Servicio | Restricción real |
|---|---|---|
| Iniciar sesión | `POST /auth/login` | Credenciales, cuenta activa, controles de solicitudes |
| Consultar sesión | `GET /auth/me` | Sesión válida y cuenta activa no eliminada |
| Cerrar sesión | `POST /auth/logout` | Revoca la sesión presentada; admite no tener sesión válida |
| Solicitar recuperación | `POST /auth/forgot-password` | Público, limitado; respuesta genérica |
| Restablecer contraseña | `POST /auth/reset-password` | Token vigente, cuenta elegible y contraseña válida |
| Última medición | `GET /readings/latest` | Sesión humana válida |
| Historial | `GET /readings` | Sesión humana válida |
| Selección diaria | `GET /readings/daily` | Sesión humana válida y nodo obligatorio |
| Catálogo de nodos | `GET /nodes` | Sesión humana válida; sin pantalla de catálogo actual |
| Listar / crear usuarios | `GET /users`, `POST /users` | ADMINISTRADOR |
| Editar / eliminar lógicamente | `PATCH /users/:id`, `DELETE /users/:id` | ADMINISTRADOR y restricciones del registro |
| Recibir telemetría | `POST /readings` | Sin autenticación de dispositivo en el código; valida JSON |

`GET /health` es público y externo al prefijo: confirma respuesta del proceso, no disponibilidad de PostgreSQL, sensores o SMTP. No es una pantalla de usuario.

Referencias: `backend/src/app.ts`, `backend/src/auth/security.ts`, `backend/src/routes/{readings,nodes,password-recovery}.ts`, `backend/src/controllers/readings.ts`.

## 3. Inventario de funcionalidades y procedimientos base

En las fichas, **todos** significa ADMINISTRADOR, INVESTIGADOR y CONRED con cuenta activa y sesión válida. La recuperación es pública y no depende de una sesión previa. Los procedimientos son insumos para el manual, no instrucciones para ejecutar cambios durante este análisis.

### F01. Inicio y restauración de sesión

- **Descripción y ubicación:** formulario inicial, campos «Correo» y «Contraseña»; restaura una sesión existente al abrir `/`.
- **Procedimiento:** 1) Abrir la dirección oficial que confirme el responsable. 2) Introducir correo y contraseña. 3) Pulsar «Iniciar sesión». 4) Comprobar nombre, rol y dashboard.
- **Roles:** todos; no existe registro público de cuentas.
- **Resultado:** sesión mediante cookie y acceso a las vistas permitidas. La contraseña se limpia del formulario tras la respuesta.
- **Errores:** correo/contraseña inválidos; cuenta inactiva tras validar contraseña; datos incompletos; acceso ocupado; demasiados intentos; backend no disponible. Si falla la comprobación inicial de sesión aparece «Reintentar».
- **Estado:** funcional en implementación. Pruebas actuales frontend de formulario y cliente HTTP; pruebas backend de autenticación inspeccionadas. Acceso completo contra el despliegue final no reproducido aquí.
- **Archivos:** `frontend/src/components/LoginForm.tsx`, `frontend/src/AuthApp.tsx`, `frontend/src/api/http.ts`; `backend/src/auth/{security,sessions,password}.ts`; `frontend/tests/auth.test.tsx`, `backend/tests/auth.test.cjs`.

### F02. Cierre, vencimiento y cambios de sesión

- **Descripción y ubicación:** «Cerrar sesión», parte inferior del menú lateral; mensajes de sesión en el acceso.
- **Procedimiento:** 1) Abrir el menú si está contraído. 2) Pulsar «Cerrar sesión». 3) Esperar «Sesión cerrada» y el formulario de acceso. Para sesión vencida, volver a ingresar credenciales.
- **Roles:** todos.
- **Resultado:** revocación de la sesión presentada y eliminación de cookie. Ante fallo del cierre, la interfaz informa y permite volver a intentar.
- **Advertencias:** duración fija de ocho horas; reiniciar el backend pierde las sesiones en memoria. Un cambio de contraseña invalida sesiones previas por versión de credenciales. Los cambios de rol/estado se consultan al recuperar foco y se validan de nuevo en solicitudes protegidas.
- **Estado:** funcional en implementación; pruebas automatizadas de cliente, vencimiento y seguridad existentes. No se comprobó un ciclo real de ocho horas.
- **Archivos:** `frontend/src/AuthApp.tsx`, `frontend/src/components/UserNavigation.tsx`, `frontend/src/api/http.ts`; `backend/src/auth/{security,sessions}.ts`, `backend/src/data/password-resets.ts`; pruebas `auth` de ambas aplicaciones.

### F03. Navegación e identificación del usuario

- **Descripción y ubicación:** barra superior con nombre y rol, menú lateral contraíble; Dashboard, Historial, Estado del nodo y, para administrador, Usuarios.
- **Procedimiento:** 1) Expandir el menú con su botón si es necesario. 2) Elegir la vista. 3) Identificar la opción activa. El menú también admite cierre mediante Escape y fondo exterior cuando está expandido.
- **Roles:** todos, con Usuarios exclusivo para ADMINISTRADOR.
- **Resultado:** cambio de vista dentro de la aplicación; no crea una URL individual para cada pantalla.
- **Advertencias:** ocultar una opción no es la única barrera: backend exige rol administrador para usuarios. El comportamiento visual en dispositivos y navegadores finales necesita revisión humana.
- **Estado:** funcional en implementación; navegación y marcado activo cubiertos por pruebas de representación.
- **Archivos:** `frontend/src/components/UserNavigation.tsx`, `frontend/src/AuthApp.tsx`, `frontend/src/styles.css`; `frontend/tests/{auth,telemetry,single-node}.test.tsx`.

### F04. Consulta del dashboard

- **Descripción y ubicación:** Dashboard, resumen de última medición de LADERA-1: semáforo, humedad RAW, vibración, inclinación, referencia visual, temperatura y recepción.
- **Procedimiento:** 1) Entrar al dashboard. 2) Revisar «Última recepción». 3) Comprobar si los datos son recientes. 4) Consultar magnitudes y estado experimental sin equipararlos a riesgo global.
- **Roles:** todos.
- **Resultado:** última fila disponible y orientación asociada cuando existe. Si no hay filas, muestra que el nodo todavía no tiene mediciones.
- **Errores:** carga inicial fallida, respuesta de API inválida o tiempo de espera; ofrece «Actualizar ahora». Un dato conservado tras fallar una actualización no se convierte en una lectura nueva.
- **Estado:** funcional en implementación para telemetría; interpretación de riesgo global pendiente. Pruebas actuales de representación y validación, sin comprobación integral actual con nodo físico.
- **Archivos:** `frontend/src/App.tsx`, `frontend/src/components/TelemetryViews.tsx`, `frontend/src/api/telemetry.ts`; `backend/src/controllers/readings.ts`, `backend/src/data/readings.ts`; `frontend/tests/telemetry.test.tsx`.

### F05. Actualización de pantalla

- **Descripción y ubicación:** controles superiores de Dashboard y Estado del nodo; «Actualizar ahora» también está en Historial.
- **Procedimiento:** 1) Elegir «Actualización de pantalla»: 10 segundos (pruebas), 5, 10, 15 o 30 minutos, 1 hora o Solo manual. 2) Usar «Actualizar ahora» cuando se requiera. 3) Revisar «Última consulta» y «Última recepción» por separado.
- **Roles:** todos.
- **Resultado:** nueva consulta inmediata al cargar/cambiar el intervalo y consultas periódicas si el intervalo es mayor que cero. Las solicitudes periódicas no se solapan. Recuperar foco o visibilidad puede provocar consulta con actualización automática habilitada.
- **Advertencias:** cambia solo la pantalla; el firmware tiene envío nominal cada diez segundos. No garantiza una nueva muestra con cada clic. La preferencia no se guarda en almacenamiento persistente. El historial no tiene ese selector ni actualización periódica. Con intervalos largos o modo manual el semáforo puede quedar gris por antigüedad de la lectura mostrada, aunque el nodo siga enviando.
- **Errores:** si ya había datos y falla una actualización automática, se conserva la última recepción con advertencia. Consultas HTTP tienen límite temporal de quince segundos.
- **Estado:** funcional en implementación y pruebas actuales de polling/intervalos; cadencia real dependiente de red, navegador y nodo.
- **Archivos:** `frontend/src/App.tsx`, `frontend/src/reception.ts`, `frontend/src/api/{pollLatest,http}.ts`; `frontend/tests/reception.test.tsx`, `firmware/landsis_ladera1/telemetria.h`.

### F06. Historial detallado y gráfica de humedad

- **Descripción y ubicación:** Historial, filtros superiores, gráfica «Humedad del suelo — RAW ADC» y tabla «Historial de mediciones almacenadas».
- **Procedimiento:** 1) Abrir Historial. 2) Indicar límite de 1 a 100, por defecto 50. 3) Opcionalmente completar Desde y Hasta con hora local. 4) Pulsar «Consultar historial». 5) Revisar gráfica y tabla. 6) Usar «Actualizar ahora» para repetir la consulta aplicada.
- **Roles:** todos.
- **Resultado:** tabla con las lecturas más recientes primero, desempate por ID; gráfica con los datos recuperados ordenados cronológicamente. Desde incluye el instante; Hasta lo excluye. Se puede usar un solo extremo temporal.
- **Errores:** límite fuera de rango, fin no posterior al inicio, ausencia de lecturas, fallo de conexión/API. Si falla cualquiera de los dos listados solicitados en conjunto, la vista presenta error de carga.
- **Advertencias:** límite de resultados, sin paginación ni exportación CSV/PDF implementada. La gráfica no equivale al conjunto completo de datos almacenados. Sus etiquetas temporales muestran horas locales y pueden ser ambiguas entre días: la tabla conserva fecha y hora.
- **Estado:** funcional en implementación; pruebas actuales frontend y pruebas backend de consultas inspeccionadas. No se comprobó consulta contra la base real en esta tarea.
- **Archivos:** `frontend/src/App.tsx`, `frontend/src/components/{TelemetryViews,MoistureChart}.tsx`, `frontend/src/api/telemetry.ts`; `backend/src/readings/query.ts`, `backend/src/data/readings.ts`; `frontend/tests/telemetry.test.tsx`, `backend/tests/{readings,nodes}.test.cjs`.

### F07. Mediciones diarias

- **Descripción y ubicación:** primera sección de Historial, antes de la gráfica.
- **Procedimiento:** 1) Abrir Historial. 2) Aplicar los mismos filtros de intervalo y límite. 3) Revisar Día, Hora de recepción, Humedad RAW y Vibración.
- **Roles:** todos.
- **Resultado:** una fila real por día con datos, la última dentro del intervalo consultado, usando fecha de Guatemala. Omite días sin datos; no crea registros ni calcula promedios. En empates de recepción elige mayor ID.
- **Advertencias:** el límite se aplica a días en esta sección y a filas en el historial detallado, mediante consultas independientes. Si el fin recorta un día, selecciona la última fila dentro de ese recorte, no necesariamente la última de todo el día.
- **Errores:** los mismos de F06; mensaje específico si no hay mediciones diarias.
- **Estado:** funcional en implementación; pruebas actuales frontend de representación y zona horaria, SQL y endpoint inspeccionados en backend. Consulta real pendiente en esta revisión.
- **Archivos:** `frontend/src/components/DailyReadings.tsx`, `frontend/src/App.tsx`; `backend/src/data/readings.ts`, `backend/src/routes/readings.ts`; pruebas `daily-readings` de ambas aplicaciones.

### F08. Detalle de sensores MPU6050

- **Descripción y ubicación:** Historial → fila → «Ver MPU». Aceleración X/Y/Z, giroscopio X/Y/Z y temperatura del módulo.
- **Procedimiento:** 1) Consultar Historial. 2) Localizar fecha de interés. 3) Abrir «Ver MPU». 4) Leer magnitudes con sus unidades; cerrar el desplegable si se desea.
- **Roles:** todos.
- **Resultado:** valores recibidos y almacenados de esa medición, o «Sin lectura» si no existen. «Telemetría MPU disponible» exige los siete campos presentes.
- **Advertencias:** no es un diagnóstico físico completo del sensor ni análisis de movimiento del terreno. El dashboard no presenta la tabla cruda de aceleración/giroscopio; estos valores están en el detalle histórico.
- **Estado:** funcional en implementación; pruebas actuales de campos, ausencia y validación de bloques. Existe evidencia física histórica del bloque MPU; operación presente no reproducida aquí.
- **Archivos:** `frontend/src/components/{MpuPanel,TelemetryViews}.tsx`, `frontend/src/presentation.ts`; `backend/src/readings/reading.ts`, `backend/src/data/readings.ts`, `database/002_add_mpu6050_fields_to_sensor_readings.sql`; pruebas `telemetry` y `readings`.

### F09. Inclinación relativa y referencia visual

- **Descripción y ubicación:** tarjeta INCLINACIÓN y panel «Inclinación relativa» del Dashboard; esquema «Referencia visual del nodo» con dos ejes.
- **Procedimiento:** 1) Verificar recepción reciente. 2) Si aparece «Calibrando referencia», mantener inmóvil el montaje siguiendo el protocolo físico aprobado. 3) Leer Delta roll y Delta pitch, referencia de arranque y estado. 4) Usar el esquema como apoyo visual por eje.
- **Roles:** todos, en consulta; no hay botón web para recalibrar.
- **Resultado:** grados con dos decimales; esquema 1:1 del delta recibido respecto de referencia gris discontinua y posición azul. Sin orientación reciente el esquema queda neutral. Los números históricos conservados en pantalla pueden seguir visibles aunque ya no sean recientes: comprobar fecha y semáforo.
- **Errores/advertencias:** esperando orientación, calibrando referencia, sin lectura válida o datos antiguos. La referencia cambia al reiniciar el nodo. No mide desplazamiento del suelo. La orientación solo está en memoria del backend, asociada a ID y nodo, con caché acotada a 256 entradas; reiniciar el backend puede dejar última fila con datos MPU y sin orientación hasta otro envío.
- **Estado:** parcialmente implementada como capacidad histórica: consulta actual implementada, sin persistencia de ángulos ni historial de inclinación. Pruebas actuales frontend y pruebas backend inspeccionadas. Validación física documentada parcial.
- **Archivos:** `frontend/src/components/{OrientationPanel,NodeTiltReference,TelemetryViews}.tsx`; `backend/src/readings/orientation.ts`, `backend/src/controllers/readings.ts`; `firmware/landsis_ladera1/{orientacion.h,telemetria.h}`; pruebas `orientation`, `node-tilt-reference`.

### F10. Semáforo experimental de inclinación

- **Descripción y ubicación:** primer panel del Dashboard, con NORMAL, PRECAUCIÓN, ALERTA y CRÍTICO; texto «Riesgo global: no evaluado».
- **Procedimiento:** 1) Verificar vigencia de recepción. 2) Identificar nivel activo y persistencia. 3) Si está gris, revisar el mensaje específico y actualizar. 4) Seguir únicamente el protocolo humano aprobado para observaciones del prototipo.
- **Roles:** todos.
- **Resultado:** activa un nivel recibido del firmware cuando la orientación es válida, la persistencia es compatible y la recepción tiene menos de sesenta segundos. No deriva CRÍTICO de un delta aislado. Puede mostrar persistencia en observación sin confirmar nivel superior.
- **Errores/advertencias:** sin datos recientes, fecha por verificar, esperando datos/orientación, calibrando, sin lectura válida o persistencia sin confirmar. NORMAL no certifica seguridad del terreno. Humedad y vibración no modifican este semáforo.
- **Estado:** funcional en implementación para inclinación experimental; evaluación global pendiente. Pruebas actuales del semáforo y vigencia aprobadas; criterios físicos no certificados.
- **Archivos:** `frontend/src/components/RiskPanel.tsx`, `frontend/src/reception.ts`, `firmware/landsis_ladera1/orientacion.h`; `frontend/tests/{risk-panel,reception,orientation}.test.tsx`.

### F11. Estado técnico del nodo

- **Descripción y ubicación:** menú «Estado del nodo» → «Disponibilidad de datos del nodo».
- **Procedimiento:** 1) Abrir Estado del nodo. 2) Revisar última recepción y estado de recepción. 3) Consultar disponibilidad MPU6050, humedad, vibración e inclinación relativa. 4) Actualizar si corresponde.
- **Roles:** todos.
- **Resultado:** indicadores calculados desde la última lectura; recepción reciente, sin recepción reciente, sin datos o hora por verificar.
- **Advertencias:** datos recibidos alguna vez no significan conexión actual. No incluye batería, RSSI, diagnóstico eléctrico, control remoto ni localización geográfica. Un valor ADC admitido no certifica que el sensor esté bien conectado.
- **Estado:** funcional en implementación como disponibilidad de datos, no diagnóstico integral. Pruebas actuales de presentación y recepción.
- **Archivos:** `frontend/src/components/TelemetryViews.tsx`, `frontend/src/reception.ts`, `frontend/src/presentation.ts`; pruebas `telemetry` y `reception`.

### F12. Listar y crear usuarios

- **Descripción y ubicación:** Usuarios, tabla de Nombre, Correo, Rol, Estado y Acción; botón «+ Nuevo usuario».
- **Procedimiento:** 1) Ingresar como administrador. 2) Abrir Usuarios. 3) Pulsar «+ Nuevo usuario». 4) Completar nombre, correo, rol, contraseña y confirmación; elegir Usuario activo. 5) Pulsar «Guardar usuario» o «Cancelar».
- **Roles:** ADMINISTRADOR; puede crear cuentas de los tres roles. Rol inicial del formulario: INVESTIGADOR; estado inicial: activo.
- **Resultado:** cuenta creada y listado actualizado, con «Usuario creado». Contraseña de 12 a 128 caracteres Unicode, sin reglas de composición, no solo espacios; confirmación exacta. Nombre de hasta 100 caracteres y correo de hasta 254, normalizado a minúsculas y sin espacios exteriores por backend.
- **Errores:** contraseñas distintas, política no cumplida, datos inválidos, correo ya registrado, sesión/permisos insuficientes o servicio no disponible. El correo continúa siendo único incluso para una cuenta eliminada lógicamente: no se promete reutilización.
- **Estado:** funcional en implementación; pruebas frontend de acceso y cliente, pruebas backend de creación/validación inspeccionadas. No se creó una cuenta real aquí. El formulario completo requiere prueba humana de interacción.
- **Archivos:** `frontend/src/components/UsersPanel.tsx`; `backend/src/auth/{security,user,password}.ts`, `backend/src/data/users.ts`, `database/004_create_users_and_roles.sql`; pruebas `auth`, `users-store`.

### F13. Editar, activar o desactivar usuarios

- **Descripción y ubicación:** Usuarios → «Editar».
- **Procedimiento:** 1) Localizar la cuenta. 2) Pulsar Editar. 3) Cambiar nombre, rol o casilla Usuario activo. 4) Guardar o cancelar. 5) Verificar estado actualizado.
- **Roles:** ADMINISTRADOR; puede editar su propia cuenta con las restricciones de continuidad administrativa.
- **Resultado:** «Usuario actualizado». El correo está deshabilitado en edición y la API no acepta cambiar correo ni contraseña por PATCH.
- **Errores/advertencias:** debe quedar al menos un administrador activo. Con otro administrador activo, cambiar el propio rol o desactivarse puede quitar acceso administrativo o cerrar la sesión. Backend consulta el rol actual, no confía solo en el menú. La desactivación bloquea solicitudes mientras la cuenta permanezca inactiva; no equivale a eliminación ni promete revocación irreversible de todas las cookies si luego se reactiva.
- **Estado:** funcional en implementación; restricciones y bloqueo transaccional inspeccionados y cubiertos por pruebas existentes. Escenarios reales de concurrencia no reproducidos.
- **Archivos:** `frontend/src/components/UsersPanel.tsx`, `frontend/src/AuthApp.tsx`; `backend/src/auth/security.ts`, `backend/src/data/users.ts`; `backend/tests/{auth,users-store}.test.cjs`.

### F14. Eliminar lógicamente usuarios

- **Descripción y ubicación:** Usuarios → «Eliminar» en cuentas no administradoras → diálogo de confirmación.
- **Procedimiento:** 1) Revisar cuidadosamente nombre y cuenta objetivo. 2) Pulsar Eliminar. 3) Leer que perderá acceso y se conservarán datos históricos. 4) Cancelar o confirmar Eliminar. 5) Comprobar «Usuario eliminado» y desaparición del listado.
- **Roles:** ADMINISTRADOR. No puede eliminarse a sí mismo ni eliminar una cuenta cuyo rol actual sea ADMINISTRADOR, incluso si hay otros administradores.
- **Resultado:** se marca eliminación lógica, incrementa versión de credenciales y retira tokens de recuperación. La cuenta deja de aparecer en búsquedas/listados elegibles. No se borran mediciones históricas.
- **Errores:** usuario inexistente, cuenta administradora, autoeliminación, ID inválido, sesión/permisos o fallo de servicio. La protección existe en servidor aunque se fabrique una solicitud; el botón Eliminar se oculta para administradores.
- **Advertencias:** no hay interfaz de restauración de eliminados ni borrado físico. No confundir con desactivar una cuenta, que permanece visible y editable.
- **Estado:** funcional en implementación; pruebas actuales de acción/DELETE del cliente y pruebas backend inspeccionadas. No se eliminó ninguna cuenta real.
- **Archivos:** `frontend/src/components/UsersPanel.tsx`; `backend/src/auth/security.ts`, `backend/src/data/users.ts`, `database/006_soft_delete_users.sql`; pruebas `auth`, `users-store`.

### F15. Solicitar recuperación de contraseña

- **Descripción y ubicación:** inicio → «¿Olvidaste tu contraseña?» → Recuperar contraseña.
- **Procedimiento:** 1) Abrir el enlace. 2) Escribir correo asociado. 3) Pulsar «Enviar enlace de recuperación». 4) Leer el mensaje genérico. 5) Revisar correo y no deseados en una cuenta propia autorizada; si no llega, solicitar asistencia sin divulgar credenciales.
- **Roles:** público; aplica a cuentas activas no eliminadas de cualquiera de los tres roles.
- **Resultado:** «Si la cuenta puede recuperarse, recibirás un correo con instrucciones». No confirma existencia, elegibilidad, generación ni entrega. Con correo deshabilitado, la API también responde genéricamente y no envía.
- **Errores/advertencias:** correo inválido, demasiadas solicitudes, fallos de red; el límite por cuenta es silencioso. Los errores asíncronos de base/SMTP no se reflejan necesariamente en la respuesta ya enviada. Requiere activación de recuperación, URL frontal correcta, SMTP y estructura de datos compatible. La cola es temporal y sin reintentos automáticos.
- **Estado:** parcialmente verificable: interfaz y flujo implementados, entrega real dependiente de configuración. Pruebas actuales frontend aprobadas; pruebas backend de API/correo inspeccionadas. El correo manual histórico no acredita este flujo completo.
- **Archivos:** `frontend/src/components/RecoveryViews.tsx`, `frontend/src/recovery.ts`; `backend/src/routes/password-recovery.ts`, `backend/src/server.ts`, `backend/src/config/recovery.ts`, `backend/src/auth/recovery-limits.ts`, `backend/src/mail/service.ts`; pruebas `recovery`, `recovery-api`, `mail`.

### F16. Restablecer contraseña mediante enlace

- **Descripción y ubicación:** enlace recibido → Establecer nueva contraseña → Contraseña restablecida.
- **Procedimiento:** 1) Abrir el enlace original en un navegador de confianza. 2) Introducir nueva contraseña y confirmación idéntica, de 12 a 128 caracteres y no solo espacios. 3) Pulsar «Restablecer contraseña». 4) Esperar confirmación. 5) Volver al inicio e ingresar la nueva contraseña.
- **Roles:** poseedor de enlace válido de cuenta activa no eliminada, sin requerir sesión.
- **Resultado:** cambia contraseña y versión de credenciales, consume token y exige iniciar sesión; no hay acceso automático ni correo de confirmación conectado a este cambio. Token de un uso, vigencia de quince minutos; emitir uno nuevo sustituye al anterior para esa cuenta.
- **Errores/advertencias:** enlace ausente, incompleto, manipulado, usado o vencido; contraseñas distintas, política inválida, límites o servicio inaccesible. Recargar después de retirar el fragmento pierde el token del formulario. Se puede reabrir el enlace original mientras siga válido o solicitar otro.
- **Estado:** funcional en implementación, comprobación integral de correo → cambio real → revocación pendiente aquí. Pruebas actuales frontend aprobadas; transacciones y pruebas backend inspeccionadas.
- **Archivos:** `frontend/src/recovery.ts`, `frontend/src/components/RecoveryViews.tsx`; `backend/src/auth/password-recovery.ts`, `backend/src/data/password-resets.ts`, `backend/src/routes/password-recovery.ts`, `database/005_create_password_resets.sql`; pruebas `recovery`, `password-recovery`, `password-recovery-postgres`, `recovery-api`.

### F17. Aviso visual por falta de comunicación tras inclinación confirmada

- **Descripción y ubicación:** Dashboard, enlace «Ver aviso del nodo» y panel especial al final cuando se activa.
- **Procedimiento:** 1) Revisar el aviso y la última recepción. 2) Actualizar para confirmar datos. 3) Solicitar revisión de alimentación, red y montaje conforme al protocolo acordado. 4) Si vuelve la comunicación, observar «Comunicación restablecida».
- **Roles:** todos los que consulten ese dashboard; estado guardado localmente en el navegador.
- **Resultado:** se arma ante ALERTA o CRÍTICO confirmado 6/6 y se activa tras al menos sesenta segundos sin nueva recepción, corroborados por una consulta exitosa posterior al límite. Modo lento/manual por sí solo no prueba desconexión. Un registro nuevo que desarma la condición antes del vencimiento evita activación.
- **Advertencias:** el título actual de pérdida de comunicación es «Sayonara, mundo… fue un placer 👋». No acredita daño ni sepultamiento; la propia pantalla menciona causas de alimentación/red. Sin recuperación el aviso puede durar más de una hora. Tras recuperación se conserva hasta completar al menos una hora desde activación. No es un historial central: usa almacenamiento local compartido en ese navegador/origen y no ligado a una cuenta.
- **Estado:** funcional en implementación y lógica probada; presentación y persistencia reales entre sesiones/navegadores pendientes de aceptación humana. No se provocó una desconexión física.
- **Archivos:** `frontend/src/nodeNotice.ts`, `frontend/src/components/NodeNotice.tsx`, `frontend/src/components/TelemetryViews.tsx`; `frontend/tests/node-notice.test.tsx`.

### F18. Correos automáticos de inclinación crítica

- **Descripción y ubicación:** servicio backend sin pantalla de configuración; consulta externa en correo del destinatario.
- **Procedimiento del usuario:** 1) Mantener una cuenta activa con dirección correcta. 2) Si llega un aviso, revisar nodo, recepción, deltas y persistencia. 3) Entrar por la dirección conocida del sistema y contrastar la lectura. 4) Aplicar el protocolo humano que se apruebe; el mensaje no declara deslizamiento.
- **Roles:** destinatarios elegibles de los tres roles; el código no tiene suscripción individual ni filtro por rol. Envía a direcciones válidas y únicas de usuarios activos no eliminados, individualmente.
- **Resultado:** con activación, SMTP y tabla de control disponibles, procesa nuevas mediciones guardadas de LADERA-1. Exige orientación ready, CRÍTICO, contador crítico 6/6 y máximo delta absoluto de al menos 2°. Solo rearma después de NORMAL con ambos deltas absolutos menores de 0,5° y todos los contadores en cero. Son criterios experimentales existentes, no recomendaciones geotécnicas.
- **Errores/advertencias:** un intento por destinatario y evento, sin reintento automático; cola en memoria limitada a 32 mediciones pendientes. No reenvía por consultar la pantalla ni recorre históricos al arrancar. La condición activa se guarda en PostgreSQL para controlar repetidos. Puede quedar entrega fallida/parcial/pending; no existe pantalla de seguimiento ni acuse de lectura. Aceptación SMTP no garantiza recepción o actuación.
- **Estado:** parcialmente verificada: integración y control de duplicados implementados; pruebas con transporte simulado existentes. Nota del 3 de noviembre registra activación local y procesamiento sin disparo, pero entrega automática ante evento físico real sigue pendiente. No se inspeccionó configuración privada actual.
- **Archivos:** `backend/src/server.ts`, `backend/src/alerts/{notifier,store,types}.ts`, `backend/src/config/alerts.ts`, `backend/src/mail/{service,inclination-template}.ts`, `database/007_inclination_email_state.sql`; `backend/tests/inclination-alert.test.cjs`, `docs/avisos-inclinacion-2026-11-03.md`.

## 4. Matriz de roles y permisos

Sí: permitido para cuenta activa no eliminada y, salvo recuperación, sesión válida. «Condicionado» se detalla debajo. No se encontraron permisos de consulta diferenciados entre INVESTIGADOR y CONRED.

| Operación | ADMINISTRADOR | INVESTIGADOR | CONRED |
|---|:---:|:---:|:---:|
| Iniciar/cerrar sesión y consultar propia sesión | Sí | Sí | Sí |
| Dashboard y última medición LADERA-1 | Sí | Sí | Sí |
| Historial, filtros, gráfica y selección diaria | Sí | Sí | Sí |
| Consultar detalle MPU e inclinación disponible | Sí | Sí | Sí |
| Consultar estado técnico, semáforo y aviso visual | Sí | Sí | Sí |
| Actualizar pantalla y elegir intervalo | Sí | Sí | Sí |
| Listar catálogo de nodos mediante API | Sí | Sí | Sí |
| Acceder a Usuarios y listar cuentas | Sí | No | No |
| Crear cuentas de cualquiera de los tres roles | Sí | No | No |
| Editar nombre, rol y estado de cuentas | Condicionado | No | No |
| Activar/desactivar cuentas no eliminadas | Condicionado | No | No |
| Eliminar lógicamente cuenta no administradora | Condicionado | No | No |
| Eliminar cuenta con rol ADMINISTRADOR | No | No | No |
| Eliminar la propia cuenta | No | No | No |
| Cambiar correo mediante edición de usuario | No | No | No |
| Cambiar contraseña de otro usuario desde Usuarios | No | No | No |
| Solicitar recuperación de cuenta propia | Público/elegible | Público/elegible | Público/elegible |
| Restablecer contraseña propia con enlace válido | Sí | Sí | Sí |
| Recibir correo automático de inclinación | Condicionado | Condicionado | Condicionado |
| Configurar umbrales/calibración desde la web | No disponible | No disponible | No disponible |
| Exportar informes, restaurar eliminados o borrar mediciones desde la web | No disponible | No disponible | No disponible |

### 4.1 Restricciones verificadas en código

1. Usuarios exige autenticación y `requireRole('ADMINISTRADOR')` en servidor para listar, crear, editar y eliminar; no depende exclusivamente de ocultar el menú.
2. Edición acepta únicamente nombre, rol y estado. Se rechazan campos adicionales, correo o contraseña. Un bloqueo transaccional serializa edición y eliminación para proteger las restricciones.
3. Debe permanecer al menos un administrador activo. Se permite modificar la propia cuenta si no incumple esa regla, con posible pérdida inmediata de permisos.
4. DELETE rechaza autoeliminación y cualquier cuenta actualmente administradora. No debe documentarse «eliminar administradores sobrantes». La edición de rol es una operación separada con su propia validación.
5. La eliminación usa `deleted_at`; excluye esas cuentas de consultas, invalida credenciales previas y retira recuperación. `active` es un estado diferente y no se cambia necesariamente al eliminar.
6. Contraseñas se almacenan mediante hash scrypt con sal; salidas públicas excluyen hash y versión interna. Tokens de recuperación se persisten como digest y se consumen transaccionalmente.
7. Cookie de sesión HttpOnly, SameSite Strict y Secure cuando `NODE_ENV=production`; sesiones y limitadores viven en un solo proceso. Ocho horas no son un tiempo de inactividad renovable en el código inspeccionado.
8. Mutaciones humanas exigen JSON y cabecera propia. El frontend usa solicitudes al mismo origen; no se encontró CORS habilitado. La operación en producción depende de HTTPS, proxy y servicio de rutas públicas correctamente configurados.
9. Login limita diez intentos por IP en quince minutos y dos verificaciones simultáneas. Recuperación limita solicitud por IP y cuenta; reset por IP y token, con ventana de quince minutos. Los límites locales pueden afectar usuarios que comparten salida de red.
10. **La entrada IoT `POST /readings` no autentica identidad del ESP32.** Valida estructura y tipos, pero el nombre LADERA-1 no prueba quién envió la medición. No se debe atribuir al sistema autenticación de dispositivo, integridad de transporte o protección integral por los roles humanos.

Referencias: `backend/src/app.ts`, `backend/src/auth/{security,sessions,user,password,recovery-limits}.ts`, `backend/src/data/{users,password-resets}.ts`, `backend/src/readings/reading.ts`, `frontend/src/api/http.ts`, migraciones `004`, `005` y `006`.

## 5. Datos del monitoreo: nombres, unidades, formatos y procedencia

| Dato y nombre mostrado | Unidad/formato real | Procedencia y tratamiento | Ubicación y límites |
|---|---|---|---|
| HUMEDAD DEL SUELO / Humedad RAW | Entero RAW ADC; rango admitido 0–4095 | Sensor analógico; firmware promedia diez lecturas y transmite el promedio entero. No es porcentaje ni valor calibrado de contenido de agua. | Dashboard, tabla diaria, historial y gráfica. «Lectura RAW — pendiente de calibración». No inferir más/menos agua sin calibración aprobada. |
| VIBRACIÓN | «Detectada», «No detectada»; ausencia: «Sin lectura» | Entrada digital convertida a booleano. Firmware retiene detección pendiente hasta confirmación de envío correspondiente; puede abarcar más que un instante si falló comunicación. | Dashboard e históricos. No informa intensidad, frecuencia, cantidad de eventos o magnitud sísmica. |
| Aceleración, ejes X/Y/Z | m/s²; valor numérico original, sin redondeo fijo añadido por el componente | Lectura de la biblioteca del MPU6050 recibida en `accelX/Y/Z`; no es una cuenta ADC cruda ni desplazamiento. | Historial → Ver MPU. No se sustrae expresamente gravedad en este flujo para obtener movimiento del terreno. |
| Giroscopio, ejes X/Y/Z | rad/s; valor numérico original | Velocidad angular del MPU6050 `gyroX/Y/Z`. No se integra en la web para obtener inclinación. | Historial → Ver MPU. No confundir rad/s con grados de roll/pitch. |
| Temperatura MPU6050 | °C; dos decimales en panel de orientación; valor original en detalle histórico | Temperatura interna del módulo, dato de diagnóstico. | Dashboard en panel de orientación e Historial → Ver MPU; no es temperatura del suelo o ambiente. |
| Roll actual / Pitch actual | Grados, dos decimales | Calculados en firmware desde aceleración con funciones trigonométricas y promedio móvil. | Dashboard; no hay historial persistente de estos ángulos. |
| Baseline roll / Baseline pitch | Grados, dos decimales | Referencia calculada al arranque; no es una calibración metrológica permanente. | Dashboard, orientación y correo cuando aplica. Reinicio del nodo genera nueva referencia. |
| Delta roll / Delta pitch | Grados con signo y dos decimales | Diferencia angular calculada en firmware respecto de baseline, normalizada angularmente. | Tarjeta, panel de orientación y esquema; no es desplazamiento del terreno. |
| Estado de inclinación / semáforo | NORMAL, PRECAUCIÓN, ALERTA, CRÍTICO | Firmware clasifica y cuenta persistencia; frontend comprueba vigencia y compatibilidad del estado, no combina humedad/vibración. | Dashboard. Experimental, condicionado a datos válidos y recientes. |
| Persistencia | «precaución n/6 · alerta n/6 · crítico n/6» | Contadores de evaluaciones del firmware; no cantidad de muestras HTTP recibidas ni segundos exactos. | Dashboard y correo. Cadencia nominal de evaluación de diez segundos. |
| Última recepción / Fecha/hora | Fecha y hora con segundos, formato localizado `es-GT` | PostgreSQL asigna `received_at` al insertar. API serializa ISO; representa recepción/registro, no hora de adquisición del ESP32. | Dashboard, Estado y tabla detallada usan zona del navegador. |
| Día / Hora de recepción | Fecha y hora de America/Guatemala | Selección SQL y formato diario con zona Guatemala explícita. | Mediciones diarias; a diferencia de las otras vistas, no cambia a otra zona del navegador. |
| Última consulta | Fecha/hora local del navegador | Calculada por frontend después de consulta exitosa; no viene del sensor. | Controles de actualización; puede avanzar sin que llegue otra medición. |
| Recepción reciente / sin recepción reciente | Menos de 60 s / 60 s o más | Calculada por frontend desde recepción y reloj del navegador; fecha futura es «por verificar». | Dashboard y Estado. Es vigencia de datos, no conexión Wi-Fi probada ni nivel de riesgo. |
| Riesgo global | «No evaluado» | No existe evaluador combinado conectado. | Dashboard y pie de aplicación; no se asigna seguridad o predicción. |

### 5.1 Criterios experimentales realmente existentes

El firmware inspeccionado usa el máximo absoluto entre delta roll y delta pitch, con referencias experimentales de **0,5°, 1° y 2°**, respectivamente para contadores de precaución, alerta y crítico. Evalúa nominalmente cada diez segundos y exige seis evaluaciones persistentes; el nivel superior confirmado prevalece. Un retorno por debajo del criterio reinicia el contador correspondiente; no deben describirse como seis clics, seis registros recibidos o un plazo exacto garantizado de sesenta segundos.

Estos números se registran para trazabilidad del código, **no como umbrales definitivos de riesgo** ni como valores validados por CONRED. No hay controles web para editarlos. La validez científica de los criterios y el significado operacional requieren confirmación especializada.

La estabilización y referencia inicial están implementadas en firmware (estabilización inicial, 75 muestras de referencia y ventana móvil de diez). La documentación física pide montaje inmóvil y al menos ochenta segundos tras reiniciar para la instalación. Ese protocolo debe confirmarse para el equipo final; no se propone reiniciar desde la web ni recalibrar durante una situación observada para borrar un estado.

### 5.2 Validación y conservación

- Backend valida objeto y campos permitidos, identificador no vacío, humedad entera 0–4095 y vibración booleana. El bloque MPU es opcional, pero si llega exige los siete números finitos; no admite bloques parciales. Orientación exige bloque MPU y estructura validada.
- La validación estructural de orientación no certifica coherencia física ni recalcula los ángulos del dispositivo. El frontend valida también respuestas de telemetría y coincidencia con LADERA-1.
- Se guardan humedad, vibración, siete valores MPU y recepción en PostgreSQL. La orientación **se retira antes de persistir** y solo acompaña a la última fila exacta si está en la caché de ese proceso. No hay historial de baseline, deltas o cambios de semáforo.
- La API admite lecturas sin MPU para compatibilidad; el firmware actual omite envío si no dispone de MPU al arrancar o los valores requeridos no son finitos. Una pantalla sin datos no permite aislar automáticamente cuál componente falló.
- No se encontró almacenamiento durable de todas las muestras durante cortes de red. La próxima transmisión no reconstruye un historial completo del periodo desconectado. La detección de vibración pendiente tampoco conserva todos los eventos y se pierde al reiniciar.

Referencias: `firmware/landsis_ladera1/landsis_ladera1.ino`, `orientacion.h`, `telemetria.h`; `backend/src/readings/{reading,orientation}.ts`, `backend/src/controllers/readings.ts`, `backend/src/data/readings.ts`; `frontend/src/{presentation,reception}.ts`, `frontend/src/types/{telemetry,orientation}.ts`, componentes de telemetría y gráfica; migraciones `001`, `002`, `003`.

## 6. Índice recomendado para el manual definitivo

1. **Portada:** institución, carrera, nombre del sistema, autoría confirmada, versión y fecha del manual.
2. **Control del documento:** versión de aplicación y alcance validado al publicar; responsables de revisión.
3. **Introducción:** propósito del prototipo de monitoreo preventivo y contexto académico.
4. **Objetivo del manual:** acceso, consulta y administración según rol.
5. **Alcance y límites:** nodo LADERA-1, orientación experimental, riesgo global no evaluado y ausencia de predicción certificada.
6. **Requisitos de acceso:** dirección oficial, navegador probado, conectividad, cuenta activa; correo propio si se habilita recuperación.
7. **Roles y permisos:** tabla simplificada de consulta y administración, con restricciones de eliminación.
8. **Acceso y salida:** inicio, cierre, vencimiento y mensajes frecuentes.
9. **Descripción de la interfaz:** barra superior, menú lateral, vistas, estados de carga y controles.
10. **Consulta del dashboard:** humedad RAW, vibración, inclinación relativa, temperatura, recepción y última consulta.
11. **Actualización de pantalla:** intervalos y modo manual; diferencia con envío del nodo.
12. **Consulta histórica:** filtros, selección diaria, gráfica y detalle MPU; límites y zonas horarias.
13. **Estado del nodo e interpretación responsable:** disponibilidad técnica, datos antiguos y ausencia de lecturas.
14. **Semáforo experimental y avisos:** persistencia, indicador gris, comunicación perdida/restablecida y correo opcional con límites aprobados.
15. **Gestión de usuarios — solo administrador:** listar, crear, editar, activar/desactivar, eliminar lógicamente y restricciones.
16. **Recuperación y restablecimiento de contraseñas:** solicitud, enlace, nueva contraseña y errores.
17. **Solución de problemas frecuentes:** acciones seguras para el usuario y escalamiento al responsable.
18. **Recomendaciones de seguridad y privacidad:** sesiones, credenciales, enlaces y equipos compartidos.
19. **Glosario:** ADC/RAW, lectura, recepción, MPU6050, aceleración, velocidad angular, roll, pitch, baseline, delta, persistencia, eliminación lógica y rol.
20. **Contacto y soporte autorizado:** responsable y canal institucional confirmados; no copiar datos personales de pruebas sin autorización.

La instalación física, ajustes de firmware, SQL, variables de entorno y diagnóstico SMTP deben quedar en documentación técnica separada. No son pasos para usuarios finales. Si una función opcional no está activa en la versión publicada, describir su indisponibilidad o excluir el procedimiento operativo correspondiente con una nota de alcance.

## 7. Plan de capturas

No se generaron imágenes en esta tarea. Las rutas internas se indican como `/` + selección del menú; no son enlaces directos independientes. Las capturas con estados excepcionales deben prepararse en un entorno controlado, sin insertar eventos críticos ni enviar correos a usuarios reales para obtener una imagen.

| ID / pantalla | Ruta | Acción o estado visible | Pie de imagen propuesto | Rol necesario |
|---|---|---|---|---|
| C01 Inicio de sesión | `/` sin sesión | Formulario vacío y enlace de recuperación | «Formulario de acceso a LANDSIS LADERA-1». | Público |
| C02 Error de acceso | `/` sin sesión | Error de credenciales con datos ficticios y contraseña vacía | «Mensaje mostrado cuando no se puede validar el acceso». | Público, entorno de prueba |
| C03 Interfaz general | `/` + Dashboard | Menú expandido, nombre ficticio y rol de consulta | «Elementos principales de la plataforma de monitoreo». | INVESTIGADOR o CONRED |
| C04 Dashboard reciente | `/` + Dashboard | Recepción reciente, RAW, vibración y estado de inclinación identificado | «Resumen de la última medición recibida del nodo». | Cualquiera |
| C05 Actualización | `/` + Dashboard | Selector con intervalos y Actualizar ahora | «Opciones de actualización de la pantalla». | Cualquiera |
| C06 Inclinación relativa | `/` + Dashboard | Deltas, baseline y referencia visual por ejes | «Cambio angular relativo a la referencia de arranque». | Cualquiera |
| C07 Datos no recientes | `/` + Dashboard | Semáforo gris y última recepción antigua | «El indicador deja de mostrar un nivel activo cuando faltan datos recientes». | Cualquiera, estado de prueba |
| C08 Calibración o ausencia | `/` + Dashboard | Calibrando referencia o esperando orientación, claramente identificado | «Estado de espera antes de disponer de orientación válida». | Cualquiera, estado de prueba |
| C09 Filtros históricos | `/` + Historial | Límite, Desde, Hasta y Consultar historial | «Filtros para consultar mediciones dentro de un intervalo». | Cualquiera |
| C10 Mediciones diarias | `/` + Historial | Filas por día y nota de hora Guatemala | «Última medición disponible por día dentro del intervalo consultado». | Cualquiera |
| C11 Gráfica e historial | `/` + Historial | Gráfica RAW, tabla y orden temporal | «Visualización de las lecturas recuperadas para el periodo elegido». | Cualquiera |
| C12 Detalle MPU | `/` + Historial | Ver MPU desplegado para una fila | «Aceleración, velocidad angular y temperatura del módulo de una medición». | Cualquiera |
| C13 Sin resultados | `/` + Historial | Intervalo válido sin mediciones | «Resultado de una consulta sin registros disponibles». | Cualquiera |
| C14 Estado del nodo | `/` + Estado del nodo | Disponibilidad y última recepción | «Indicadores técnicos derivados de los datos recibidos». | Cualquiera |
| C15 Listado de usuarios | `/` + Usuarios | Tabla anonimizada, Editar y Eliminar según rol | «Administración de cuentas y estado de acceso». | ADMINISTRADOR |
| C16 Nuevo usuario | `/` + Usuarios | Formulario vacío, política y rol | «Campos requeridos para registrar una cuenta». | ADMINISTRADOR |
| C17 Editar usuario | `/` + Usuarios | Cuenta ficticia; correo bloqueado, rol y estado | «Edición del nombre, rol y estado de una cuenta». | ADMINISTRADOR |
| C18 Confirmar eliminación | `/` + Usuarios | Diálogo con identidad ficticia, Cancelar/Eliminar | «Confirmación previa a la eliminación lógica de una cuenta». | ADMINISTRADOR |
| C19 Protección administrativa | `/` + Usuarios | Mensaje de último administrador activo | «Restricción para conservar acceso administrativo al sistema». | ADMINISTRADOR, entorno controlado |
| C20 Solicitar recuperación | `/forgot-password` | Formulario vacío | «Solicitud de enlace para recuperar acceso». | Público |
| C21 Solicitud recibida | `/forgot-password` | Mensaje genérico sin dirección personal | «Confirmación de solicitud sin revelar información de la cuenta». | Público |
| C22 Nueva contraseña | `/reset-password` tras limpieza de URL | Campos vacíos y política; nunca fragmento/token | «Formulario para establecer una nueva contraseña». | Cuenta de prueba con enlace válido |
| C23 Contraseña restablecida | `/reset-password` | Confirmación y Volver al inicio de sesión | «Confirmación del cambio de contraseña, sin inicio de sesión automático». | Cuenta de prueba |
| C24 Enlace inválido/vencido | `/reset-password` | Error y Solicitar un nuevo enlace | «Acción disponible cuando el enlace no puede utilizarse». | Público, entorno controlado |
| C25 Cierre de sesión | `/` después del cierre | Sesión cerrada y formulario vacío | «Confirmación del cierre de sesión». | Cualquiera antes del cierre |
| C26 Aviso de comunicación | `/` + Dashboard | Aviso especial y advertencia sobre causas alternativas | «Aviso de falta de comunicación posterior a inclinación confirmada». | Cualquiera, simulación aislada |
| C27 Comunicación restablecida | `/` + Dashboard | Mensaje de recuperación | «Aviso conservado temporalmente después de restablecerse la comunicación». | Cualquiera, simulación aislada |
| C28 Correo de inclinación, opcional | Sin ruta web propia; cliente de correo | Contenido experimental, sin remitente/destinatario privados ni encabezados sensibles | «Ejemplo anonimizado de aviso experimental de inclinación crítica». | Cuenta de prueba autorizada, cualquiera de los roles |

### 7.1 Reglas de preparación

- Utilizar cuentas ficticias o de prueba con autorización; ocultar nombres, correos, avatares, notificaciones del navegador y datos ajenos al ejemplo. No publicar las direcciones personales presentes en componentes o evidencia histórica.
- No mostrar contraseñas, tokens, cookies, herramientas de desarrollo, archivos de configuración, enlaces completos de recuperación ni identificadores de sesión. En C22 verificar la URL limpia antes de capturar.
- Capturar formularios de contraseña vacíos. No generar una eliminación real, un bloqueo del único administrador o una inclinación real peligrosa para ilustrar errores.
- Usar tamaño y escala consistentes; conservar títulos, botones y mensajes legibles. Asociar cada imagen al paso que explica.
- Registrar versión y condición de prueba. Distinguir imágenes simuladas de mediciones reales; no editar números para sugerir resultados físicos inexistentes.
- Confirmar que C26 y C28 sean adecuados para el tono formal del manual y que el canal de contacto mostrado esté autorizado. No enviar correos nuevos solo para producir evidencia sin una prueba autorizada por separado.

## 8. Problemas frecuentes y orientación al usuario

| Situación observable | Explicación compatible con implementación | Acción propuesta para el manual |
|---|---|---|
| Correo o contraseña inválidos | Credenciales no aceptadas; no confirma existencia de cuenta | Revisar escritura, volver a introducir contraseña; usar recuperación si está habilitada. |
| Usuario inactivo | Cuenta deshabilitada | Contactar al administrador; recuperación no reactiva la cuenta. |
| Demasiados intentos | Límite temporal o capacidad de procesamiento | Esperar el plazo indicado; evitar solicitudes repetidas. Login informa quince minutos. |
| No se pudo verificar/iniciar sesión | Backend o datos de cuentas inaccesibles, entre otras causas | Revisar conexión y usar Reintentar; escalar si persiste. No prometer que cambiar contraseña corrige una caída del servicio. |
| Sesión terminó | Caducidad, reinicio del servidor, revocación, cuenta no elegible | Iniciar sesión nuevamente; consultar al administrador si se repite. |
| No se pudo cerrar la sesión | Falló comunicación con el servidor | Volver a intentar; no asumir cierre porque se cerró la pestaña. En equipo compartido solicitar asistencia si persiste. |
| No aparece Usuarios | Rol de consulta o cambio de permisos | Verificar rol mostrado; pedir gestión al administrador autorizado. |
| No se pueden cargar mediciones | Red, backend, base o respuesta inválida | Verificar conexión y Actualizar ahora. El usuario no debe ejecutar SQL ni alterar configuración. |
| No hay mediciones | Ausencia de filas para nodo/intervalo | Revisar fechas y límite; si afecta la última lectura, solicitar revisión del nodo y servicios. |
| Semáforo gris con números visibles | Lectura antigua, orientación ausente/inválida o persistencia no confirmada | Revisar mensaje y última recepción; actualizar. No interpretar los valores conservados como actuales. |
| Modo de cinco minutos provoca gris | La pantalla conserva una lectura que supera sesenta segundos | Usar Actualizar ahora o intervalo corto cuando se necesite observar vigencia; no deducir desconexión física. |
| Última consulta cambia pero recepción no | Se consultó con éxito la misma última fila | Solicitar revisión de transmisión si no llegan nuevos datos; consulta no es adquisición. |
| Hora de recepción por verificar | Timestamp futuro respecto del reloj del navegador | Comprobar reloj/zona del equipo y pedir revisión de hora del servidor. |
| Fechas distintas entre diario y detalle | Diario usa Guatemala; otras vistas usan zona del navegador | Verificar zona del equipo y explicar diferencia; usar recepción de referencia consistente. |
| RAW 0 o 4095 | Valor admitido del ADC, sin diagnóstico causal | No convertirlo automáticamente en seco, saturado o sensor dañado; pedir revisión/calibración al responsable. |
| Vibración detectada sin movimiento actual | Booleano puede conservar un evento hasta confirmación de envío | Revisar fecha y contexto; no tratarlo como intensidad o movimiento continuo. |
| Sin orientación pero MPU disponible | La fila puede carecer de orientación en caché, entre otras causas | Actualizar después de un nuevo envío; pedir revisión si persiste. No declarar MPU averiado por este único mensaje. |
| Calibrando referencia | Firmware aún forma baseline | Mantener montaje inmóvil según protocolo confirmado; no modificar criterios desde el navegador. |
| Solo aparecen cien resultados | Límite por listado, sin paginación | Consultar intervalos más cortos. No afirmar que faltan datos almacenados por ese límite. |
| Correo ya registrado | Unicidad del correo, incluso para cuenta eliminada | Solicitar revisión al administrador; no prometer que crear otra cuenta restaura la anterior. |
| No permite desactivar/cambiar último administrador | Protección de continuidad administrativa | Conservar al menos un administrador activo; no ofrecer saltarse la validación. |
| No aparece Eliminar en una cuenta administradora | Restricción intencional y respaldada por API | Explicar la restricción; no es un error de interfaz. |
| No llegó recuperación aunque se confirmó solicitud | Mensaje genérico; cuenta no elegible, límites silenciosos, SMTP/configuración o cola | Revisar bandejas y cuenta usada, esperar; pedir al responsable verificar servicio. No concluir que la cuenta existe. |
| Enlace inválido después de recargar | Token retirado de URL y perdido de memoria | Reabrir enlace original aún vigente y no usado o solicitar uno nuevo. |
| Enlace vencido o usado | Vigencia de quince minutos, consumo único o reemplazo por emisión nueva | Solicitar otro enlace; usar el más reciente y no compartirlo. |
| Contraseñas no coinciden | Comparación exacta | Volver a escribir ambas; los espacios no se recortan automáticamente. |
| Aviso de comunicación persiste después del retorno | Conservación temporal desde activación | Leer «Comunicación restablecida» y fecha; no tratarlo como nueva desconexión. |
| No llegó aviso automático de inclinación | Activación/configuración, elegibilidad, condición no confirmada, evento ya activo o fallo de entrega | Consultar datos y responsable técnico. No probarlo forzando un evento real ni esperar reintento automático. |

La guía de problemas no debe agregar capacidades de reparación remota inexistentes ni indicar al usuario que cambie base de datos, firmware, pines, claves o umbrales.

## 9. Funcionalidades pendientes, ausentes y límites relevantes

| Capacidad | Estado observado | Consecuencia documental |
|---|---|---|
| Evaluación combinada de riesgo global | Pendiente, explícitamente «no evaluado» | No describir predicción, probabilidad de deslizamiento o nivel global validado. |
| Calibración definitiva de humedad y porcentaje | No implementada en la presentación | Usar únicamente RAW ADC, sin bandas seco/húmedo inventadas. |
| Validación metrológica de orientación | Parcial | No certificar precisión, estabilidad prolongada, repetibilidad o adecuación de 0,5°/1°/2°. |
| Historial persistente de orientación y semáforo | No implementado | No prometer consultas retrospectivas de deltas, baseline o niveles. |
| Historial web de alertas y entregas por destinatario | No implementado | El control SQL del último evento no es una bandeja de alertas para usuario. |
| Entrega automática real de correo por evento físico | Pendiente de observar | Diferenciar integración, simulación y pruebas manuales del canal. |
| Recuperación completa contra el entorno final | No verificada aquí | Confirmar habilitación, URL, entrega, consumo y acceso con nueva contraseña antes de publicación. |
| Registro público, perfil editable o cambio de clave dentro de sesión | No encontrados como pantallas | No inventar «Mi perfil», registro libre o cambio directo de contraseña. |
| Edición de correo/contraseña desde Usuarios | No disponible | Describir solo nombre, rol y estado. |
| Restaurar cuenta eliminada o borrado físico | No disponible en web | No incluir esos procedimientos. |
| Gestión de múltiples nodos en interfaz | No disponible; vista fija LADERA-1 | El catálogo API no implica selector, altas o edición de nodos para usuario. |
| Exportaciones, reportes descargables, impresión propia y paginación | No encontradas | No incluir botones CSV/PDF/Excel ni «siguiente página». |
| Configuración web de criterios, baseline o sensores | No disponible | Reservar cualquier operación física/técnica a protocolo separado. |
| SMS, mensajería instantánea, sirena o mapa web | No encontrados en las pantallas/servicios inspeccionados | No atribuir canales o geolocalización inexistentes. |
| Batería, RSSI, diagnóstico eléctrico y almacenamiento offline completo | No presentados o no implementados en este flujo | Explicar disponibilidad desde recepción, no salud integral ni recuperación de muestras perdidas. |
| Despliegue productivo, compatibilidad y soporte permanente | No comprobados | Confirmar dirección, HTTPS, navegadores, disponibilidad y responsable antes del manual oficial. |

Estas ausencias no son solicitudes de desarrollo. El manual debe reflejar el alcance que el proyecto apruebe, sin convertir posibilidades futuras en requisitos.

## 10. Pruebas, funcionamiento comprobado y límites de verificación

### 10.1 Verificaciones realizadas en este análisis

| Verificación | Resultado | Qué demuestra y qué no |
|---|---|---|
| `npm test` en frontend | **56 pruebas aprobadas, 0 fallidas, 0 omitidas** | Representación estática de componentes, funciones, navegación de recuperación, validación y cliente/polling con dependencias simuladas. No equivale a prueba de navegador completo ni del nodo real. |
| TypeScript backend con `tsc --noEmit` | Código de salida 0 | Compatibilidad de tipos del backend inspeccionado; no genera `dist` ni prueba consultas reales. |
| TypeScript frontend con `tsc --noEmit` | Código de salida 0 | Compatibilidad de tipos del frontend; no acredita empaquetado productivo ni diseño visual final. |
| Pruebas backend mediante carga directa temporal en memoria con tsx y redirección `dist` → `src`, sin escribir archivos | **Ejecución alternativa no concluyente; no sustituye la suite estándar** | Se excluyó `password-recovery-postgres.test.cjs`. En el intento por archivo terminaron con salida 0 `check-smtp`, `inclination-alert`, `mail` y `password-recovery`; los otros ocho archivos devolvieron salida 1. No se publican conteos de aprobación global backend a partir de este mecanismo. |

La ejecución alternativa se intentó para no emitir artefactos de compilación. Al revisar el archivo `daily-readings` se observaron conexiones HTTP locales bloqueadas con `EACCES` y «Falta configuración de PostgreSQL» porque la sustitución de `getPool` que usan pruebas CommonJS no se reproduce correctamente al cargar directamente fuentes TypeScript con ese adaptador. Son límites del entorno/método de esta ejecución; no permiten afirmar que las funcionalidades estén defectuosas ni que hayan aprobado la suite estándar. No se cargó configuración privada para compensarlo ni se alteró el código de pruebas.

**No se ejecutó `npm test` del backend:** su script primero escribe `dist` y después incluye una suite que crea un clúster PostgreSQL temporal y aplica migraciones. Se evitó por la instrucción de crear exclusivamente este documento y no modificar base de datos ni otros archivos. No se ejecutaron builds, instalación de dependencias, SMTP real o pruebas físicas. La suite backend estándar y la integración PostgreSQL quedan pendientes de una ejecución separada bajo alcance apropiado.

### 10.2 Cobertura temática de las pruebas inspeccionadas

| Área | Archivos de pruebas principales | Alcance identificado |
|---|---|---|
| Autenticación, roles, cookie y límites | `backend/tests/auth.test.cjs`; `frontend/tests/auth.test.tsx` | Rutas protegidas, acceso de los tres roles, mutaciones, representación de login y cliente. |
| Usuarios y eliminación lógica | `backend/tests/users-store.test.cjs`; pruebas `auth` | SQL simulado, continuidad administrativa, exclusión de eliminados, protección de cuentas y acciones del cliente. |
| Lecturas, nodo y filtros | `backend/tests/{readings,nodes,daily-readings}.test.cjs`; `frontend/tests/{telemetry,single-node,daily-readings}.test.tsx` | Validación de datos y filtros, SQL parametrizado, resumen diario, representación y alcance a LADERA-1. |
| Orientación, recepción y semáforo | `backend/tests/orientation.test.cjs`; `frontend/tests/{orientation,reception,risk-panel,node-tilt-reference}.test.tsx` | Caché por fila/nodo, ausencia de grados en historial, estado experimental, antigüedad y esquema. |
| Aviso visual | `frontend/tests/node-notice.test.tsx` | Armado, consulta confirmatoria, recuperación, duración y almacenamiento de estado. |
| Recuperación | `backend/tests/{password-recovery,recovery-api,reset-password,password-recovery-postgres}.test.cjs`; `frontend/tests/recovery.test.tsx` | Formato/uso de tokens, política de claves, límites, transacciones, simulación API/correo y suite PostgreSQL aislada no ejecutada aquí. |
| Correo y notificación de inclinación | `backend/tests/{mail,check-smtp,inclination-alert}.test.cjs` | Configuración, sanitización, transporte simulado, destinatarios, disparo y control lógico de repetidos. No demuestra entrega física automática. |

La existencia de pruebas no garantiza cobertura de cada interacción DOM. En particular, confirmación nativa de eliminación, formulario completo de alta/edición, foco, adaptación móvil y recorridos con servicios reales necesitan revisión humana. No se produjo una medición de cobertura de líneas ni de ramas.

### 10.3 Evidencia histórica y discrepancias temporales

| Documento | Evidencia útil | Límite o actualización necesaria |
|---|---|---|
| `firmware/landsis_ladera1/VALIDACION_FISICA_2026-11-03.md` | Registro de calibración de arranque, NORMAL, PRECAUCIÓN y ALERTA; recuperación de red y HTTP 201; filas con siete campos MPU | Confirmación en ventanas concretas. Sus pendientes iniciales deben leerse junto con la segunda sesión; no certifica operación continua actual. |
| `firmware/landsis_ladera1/CALIBRACION_GRADOS_2026-11-03.md` | CRÍTICO 6/6/6 ante inclinación grande, observaciones de retorno y baseline final operativo | Validación parcial; ruido, precisión, tabla de ángulos externos y repetibilidad no certificados. La nueva referencia final no prueba retorno al baseline anterior. |
| `docs/prueba-correo-controlada-2026-11-03.md` | Envíos manuales autorizados, recepción y presentación confirmadas, incluida segunda cuenta | Verifica canal y formato de prueba, no recuperación completa ni disparo automático real. |
| `docs/avisos-inclinacion-2026-11-03.md` | Integración automática posterior, activación local documentada, procesamiento sin disparar y reporte histórico 252/252 backend | No fue repetido bajo el método estándar aquí. Entrega automática por evento físico pendiente; configuración efectiva actual no inspeccionada. |
| `docs/recuperacion-cuentas-incremento-4.md` | Pruebas previas de frontend y navegador con API simulada; requisitos de rutas públicas | No demuestra envío real ni cambio contra el despliegue final. |
| `docs/auditoria-tecnica-final-2026-11-02.md` | Contexto anterior de seguridad y separación de componentes | Sus afirmaciones de ausencia de orientación, polling y disparador automático quedaron superadas por el código y notas posteriores. No copiarlas al manual como estado actual. |

Conclusión de verificación: hay suficiente código y pruebas para preparar procedimientos precisos, pero **no para declarar validado integralmente el sistema final ni el valor científico del semáforo**.

## 11. Recomendaciones de redacción y seguridad

1. Usar frases formales, concretas y numeradas por acción: «Seleccione Historial», «Indique el intervalo», «Pulse Consultar historial». Mantener los nombres reales de botones y mensajes.
2. Separar rol de consulta y rol administrador; no presentar tareas administrativas a todos por igual.
3. Explicar RAW, unidades, recepción y referencia antes de interpretar una pantalla. Definir términos como baseline en glosario como «referencia de arranque» sin renombrar silenciosamente la etiqueta visible.
4. Describir resultados observables y cómo actuar ante cada error. No explicar código fuente, consultas SQL, endpoints o variables de entorno en los procedimientos del usuario final.
5. Usar «última medición recibida» en lugar de prometer «tiempo real» continuo. No confundir consulta de pantalla con transmisión del dispositivo.
6. Nombrar el semáforo siempre como experimental de inclinación y aclarar «riesgo global no evaluado». No asociar NORMAL con autorización de ingreso a una ladera ni CRÍTICO con confirmación de deslizamiento.
7. Evitar porcentaje de humedad, exactitud angular, predicción, autonomía o tiempos de entrega garantizados sin validación explícita.
8. Indicar que disponibilidad de telemetría no acredita salud eléctrica del sensor. Para ausencia de datos, recomendar comprobación por el responsable, no diagnóstico causal categórico.
9. Recomendar contraseña única, no compartir cuentas, cerrar sesión en equipos compartidos y proteger el correo de recuperación. No solicitar contraseñas o tokens al equipo de soporte.
10. Abrir el sistema mediante dirección oficial confirmada y conexión segura; tratar enlaces de recuperación como secretos temporales y usar únicamente los solicitados por el propio usuario.
11. No insertar datos personales del autor, destinatarios o usuarios reales en ejemplos. Aunque aparezcan en la aplicación, la publicación de contactos debe aprobarse para el documento oficial.
12. Mantener evidencia técnica y limitaciones en anexos de análisis o informe de pruebas. El manual debe enseñar a usar la versión aceptada, sin presentar futuras mejoras como funciones disponibles.

## 12. Confirmaciones humanas antes del manual oficial

| Prioridad | Aspecto por confirmar | Motivo y efecto sobre el manual |
|---|---|---|
| Alta | Versión exacta del software y firmware que se publicará | El árbol tiene cambios previos no consolidados; fijar versión y repetir aceptación sobre ella. |
| Alta | Dirección de acceso, HTTPS, proxy y rutas públicas de recuperación | No se verificó despliegue final. No publicar localhost o direcciones de pruebas como URL oficial. |
| Alta | Recuperación habilitada y prueba completa con cuenta propia de ensayo | El mensaje genérico no demuestra envío; validar recepción, cambio, acceso nuevo e invalidez de sesión/token anteriores. |
| Alta | Activación actual y autorización de destinatarios de correos automáticos | Código envía a todos los usuarios activos elegibles, sin suscripción por rol; confirmar política operativa y consentimiento aplicable al proyecto. |
| Alta | Protocolo de actuación ante inclinación o falta de comunicación | No hay respuesta institucional o de emergencia definida en el código. El rol CONRED no prueba integración oficial con esa entidad. |
| Alta | Interpretación aprobada de los niveles experimentales | No existen umbrales geotécnicos definitivos ni riesgo global implementado. Decidir qué detalle experimental corresponde al usuario final. |
| Alta | Montaje y referencia del MPU6050 en instalación definitiva | Hay evidencia histórica real, pero no certificación actual del montaje ni precisión angular. Confirmar orientación física de ejes y protocolo de arranque inmóvil. |
| Alta | Estado final de calibración de humedad | No convertir RAW a porcentaje ni clasificar suelo hasta disponer de calibración documentada y aceptada. |
| Media | Aceptación del texto e imagen del aviso especial | El mensaje coloquial y contacto personal visibles pueden requerir decisión editorial para el manual académico; esta tarea no los cambia. |
| Media | Navegadores, tamaños de pantalla y dispositivos soportados | No se encontró matriz de compatibilidad validada. Revisar menús, tablas y diálogos en los equipos objetivo. |
| Media | Canal de soporte, responsable y horario | No inventar disponibilidad permanente ni reutilizar direcciones personales sin aprobación. |
| Media | Política de altas, desactivación y eliminación | Precisar quién autoriza cuentas, cómo se comunica contraseña inicial y cómo se gestiona un correo ya usado por eliminado. No existe restauración web. |
| Media | Necesidad de evidencia de entrega automática física | Probar por separado con autorización y destinatarios controlados; no provocar incidentes reales para documentar. |
| Media | Zona horaria de los equipos de consulta | Unificar o explicar diferencias entre hora local del navegador y resumen diario Guatemala. |
| Media | Periodo de conservación y copias de seguridad | No hay función de usuario de respaldo/restauración ni política operativa comprobada en este análisis. |
| Media | Aceptación de funciones no disponibles | Confirmar que exportaciones, múltiples nodos, perfil y riesgo global queden expresamente fuera del alcance de la versión descrita. |

## 13. Referencias del código inspeccionado

Las fichas vinculan cada conclusión con archivos concretos; las siguientes rutas se agrupan como índice de trazabilidad. Las notaciones agrupadas en secciones anteriores representan los archivos individuales aquí enumerados o sus pruebas, no carpetas nuevas.

### 13.1 Frontend

- `frontend/package.json`, `frontend/vite.config.ts`, `frontend/index.html`: comandos, proxy y política de referencia.
- `frontend/src/main.tsx`, `frontend/src/AuthApp.tsx`: entrada, rutas públicas, restauración, sesión y selección de vistas.
- `frontend/src/App.tsx`: nodo fijo, consultas, filtros e intervalos.
- `frontend/src/presentation.ts`, `frontend/src/reception.ts`, `frontend/src/recovery.ts`, `frontend/src/nodeNotice.ts`: etiquetas, fechas, vigencia, enlaces y aviso local.
- `frontend/src/api/http.ts`, `frontend/src/api/telemetry.ts`, `frontend/src/api/pollLatest.ts`: solicitudes, validación y actualización.
- `frontend/src/components/LoginForm.tsx`, `RecoveryViews.tsx`, `UserNavigation.tsx`, `UsersPanel.tsx`: acceso, recuperación y administración (todos bajo la misma carpeta `components`).
- `frontend/src/components/TelemetryViews.tsx`, `DailyReadings.tsx`, `MoistureChart.tsx`, `MpuPanel.tsx`, `OrientationPanel.tsx`, `NodeTiltReference.tsx`, `RiskPanel.tsx`, `NodeNotice.tsx`: vistas y componentes de monitoreo, en esa carpeta.
- `frontend/src/types/telemetry.ts`, `orientation.ts`, `user.ts`: contratos de presentación.
- `frontend/src/styles.css`: distribución y estilos; su inspección no sustituye revisión visual.
- Pruebas frontend referidas en la sección 10: diez archivos `.test.tsx`, ejecutados sin cambios.

### 13.2 Backend y datos

- `backend/package.json`, `backend/src/app.ts`, `backend/src/server.ts`: composición, protección de rutas y activación de servicios.
- `backend/src/auth/security.ts`, `sessions.ts`, `password.ts`, `user.ts`, `password-recovery.ts`, `recovery-limits.ts`: autenticación, roles, claves y recuperación, en la carpeta `auth`.
- `backend/src/routes/readings.ts`, `nodes.ts`, `password-recovery.ts`: servicios HTTP, en `routes`.
- `backend/src/controllers/readings.ts`, `backend/src/readings/reading.ts`, `orientation.ts`, `query.ts`: recepción, validación y consultas.
- `backend/src/data/readings.ts`, `nodes.ts`, `users.ts`, `password-resets.ts`, `postgres.ts`: persistencia y conexión, en `data`.
- `backend/src/config/recovery.ts`, `backend/src/config/alerts.ts`: activación opcional; `backend/src/mail/service.ts`, `backend/src/mail/inclination-template.ts`: transporte y contenido de aviso.
- `backend/src/alerts/notifier.ts`, `store.ts`, `types.ts`: disparo, destinatarios, cola y estado persistente del último evento.
- `database/001_create_sensor_readings.sql`, `002_add_mpu6050_fields_to_sensor_readings.sql`, `003_create_nodes_and_link_readings.sql`, `004_create_users_and_roles.sql`, `005_create_password_resets.sql`, `006_soft_delete_users.sql`, `007_inclination_email_state.sql`: esquema previsto por los scripts; no se aplicaron ni verificaron contra base real aquí.
- Pruebas backend enumeradas en la sección 10 y `backend/tests/authenticated-app.cjs`, que inyecta autenticación para ensayos de telemetría; no confundir esa ayuda con el comportamiento de producción.

### 13.3 Firmware y documentos de evidencia

- `firmware/landsis_ladera1/landsis_ladera1.ino`, `firmware/landsis_ladera1/telemetria.h`, `firmware/landsis_ladera1/orientacion.h`: procedencia y cálculo de datos enviados. No se modificaron pines, parámetros ni calibraciones.
- Documentos históricos concretos de la sección 10.3; se usaron como evidencia fechada, subordinada al código actual para describir funciones.

**Criterio para continuar:** redactar el manual final después de fijar la versión, resolver las confirmaciones prioritarias y comprobar los recorridos reales autorizados. Se puede avanzar en edición y capturas controladas de funciones existentes, conservando explícitos los límites de orientación experimental, correo y riesgo global.
