# Dashboard beta — incremento 9

El incremento 10 agrega login, sesión y Usuarios exclusivos ADMINISTRADOR. Antes
de ejecutar con la nueva API, seguir la [guía de activación](../docs/incremento-10-autenticacion.md)
para migración 004 y bootstrap. Las verificaciones reales descritas más abajo
corresponden al incremento 9, antes de proteger consultas.

React + TypeScript, Vite y CSS normal. Vite proporciona servidor de desarrollo,
proxy y build; no se usa framework UI, gestor de estado ni librería de gráficas.
La gráfica SVG representa RAW ADC sin conversiones, en orden cronológico,
con tiempo de recepción en X y escala ADC 0–4095 en Y (no es un umbral de riesgo).

## Ejecutar en PowerShell

Primera terminal, con PostgreSQL disponible y `backend/.env` local ya configurado:

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1\backend
npm ci
npm run build
npm start
```

No aplicar migraciones, insertar datos ni cambiar credenciales para esta beta.
Si ya hay un backend escuchando en 3000, usar ese proceso sin iniciar otro.

Segunda terminal:

```powershell
cd C:\Users\Augus\Documents\LANDSIS-LADERA-1\frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Abrir http://127.0.0.1:5173. Detener cada proceso con Ctrl+C.
Para compilar: `npm run build` (incluye comprobación TypeScript).

Las consultas son GET relativos a `/api/v1`: `nodes`,
`readings/latest?nodeId=...` y `readings?nodeId=...&limit=50`.
`URLSearchParams` codifica el identificador exacto del selector.
Vite reenvía `/api` a `http://localhost:3000`; para otro destino copiar
`.env.example` a `.env`, ajustar `API_PROXY_TARGET` y reiniciar Vite.
No se habilita CORS. Esta variable configura el servidor de desarrollo y no contiene secretos.

El build estático en `dist/` requiere un servidor que entregue los archivos
y reenvíe `/api` al backend bajo la misma procedencia. `npm run preview`
sirve para inspeccionar el build; no configura por sí solo ese proxy ni un despliegue.

## Estructura y comportamiento

- `src/api/telemetry.ts`: fetch, timeout de 15 s y validación de respuestas.
- `src/types/telemetry.ts`: contrato del catálogo y lecturas, MPU anulable.
- `src/components/MoistureChart.tsx`: gráfica SVG, sin alterar el historial.
- `src/components/MpuPanel.tsx`: siete valores MPU, sin calcular inclinación.
- `src/App.tsx`: selección, resumen, historial y estados de carga/error/vacío.
- `src/styles.css`: presentación responsive, foco visible y tabla desplazable.

El catálogo se carga al abrir. En la beta V2, seleccionar nodo consulta los datos de la vista activa;
Actualizar datos vuelve a consultar el nodo, o reintenta el catálogo si falló/está vacío.
No hay actualización automática: la fecha de consulta y de recepción son distintas;
la interfaz no afirma que el nodo esté conectado. Los cambios de nodo cancelan
las solicitudes anteriores y retiran datos anteriores. Latest 404 indica sin lectura.
Errores HTTP, respuesta inválida o timeout muestran mensajes claros y permiten reintentar.
Las lecturas null se muestran como Sin lectura; cero sigue siendo válido.
La temperatura está identificada como MPU6050. No se infieren unidades no documentadas.
Riesgo: Pendiente de configuración; no existen umbrales ni clasificación científica.

## Revisión manual pendiente

1. Con backend y frontend activos, abrir el dashboard y seleccionar LADERA-1.
2. Comparar resumen e historial con los GET del backend; comprobar 50 filas y curva RAW.
3. Revisar MPU6050, valores null/cero y ausencia de porcentaje, inclinación y riesgo calculado.
4. Pulsar Actualizar datos y comprobar fecha de consulta; verificar tabla con desplazamiento.
5. Detener solo el backend, actualizar y comprobar mensaje de error sin datos anteriores.
   Reiniciar backend y reintentar.
6. Revisar laptop y pantalla estrecha, teclado y selector.
7. Catálogo vacío/nodo sin mediciones requieren un entorno de prueba aislado con respuestas
   `nodes: []`, latest 404 e historial vacío; no vaciar ni insertar en la base real.

Se verificaron build/TypeScript y los 161 tests existentes del backend.
Los GET reales devolvieron LADERA-1, última lectura y 50 históricos; un identificador
inexistente devolvió historial vacío y latest 404. Revisión visual y estados de UI
en navegador pendientes por bloqueo de aprobación del entorno, no verificados manualmente.

## Beta V2: navegación, historial y estado del nodo

La navegación principal incluye Dashboard, Historial y Estado del nodo para los
 tres roles; Usuarios sigue reservado al ADMINISTRADOR. `AuthApp` conserva la
sesión y controla la vista con estado React, sin React Router ni nuevas dependencias.
`App` conserva el selector mientras se navega entre las tres vistas de telemetría.
Al entrar a Usuarios se desmonta telemetría; al volver se consulta de nuevo el catálogo.

- `src/presentation.ts`: etiquetas de valores, fechas, vibración y disponibilidad MPU.
- `src/components/TelemetryViews.tsx`: resumen, historial y disponibilidad técnica.
- Dashboard consulta solamente `readings/latest`; MPU está en un bloque expandible.
- Estado del nodo usa última recepción y disponibilidad de campos, sin umbral de atraso.
- Historial consulta `readings` con `nodeId`, `limit` de 1 a 100 y fechas opcionales
  `from` incluida / `to` excluida. Las fechas locales se envían como ISO con zona UTC.
- Los filtros se aplican mediante Consultar historial. Actualizar datos repite la
  consulta aplicada. No hay paginación ni actualización automática.
- Los errores de una consulta no mantienen datos previos visibles. Las solicitudes
  canceladas no pueden reemplazar los resultados de la nueva selección.

La beta conserva RAW ADC y los siete campos MPU originales. No calcula porcentaje,
inclinación ni riesgo. Los indicadores de disponibilidad no certifican salud del hardware.

Pruebas: `npm test`. Incluyen SSR de componentes, roles/navegación, etiquetas,
MPU completo/null, estados vacíos y contrato fetch con filtros; no constituyen pruebas
E2E automatizadas. La revisión interactiva se realizó en el navegador integrado con
un servidor temporal de datos sintéticos en memoria, usando autenticación real del
backend y sin conexión a PostgreSQL. Sesión/datos reales y Edge/Firefox pendientes.

