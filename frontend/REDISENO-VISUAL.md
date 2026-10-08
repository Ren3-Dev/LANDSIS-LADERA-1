# Rediseño visual institucional

Cambios exclusivamente de presentación en el frontend:

- src/styles.css: tokens de color, tipografía, sidebar, topbar, tarjetas, tablas,
  formularios, gráficas y breakpoints responsive.
- src/AuthApp.tsx: contenedores app-shell/app-content, sin cambiar autenticación.
- src/components/UserNavigation.tsx: sidebar y topbar; mismos destinos y permisos.
- src/components/InterfaceIcon.tsx: iconos SVG simples locales, sin dependencia.
- src/App.tsx: elimina encabezado duplicado, ahora presentado en la topbar.
- src/components/TelemetryViews.tsx: iconos visuales en las tarjetas existentes.
- src/components/MoistureChart.tsx: clases de color para curva y puntos, sin alterar datos.

Paleta: navy #183153, blue #2453A6, cyan #8DBBC3, arena #E9E2D3.
Fondos claros, superficies blancas, bordes sutiles y sombras mínimas.
Inter se utiliza si está disponible en el dispositivo; Segoe UI/system-ui como respaldo.
No se descarga tipografía externa. Texto mínimo general de 12 px.

Los colores se centralizan en variables CSS, incluyendo superficies, bordes, texto,
gráfica y estados semánticos. Esto prepara la sustitución de tokens para un futuro
modo oscuro; no existe selector ni modo oscuro implementado.

Desktop: sidebar fija y topbar clara; tarjetas 4 columnas donde existe espacio.
Laptop/tablet: tarjetas 2 columnas, formularios adaptables.
Móvil: navegación en bloque superior, tarjetas de una columna y tablas desplazables.

No se añadieron valores ni placeholders numéricos. Riesgo pendiente de configuración,
RAW pendiente de calibración y diagnósticos avanzados no disponibles conservan sus
mensajes actuales. No se muestran porcentaje, grados, conectado ni operativo inventados.
La gráfica existente permanece en Historial. Usuarios sigue reservado al administrador.

Verificación: build + TypeScript y 12 pruebas frontend aprobadas. ESLint no está
configurado. API, modelos, validaciones, backend, PostgreSQL y firmware sin cambios.
La beta real se sirve en http://127.0.0.1:5174 para revisión del usuario. La herramienta
rechazó recargar la pestaña de error por política de seguridad; no se eludió el bloqueo.
Revisión visual responsive y comprobación de mediciones reales pendientes de sesión.
Sin datos sintéticos añadidos ni commit/push.
