# Aviso especial del nodo en el dashboard

Imagen opcional: frontend/public/images/despedida-nodo.jpg. Colocar un JPG con ese nombre; no requiere editar código. En desarrollo, recargar el dashboard después de añadirlo. En una publicación estática, volver a compilar/publicar para incluir el archivo nuevo.

Condición: última orientación observada en ALERTA con contador alerta 6/6, o CRITICO con contador crítico 6/6; después, una consulta exitosa de latest confirma que no hay registros posteriores durante al menos 60 segundos. Una pantalla sin actualizar no demuestra desconexión y no dispara el aviso por el mero paso del reloj. Se recomienda actualización de pantalla cada 10 segundos para advertirlo oportunamente. No se modifica el envío del ESP32.

NORMAL, PRECAUCION u otra lectura nueva sin condición confirmada desarman el disparo pendiente. El aviso activo permanece al menos una hora desde su activación; si no se restablece comunicación, continúa. Una lectura nueva reciente actualiza la tarjeta a Comunicación restablecida. Una pérdida posterior tras otra condición confirmada inicia un aviso nuevo.

El estado se conserva en localStorage de este navegador y origen. No es un registro compartido entre usuarios/dispositivos; si no se observó la orientación antes de que el backend perdiera su caché, no puede reconstruirse a partir del historial actual. No se agregan migraciones, contratos HTTP, alertas de correo ni modificaciones de firmware. La tarjeta no confirma daños, sepultamiento ni riesgo global.

Incluye flecha flotante con enlace al aviso al final del dashboard, autor Kevin Escobar Cifuentes y contacto kevinaugustorenela@gmail.com. Si la imagen no existe, se oculta sin impedir el aviso.

Validación: compilación frontend correcta; 56/56 pruebas aprobadas, incluidas 6 pruebas nuevas de activación, exclusiones, consulta reciente, desarme, permanencia y almacenamiento. Backend sin cambios en esta tarea.
