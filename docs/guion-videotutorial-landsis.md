# LANDSIS: LADERA-1 — Guion de videotutorial de usuario

**Público:** geólogos, investigadores, personal de CONRED y evaluadores de la Universidad Mariano Gálvez de Guatemala.  
**Duración prevista:** 9 min 20 s, incluidas las pausas para recorrer y leer la interfaz.  
**Cuenta para la toma principal:** INVESTIGADOR activa y preexistente, con identidad autorizada para publicación. CONRED dispone del mismo recorrido de consulta.

## 1. Alcance y criterios de verificación

Se contrastaron el frontend React, la API Express sobre Node.js y TypeScript, las consultas PostgreSQL y la documentación técnica. El documento disponible en el repositorio es un [análisis para elaborar el manual de usuario](analisis-manual-usuario.md). Se utilizó como guía preliminar y se cotejó con el código actual. Dos diferencias relevantes son la presentación de humedad y la autenticación de la ingesta del nodo. El código actual conserva el RAW ADC y muestra también una escala relativa. La API aplica autenticación de dispositivo a la ingesta, una operación fuera de la interfaz de usuario. [Humedad en el frontend](../frontend/src/moisture.ts), [montaje de rutas](../backend/src/app.ts).

El 10 de noviembre de 2026 se ejecutaron las pruebas del frontend, con 58 aprobadas y cero fallos. La revisión del backend se apoya en código, pruebas existentes y resultados archivados. El 9 de noviembre constan 48 casos backend aprobados sin red, con dobles donde correspondía. El expediente también recoge regresiones previas de integración y ensayos físicos acotados. Durante esta preparación se trabajó con el repositorio local. El acceso al sitio desplegado, la recepción actual y la entrega automática de correos quedan pendientes de confirmación para cualquier afirmación sobre el despliegue. [Evidencia de pruebas de tesis](evidencia-pruebas-tesis-2026-11-09.md), [aceptación física pendiente](verificacion-final-firmware-produccion.md).

| Clasificación | Cómo se aplica |
| --- | --- |
| **OPERATIVA** | Flujo implementado con respaldo en pruebas o verificación histórica para el alcance indicado. La ejecución en el sitio a grabar se confirma en el ensayo. |
| **PARCIALMENTE OPERATIVA** | Hay un flujo implementado y comprobaciones parciales. Completarlo depende de una condición externa o de datos cuya disponibilidad tiene límites. |
| **EXPERIMENTAL** | El prototipo implementa el comportamiento y hay evidencia técnica, con alcance experimental en la interpretación física o del aviso. |
| **NO VERIFICADA** | Falta evidencia suficiente para afirmar que funciona en el escenario indicado. También se señala expresamente cuando se buscó una capacidad y la interfaz revisada carece de ella. |

## 2. Inventario de funciones y permisos

**Todos** significa ADMINISTRADOR, INVESTIGADOR y CONRED con cuenta activa y sesión válida. **Público** indica acceso al formulario sin iniciar sesión. El backend exige sesión en las lecturas y exige además ADMINISTRADOR para cada operación de usuarios. INVESTIGADOR y CONRED comparten los permisos de consulta. [Navegación React](../frontend/src/components/UserNavigation.tsx), [rutas y control de acceso](../backend/src/app.ts), [seguridad y usuarios](../backend/src/auth/security.ts).

| Función y pantalla | Acceso | Estado | Evidencia y alcance |
| --- | --- | --- | --- |
| Iniciar sesión, restaurar sesión y reintentar su comprobación desde el acceso | Público para el formulario. Todos para acceder | **OPERATIVA** | El formulario llama a login y la aplicación comprueba la sesión al abrir. Los casos de acceso, credenciales y sesiones están en las pruebas de [frontend](../frontend/tests/auth.test.tsx) y [backend](../backend/tests/auth.test.cjs). |
| Menú lateral, identificación de nombre y rol, cambio de vista y cierre de sesión | Todos, con Usuarios reservado a ADMINISTRADOR | **OPERATIVA** | Se puede expandir y contraer el menú, seleccionar la vista y cerrar sesión. La interfaz vuelve al acceso tras el cierre o al detectar una sesión vencida. [Interfaz](../frontend/src/AuthApp.tsx), [pruebas de navegación y telemetría](../frontend/tests/telemetry.test.tsx), [pruebas de autenticación](../backend/tests/auth.test.cjs). |
| Solicitar enlace y regresar al acceso | Público | **PARCIALMENTE OPERATIVA** | El formulario y la respuesta genérica están implementados. La respuesta visible por sí sola no prueba que se envió un correo. La entrega depende de la configuración y de que la cuenta sea elegible. [Vistas](../frontend/src/components/RecoveryViews.tsx), [pruebas de recuperación](../backend/tests/recovery-api.test.cjs). |
| Establecer nueva contraseña y volver a iniciar sesión | Público con enlace válido para completar | **PARCIALMENTE OPERATIVA** | Hay manejo de enlace inválido o usado, confirmación y cambio de contraseña. Pruebas cubren consumo del token y persistencia. El recorrido desde el buzón hasta el nuevo acceso en el entorno de grabación queda pendiente. [Pruebas React](../frontend/tests/recovery.test.tsx), [pruebas PostgreSQL](../backend/tests/password-recovery-postgres.test.cjs). |
| Dashboard con última medición de LADERA-1 | Todos | **OPERATIVA** | Muestra RAW ADC, indicador digital de vibración, última recepción y temperatura interna del MPU6050 cuando hay datos. Presenta estados vacíos y errores. El código también muestra humedad relativa derivada. [Vista](../frontend/src/components/TelemetryViews.tsx), [pruebas](../frontend/tests/telemetry.test.tsx). |
| Escala relativa de humedad en tarjetas, tablas y gráfica | Todos | **EXPERIMENTAL** | El porcentaje que acompaña al RAW se calcula por inversión lineal de la escala ADC, con referencias experimentales de aire seco y agua. Carece de calibración como contenido de agua en suelo. [Conversión](../frontend/src/moisture.ts), [pruebas](../frontend/tests/moisture.test.tsx). |
| Actualización de pantalla y consulta manual | Todos | **OPERATIVA** | Dashboard y Estado del nodo ofrecen 10 segundos (pruebas), 5, 10, 15 o 30 minutos, 1 hora y Solo manual. «Actualizar ahora» consulta el servidor. En Historial repite los filtros aplicados. «Última consulta» y «Última recepción» corresponden a instantes distintos. Si falla una actualización automática tras cargar datos, se conserva la recepción previa con un aviso. [Flujo React](../frontend/src/App.tsx), [pruebas](../frontend/tests/reception.test.tsx). |
| Historial por rango y límite, tabla y gráfica | Todos | **OPERATIVA** | «Consultar historial» aplica límite entero de 1 a 100 y fechas opcionales en hora local del navegador. Desde se incluye y Hasta se excluye. La tabla va de la más reciente a la más antigua y la gráfica ordena las lecturas devueltas cronológicamente. En el código actual, la gráfica «Humedad del suelo — %» usa el valor relativo. [Vista](../frontend/src/components/TelemetryViews.tsx), [gráfica](../frontend/src/components/MoistureChart.tsx), [consultas y pruebas](../backend/tests/readings.test.cjs). |
| Mediciones diarias dentro de Historial | Todos | **OPERATIVA** | Devuelve la última lectura real de cada día con datos dentro del intervalo, agrupada en horario de Guatemala. Omite días sin filas. El límite cuenta días en este listado y filas en el historial detallado. [Consulta](../backend/src/data/readings.ts), [pruebas backend](../backend/tests/daily-readings.test.cjs), [pruebas frontend](../frontend/tests/daily-readings.test.tsx). |
| Detalle «Ver MPU» de una fila | Todos | **OPERATIVA** | Presenta aceleración X/Y/Z en m/s², giroscopio X/Y/Z en rad/s y temperatura del módulo en °C. Indica ausencia cuando faltan datos. Existe evidencia física histórica del módulo y se debe elegir una fila con datos completos para la toma. [Panel](../frontend/src/components/MpuPanel.tsx), [pruebas](../frontend/tests/telemetry.test.tsx), [validación física](../firmware/landsis_ladera1/VALIDACION_FISICA_2026-11-03.md). |
| Inclinación relativa, deltas, referencia de arranque y esquema visual | Todos | **EXPERIMENTAL** | El dashboard muestra roll, pitch y deltas calculados en el firmware cuando llegan datos válidos. Los ángulos se asocian en memoria a la última lectura y quedan fuera del historial persistido. La validación angular física fue parcial. [Panel](../frontend/src/components/OrientationPanel.tsx), [pruebas visuales](../frontend/tests/node-tilt-reference.test.tsx), [caché y validación](../backend/tests/orientation.test.cjs), [ensayo angular](../firmware/landsis_ladera1/CALIBRACION_GRADOS_2026-11-03.md). |
| Semáforo experimental de inclinación | Todos | **EXPERIMENTAL** | Muestra NORMAL, PRECAUCIÓN, ALERTA y CRÍTICO según orientación, vigencia y persistencia. Al llegar a 60 s de antigüedad de la lectura mostrada, queda gris y sin nivel activo. El texto «Riesgo global: no evaluado» permanece visible. Humedad y vibración son datos de contexto. [Panel](../frontend/src/components/RiskPanel.tsx), [pruebas](../frontend/tests/risk-panel.test.tsx). |
| Aviso visual especial y «Comunicación restablecida» | Todos, en Dashboard si se cumplen las condiciones | **EXPERIMENTAL** | Tras ALERTA o CRÍTICO confirmados, requiere una consulta exitosa posterior al límite de 60 s que confirme que sigue sin haber lectura nueva. Al observar una nueva recepción reciente, puede mostrar el restablecimiento. Evidencia con lecturas y tiempos simulados. [Lógica](../frontend/src/nodeNotice.ts), [pruebas](../frontend/tests/node-notice.test.tsx). |
| Estado del nodo | Todos | **OPERATIVA** | Resume hora y vigencia de recepción y disponibilidad de humedad, vibración, MPU y orientación a partir de la última medición. Sirve como comprobación técnica en pantalla. [Vista](../frontend/src/components/TelemetryViews.tsx), [pruebas](../frontend/tests/single-node.test.tsx). |
| Usuarios, listado y reintento | ADMINISTRADOR | **OPERATIVA** | Lista nombres, correos, roles y estado, con reintento ante error. [Panel](../frontend/src/components/UsersPanel.tsx), [pruebas de acceso](../backend/tests/auth.test.cjs). |
| «+ Nuevo usuario» y «Guardar usuario» | ADMINISTRADOR | **OPERATIVA** | Alta con nombre, correo, rol, estado y contraseña inicial confirmada. La API valida datos y trata correos duplicados. [Formulario](../frontend/src/components/UsersPanel.tsx), [pruebas](../backend/tests/auth.test.cjs). |
| «Editar» y «Guardar usuario» | ADMINISTRADOR | **OPERATIVA** | Permite cambiar nombre, rol y estado. El correo queda bloqueado en edición. La API protege la existencia de al menos un administrador activo. [Panel](../frontend/src/components/UsersPanel.tsx), [pruebas de persistencia](../backend/tests/users-store.test.cjs). |
| «Eliminar», confirmación y «Cancelar» | ADMINISTRADOR | **OPERATIVA** | Baja lógica, conserva el historial y retira el acceso. La API impide borrar cuentas administradoras y la propia cuenta. [Flujo y límites](eliminacion-logica-usuarios.md), [pruebas](../backend/tests/auth.test.cjs). |
| Entrega automática de correo ante evento físico crítico | Servicio opcional del backend, sin control web | **NO VERIFICADA** | Existe lógica para un CRÍTICO confirmado en una lectura recién guardada y pruebas con transporte simulado. Dos correos manuales de prueba llegaron a cuentas autorizadas. La entrega automática en producción ante un evento real sigue pendiente. [Pruebas del avisador](../backend/tests/inclination-alert.test.cjs), [correos manuales](prueba-correo-controlada-2026-11-03.md), [alcance del aviso automático](avisos-inclinacion-2026-11-03.md). |
| Evaluación de riesgo global y alerta certificada de deslave | Sin flujo disponible | **NO VERIFICADA** | La interfaz declara «Riesgo global: no evaluado». Los niveles del semáforo pertenecen al prototipo de inclinación. [Panel](../frontend/src/components/RiskPanel.tsx). |

Las vistas principales viven en la raíz y se abren desde el menú. Los recorridos públicos de recuperación usan /forgot-password y /reset-password. Se comprobó que el recorrido web carece de registro público, selector de nodos, exportación, historial de ángulos y controles de recalibración o de correo. La API tiene un catálogo de nodos separado de la navegación web. [Navegación](../frontend/src/AuthApp.tsx), [consultas de la interfaz](../frontend/src/api/telemetry.ts), [rutas de recuperación](../frontend/src/recovery.ts), [montaje de la API](../backend/src/app.ts).

## 3. Recorrido y guion narrado

**Orden de toma:** Acceso → Dashboard → Inclinación y semáforo → Historial → Mediciones diarias → Gráfica y tabla → Ver MPU → Estado del nodo → Dashboard → Cerrar sesión. Las horas exactas del intervalo y la fila MPU se eligen en el ensayo con registros existentes autorizados. Los tiempos incluyen pausas de lectura y desplazamiento.

### Escena 1 · Acceso y alcance · 0:00–0:55

**Pantalla y acciones.** Abrir la dirección oficial aprobada en el perfil limpio. Capturar el formulario vacío. Cortar la captura antes de rellenar «Correo» y «Contraseña». Fuera de cámara, pulsar «Iniciar sesión». Reanudar con Dashboard y la etiqueta INVESTIGADOR visibles. Mostrar solo un nombre de cuenta autorizado.

**Narración.** «LANDSIS: LADERA-1 es un prototipo académico para consultar mediciones recibidas de un nodo de monitoreo. En esta sesión revisaremos la última lectura, buscaremos mediciones guardadas y consultaremos la disponibilidad técnica del nodo. El recorrido se realiza con el rol Investigador. El personal con rol CONRED puede consultar estas mismas pantallas.»

### Escena 2 · Última medición y recepción · 0:55–2:15

**Pantalla y acciones.** En Dashboard, señalar «Actualización de pantalla». Conservar «10 segundos (pruebas)» si ya está seleccionado. Pulsar una vez «Actualizar ahora». Señalar «Última consulta» y bajar a «Última recepción». Volver a las tarjetas y señalar «RAW ADC» y el estado de «VIBRACIÓN».

**Narración.** «Actualizar ahora solicita al servidor la última medición disponible. Última consulta indica cuándo se hizo la consulta. Última recepción indica cuándo el sistema recibió la lectura que estamos viendo. Ambas horas pueden ser distintas aunque la consulta haya funcionado. El selector controla cada cuánto se consulta desde la pantalla. En humedad, tomaremos como referencia el RAW ADC que se conserva con la lectura. Si la pantalla también presenta un porcentaje, corresponde a una escala relativa del sensor, sin calibración para expresar el contenido de agua en el suelo. La vibración se presenta como un indicador digital de detección en la medición.»

### Escena 3 · Inclinación y semáforo · 2:15–4:05

**Pantalla y acciones.** Bajar a «Inclinación relativa». Señalar DELTA ROLL, DELTA PITCH, «Referencia visual del nodo» y los campos de referencia de arranque. Mostrar la nota de temperatura si hay lectura. Volver al semáforo. Recorrer los cuatro rótulos y señalar únicamente el estado que esté activo, si lo hay. Mantener «Riesgo global: no evaluado» visible durante el cierre de la escena.

**Narración.** «Los deltas de roll y pitch expresan, en grados, el cambio angular del nodo respecto a su referencia de arranque. La figura ayuda a identificar el eje y el sentido del cambio que reporta el montaje. Estos son ángulos del dispositivo. Para interpretarlos en un estudio geotécnico hace falta contexto de instalación y validación física. La temperatura que acompaña al panel es interna al módulo MPU6050. El semáforo presenta cuatro niveles experimentales de inclinación. Para mostrar un nivel activo necesita una recepción reciente y una orientación válida con la persistencia correspondiente. Si la lectura mostrada cumple un minuto de antigüedad, el indicador queda gris. Los rótulos ALERTA y CRÍTICO describen la inclinación del nodo bajo los criterios del prototipo. El riesgo global de deslizamiento figura como no evaluado.»

**Si faltan datos.** Mostrar el mensaje real, por ejemplo «Esperando orientación», «Calibrando referencia» o «Sin datos recientes». Decir «Esta toma no dispone de una orientación reciente y válida». Si ya hay una captura auténtica autorizada, insertar el fragmento rotulado «Grabación previa» con su fecha. Mantener el nodo en sus condiciones de operación.

### Escena 4 · Historial y mediciones diarias · 4:05–5:35

**Pantalla y acciones.** Pulsar «Expandir menú» si está contraído y elegir «Historial». Introducir 50 en «Límite por listado (1–100)» y el rango ensayado en «Desde (incluido, hora local)» y «Hasta (excluido, hora local)». Pulsar «Consultar historial». Esperar a que aparezcan los resultados y detenerse en «Mediciones diarias».

**Narración.** «Voy a recuperar registros que ya existen. Selecciono un intervalo que hemos revisado para esta demostración. Desde incluye ese instante y Hasta termina justo antes del valor indicado. En Mediciones diarias vemos una fila real por día con datos. Se toma la última que cae dentro del intervalo de consulta, con fecha y hora de Guatemala. Si el intervalo termina a mitad del día, la fila elegida puede corresponder a una hora anterior al cierre de ese día. Los días sin registros se omiten. El límite cuenta días aquí y lecturas individuales en el detalle.»

### Escena 5 · Gráfica y detalle MPU · 5:35–7:05

**Pantalla y acciones.** Desplazarse a la gráfica «Humedad del suelo — %» si la versión ensayada muestra ese rótulo. Bajar a «Historial de mediciones almacenadas». Localizar la fila ensayada por fecha y hora y señalar su valor RAW. Pulsar «Ver MPU», dejar el panel visible y volver a pulsarlo para cerrar.

**Narración.** «La gráfica ordena cronológicamente las lecturas devueltas por esta consulta. En esta versión el eje representa la escala relativa del sensor. En la tabla vemos primero las lecturas más recientes y conservamos el RAW original en cada fila. Voy a abrir el detalle de una medición que tiene datos del MPU6050. Aquí podemos consultar aceleración en metros por segundo al cuadrado, giroscopio en radianes por segundo y temperatura interna en grados Celsius. Estos datos corresponden a la fila seleccionada. Si el módulo no aportó un valor, el detalle señala su ausencia.»

### Escena 6 · Estado técnico y avisos · 7:05–8:25

**Pantalla y acciones.** Abrir «Estado del nodo». Pulsar «Actualizar ahora». Leer «Disponibilidad de datos del nodo», «Última recepción», «Estado de recepción» y la disponibilidad de MPU, humedad, vibración e inclinación. Si se incluye un plano adicional, usar el dashboard observado en condiciones normales o un rótulo de edición sobre la escena.

**Narración.** «Estado del nodo reúne indicadores técnicos derivados de la última medición. La hora y el estado de recepción nos ayudan a saber qué tan reciente es la información que tenemos en pantalla. La disponibilidad de un campo indica que hubo datos para consultarlo. El prototipo contempla un aviso visual experimental si, después de una inclinación ALERTA o CRÍTICO confirmada, una consulta posterior confirma que no hay una nueva recepción. Esta grabación sigue la operación normal del nodo. La entrega automática de correo ante un evento físico sigue pendiente de verificación y queda fuera de la demostración.»

### Escena 7 · Regreso y cierre · 8:25–9:20

**Pantalla y acciones.** Volver a «Dashboard». Dejar unos segundos el estado de recepción y «Riesgo global: no evaluado» en pantalla. Expandir el menú lateral, pulsar «Cerrar sesión» y esperar «Sesión cerrada.» y el formulario de acceso.

**Narración.** «Con los roles de consulta podemos revisar qué recibió el sistema, recuperar lecturas de un intervalo y comprobar la vigencia de la recepción. La opción Usuarios corresponde al Administrador, que gestiona las cuentas. Para terminar, cierro la sesión desde el menú lateral y confirmo el regreso a la pantalla de acceso.»

## 4. Demostración segura y contingencias

- **Toma principal.** Usar el sitio aprobado con una cuenta INVESTIGADOR o CONRED ya habilitada y lecturas reales existentes autorizadas para publicación. Realizar el inicio y el cierre de sesión normales y limitar el resto del recorrido a consultas. Mantener fuera de la toma el alta, edición y eliminación de cuentas, el restablecimiento de contraseña y las solicitudes de correo.
- **Datos del ensayo.** Elegir un intervalo que devuelva varios días con datos si están disponibles. Anotar por separado el límite, Desde, Hasta y la hora exacta de una fila con MPU. Confirmar que el rango y el límite incluyen esa fila y que el material puede difundirse.
- **Continuidad.** Si la red o el nodo no presentan datos recientes, usar una grabación auténtica autorizada y fechada para la sección en vivo, o mostrar el estado real y continuar con el historial si carga. Si la interfaz publicada difiere del repositorio, usar sus rótulos reales y ajustar la narración a lo observado. Si no hay una cuenta adecuada o material autorizado, posponer las escenas afectadas.
- **Conservación.** Mantener el nodo, sus sensores y su conectividad en operación normal. La toma excluye inyección de telemetría, provocación de inclinación o vibración, desconexión, calibración, cambio de configuración, acceso administrativo al VPS y tareas sobre PostgreSQL. Los cambios del selector de pantalla son preferencias de la vista.

## 5. Checklist previo a grabar

- [ ] Confirmar la dirección oficial, el entorno y el permiso para publicar la identidad visible, las fechas y las mediciones elegidas.
- [ ] Abrir un perfil limpio de navegador. Desactivar avisos de escritorio y ventanas emergentes del gestor de contraseñas. Cerrar correo, terminal, DevTools y pestañas ajenas.
- [ ] Ensayar el acceso fuera de cámara con una cuenta existente de INVESTIGADOR o CONRED. Comprobar el rol y la ausencia de «Usuarios» en ese menú.
- [ ] Confirmar fecha, hora y zona del equipo de grabación. Usar hora de Guatemala en el equipo para alinear filtros y tabla detallada con el resumen diario.
- [ ] Comprobar Dashboard y Estado del nodo con «Actualizar ahora». Distinguir consulta, recepción, datos antiguos y ausencia de datos.
- [ ] Verificar que se distingue RAW ADC y, si aparece, que el porcentaje se rotula como escala relativa del sensor en la narración. Confirmar el título exacto de la gráfica.
- [ ] Verificar que «Riesgo global: no evaluado» es legible y que la escena de inclinación tiene orientación reciente y válida, o preparar la toma alternativa.
- [ ] Ensayar el intervalo y fijar el límite. Confirmar «Mediciones diarias», la gráfica, la tabla y una fila con «Ver MPU» y datos.
- [ ] Ensayar «Cerrar sesión» y comprobar que se regresa al acceso. Confirmar encuadre, zoom, audio y pausas con una toma corta.
- [ ] Revisar la grabación final cuadro a cuadro en cortes y transiciones. Aplicar recorte o máscara también en miniaturas y planos de respaldo.

## 6. Información que debe quedar fuera del encuadre

- **Acceso y sesión.** Contraseñas, gestor de contraseñas, autocompletado, portapapeles, cookies, tokens de sesión, tokens del nodo, enlaces de recuperación completos y cabeceras de autenticación.
- **Personas y trabajo de campo.** Correos, nombres e identificadores de usuarios sin autorización, bandejas de correo y listas de destinatarios. Ocultar coordenadas o referencias precisas de instalación, metadatos y fechas o lecturas sensibles si están fuera del material autorizado.
- **Infraestructura.** Archivos de entorno y secretos del firmware, claves privadas, credenciales Wi-Fi, SSH, SMTP y PostgreSQL, cadenas de conexión, hosts o IP internas, paneles del VPS, respaldos, logs y consola de red. Encuadrar la aplicación y usar la dirección pública únicamente si está aprobada para difusión.
