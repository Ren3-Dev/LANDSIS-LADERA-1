# Informe — Dashboard beta V2

## A. Estado inicial Git

Se encontraron seis archivos rastreados modificados (27 inserciones / 6 eliminaciones):
README.md, backend/.env.example, backend/package.json, backend/src/app.ts,
backend/tests/nodes.test.cjs y backend/tests/readings.test.cjs.
También existían archivos no rastreados de autenticación, usuarios, reset-password,
migración 004, documentación y todo el frontend. Ningún cambio fue descartado.
El diff --stat no contabiliza archivos no rastreados.

## B–C. Arquitectura y navegación

React + TypeScript + Vite y CSS normal, sin dependencias nuevas.
AuthApp mantiene autenticación y vista activa; UserNavigation ofrece Dashboard,
Historial, Estado del nodo y Usuarios exclusivo admin. App coordina catálogo,
selector compartido y consultas por vista. TelemetryViews contiene tres componentes
presentacionales y presentation.ts centraliza etiquetas. No se añadió configuración.
Las tres vistas de telemetría conservan nodo y filtros al navegar. Usuarios desmonta
telemetría; al volver se vuelve a consultar el catálogo.

## D. Dashboard

Cuatro tarjetas: humedad RAW ADC, vibración, última comunicación y riesgo pendiente.
Etiqueta explícita «Lectura RAW — pendiente de calibración». MPU en details expandible.
No consulta historial al abrir el resumen.

## E. Historial

Selector compartido de nodo, límite 1–100 y fechas locales opcionales.
GET /api/v1/readings con nodeId, limit, from incluido y to excluido, convertidos a ISO UTC.
Gráfica SVG RAW y tabla: fecha/hora, humedad RAW, vibración, disponibilidad MPU y
 detalles expandibles. Orden del backend, más reciente primero; curva cronológica.
Sin paginación. Un historial vacío no significa que el nodo carezca de datos fuera del filtro.

## F. Estado del nodo

Última comunicación; Datos recibidos o Sin datos; MPU completo disponible o sin
telemetría; humedad disponible y lectura digital de vibración disponible.
No se define un intervalo de atraso. 0/4095 no generan diagnósticos de avería.
Diagnósticos avanzados no disponibles: salud de sensores, RSSI, batería, uptime,
errores de inicialización. Disponibilidad de datos y riesgo permanecen separados.

## G–H. Usuarios y roles

La gestión existente se conserva. ADMINISTRADOR ve Usuarios; INVESTIGADOR y CONRED
ven solamente las tres vistas de telemetría. Se mantienen usuario, rol y logout.
La protección del backend, cookies de sesión y eventos de expiración permanecen intactos.
No se modificó backend, firmware, esquema, mediciones, correo, Docker ni hosting.

## I–J. Presentación y datos originales

Solo etiquetas, fecha/hora local, true/false → Detectada/No detectada y null → Sin lectura.
La disponibilidad MPU se determina por los siete campos; el cliente rechaza bloques parciales.
No hay conversión científica: RAW ADC y aceleración/giroscopio/temperatura MPU originales.
La temperatura se identifica como MPU6050, sin afirmar que sea ambiental.

## K–M. Pruebas y compilación

Inicial: frontend 6 pruebas y backend 191 pruebas aprobadas. La primera ejecución
frontend dentro del sandbox falló por uv_os_get_passwd ENOMEM; reejecutada fuera del
sandbox pasó. Backend npm test incluye compilación TypeScript.
Final: 12/12 pruebas frontend aprobadas; build frontend/TypeScript aprobado;
backend 191/191 y build aprobados en la ejecución inicial, sin cambios posteriores.
Pruebas frontend ampliadas
incluyen navegación/roles, Dashboard, Historial, Estado del nodo, MPU completo/null,
vibración, datos vacíos y consulta con fechas/límite. Son pruebas SSR y de cliente HTTP,
no E2E automatizadas. Se corrigió una advertencia React del title del gráfico SVG.

## N. Revisión visual

Backend y frontend locales comprobados; frontend real abierto en 5174.
Edge no estaba disponible mediante la herramienta de automatización.
Revisión realizada en navegador integrado con backend aislado en 3001 y frontend
5175: datos sintéticos en memoria, sin PostgreSQL ni alteración del historial físico.
Comprobados Dashboard, Historial y límite, Estado del nodo, Usuarios, roles,
logout, MPU ausente, nodo vacío, laptop y pantalla de 390 px.
Captura: ../tmp/beta-v2-demo.jpg (temporal, ignorada por Git, datos sintéticos).
Sesión y mediciones reales, revisión Edge/Firefox y mutaciones de Usuarios pendientes.
No se crearon ni modificaron usuarios reales durante esta revisión.

## O. Git final

Sin commit ni push. Cambios anteriores preservados. El frontend sigue sin rastrear,
por lo que git diff --stat solo informa diferencias rastreadas anteriores.
Se ejecutaron git status, git diff --stat y git diff --check: sin errores de whitespace en los archivos rastreados. El stat continúa con seis archivos, 27 inserciones y 6 eliminaciones anteriores.

## P–Q. Pendientes y valoración

Humedad % requiere calibración confirmada; inclinación ° requiere integración MPU,
unidades y referencia confirmadas; riesgo requiere criterios/umbrales aprobados;
health real requiere diagnósticos explícitos del firmware. No se inventaron valores.
La interfaz es presentable y defendible como beta de consulta de telemetría original.
La validación integral con la sesión, usuarios y datos reales queda pendiente; no
presentarla como sistema validado de alerta o diagnóstico de sensores.

