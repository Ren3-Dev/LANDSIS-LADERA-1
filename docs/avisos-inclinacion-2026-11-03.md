# Avisos automáticos de inclinación — 3 de noviembre de 2026

Se habilitó ALERT_EMAIL_ENABLED en el entorno local. El servidor comprueba la tabla de control antes de activar el observador. Si falta la configuración o la tabla, registra un error genérico y mantiene la recepción de mediciones.

## Disparo y destinatarios

Solo mediciones recién guardadas de LADERA-1: orientación ready, estado CRITICO, contador crítico 6/6 y al menos un delta absoluto >= 2°. No se recorren lecturas históricas al iniciar. Se envía individualmente a cada dirección válida y única de usuarios activos, no eliminados. La consulta local encontró 4 usuarios activos. No se exponen direcciones entre destinatarios.

Se registra el evento antes de enviar. No se repite mientras siga activo, incluso después de reiniciar el backend. Solo un NORMAL con deltas menores de 0,5° y los tres contadores en cero rearma el aviso. Calibración, ausencia de orientación y estados intermedios no lo rearman. No se modifican los umbrales del firmware.

## Contenido

Asunto: [LANDSIS] 🚨 Inclinación CRÍTICA confirmada — LADERA-1

Incluye 📍 nodo, 🕒 recepción en Guatemala, 💧 humedad RAW ADC, 📐 delta roll/pitch, ⏱️ persistencia, 📳 vibración, baseline e identificador de medición. La humedad no se presenta como porcentaje ni se afirma un incremento no demostrado. La vibración se informa como detectada/no detectada. Es un aviso experimental de inclinación, no una declaración de deslizamiento ni un riesgo global combinado.

## Persistencia y límites

La migración 007 agrega únicamente inclination_email_state; no altera usuarios ni mediciones. Guarda último ID procesado, condición activa, último evento y resultado agregado (aceptados SMTP, fallidos, omitidos). La cola en memoria admite 32 mediciones pendientes. El envío no bloquea la respuesta HTTP 201; un destinatario fallido no detiene los demás.

Existe un intento por destinatario y evento, sin reintento automático. Una interrupción durante el envío puede dejar pending o una entrega incompleta; se requiere revisión manual. La tabla conserva el último evento por nodo, no un historial de cada destinatario. Aceptación SMTP no demuestra lectura del mensaje ni garantiza que alguien responda. El backend debe permanecer ejecutándose y tener acceso a PostgreSQL y SMTP.

## Validación

SMTP verify satisfactorio sin mensajes nuevos. Las dos pruebas manuales anteriores fueron recibidas según confirmación del usuario (ver prueba-correo-controlada-2026-11-03.md). Las pruebas nuevas usan transporte simulado: no se inyectó un evento crítico en producción ni se emitió una falsa emergencia masiva. La entrega automática ante un evento físico real queda pendiente de observar.

Verificación del proceso principal: /health respondió ok; el observador procesó una medición real (ID 2211), estado idle, condición crítica inactiva, cero envíos. Esto confirma que la configuración está activa sin disparar correos históricos. No hubo cambios de frontend ni firmware en esta tarea.

Resultado final: compilación TypeScript correcta y 252/252 pruebas backend aprobadas, incluidas 6 pruebas nuevas de notificaciones. Frontend sin cambios; no se repitió su suite en esta tarea. SMTP verificado y /health operativo.
