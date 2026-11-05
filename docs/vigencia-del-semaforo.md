# Vigencia de recepción y actualización automática

## Criterio acordado

El usuario eligió **60 segundos sin una nueva recepción** para desactivar visualmente el semáforo de inclinación. Es un criterio de comunicación y vigencia de datos; no modifica los umbrales experimentales 0,5° / 1° / 2° ni la persistencia del firmware.

`receivedAt` de la medición es la referencia. Con edad menor de 60000 ms, la recepción se considera reciente. A partir de 60000 ms, el estado de recepción indica Sin recepción reciente y los cuatro niveles quedan grises, incluso si la última orientación era NORMAL o CRÍTICO. Una nueva fila con fecha reciente recupera la posibilidad de activar el nivel confirmado del firmware. Consultar otra vez la misma fila antigua **no renueva** su vigencia.

Fecha ausente: Sin datos. Fecha inválida o futura respecto al reloj del navegador: Hora de recepción por verificar, sin activar nivel. El criterio usa el reloj de la PC/navegador; no se presenta como diagnóstico físico definitivo de fallo de Wi-Fi, alimentación o sensores.

## Actualización de pantalla

Dashboard y Estado del nodo consultan `/api/v1/readings/latest` cada **10 segundos**, sin solapar solicitudes. Cada consulta tiene timeout de 15 s; una petición pendiente impide iniciar otra hasta terminar. El reloj de vigencia se actualiza cada segundo, independientemente de que el backend conteste, y al volver a la pestaña/foco se revisa la edad y se solicita una actualización.

Las actualizaciones de fondo no vacían las tarjetas ni cambian a Cargando. Si falla una consulta después de obtener datos, se conserva la última lectura con un aviso breve; su edad continúa avanzando y el semáforo se desactiva al cumplir el intervalo. La primera carga fallida conserva el flujo de error existente. Al cambiar de nodo/vista o salir, se cancelan las peticiones y temporizadores; respuestas tardías no actualizan otro nodo.

Historial y Mediciones diarias mantienen consultas manuales, independientes de este seguimiento. La selección de una lectura por día no detiene ni limita la recepción continua del nodo.

## Presentación simplificada

Se eliminaron de Estado del nodo los textos Diagnósticos avanzados y No se ha definido un intervalo de atraso. Ahora se muestra Estado de recepción calculado con el criterio acordado, manteniendo la última fecha y disponibilidad de los datos guardados. El dashboard indica actualización automática y el semáforo informa el intervalo de vigencia.

No se modificaron firmware, backend, PostgreSQL, API, humedad, vibración, orientación del dispositivo ni calibración. No requiere conectar USB o estar en la red del nodo para editar la presentación; recibir datos nuevos sí requiere comunicación nodo–backend.

## Archivos y pruebas

- `frontend/src/reception.ts`: política única de vigencia y etiquetas.
- `frontend/src/api/pollLatest.ts`: consulta periódica, timeout, cancelación y exclusión de solicitudes solapadas.
- `frontend/src/App.tsx`: reloj y consultas en segundo plano para Dashboard/Estado; historial preservado.
- `RiskPanel.tsx` y `TelemetryViews.tsx`: vigencia, recepción y retiro de textos.
- Pruebas de frontera 59999/60000 ms, fechas futuras/ausentes, niveles grises sin datos recientes, recuperación con nueva recepción, consulta de fila antigua, polling/cancelación/timeout y textos retirados.

Frontend: **46 pruebas aprobadas**, cero fallidas, build TypeScript/Vite aprobado. Backend: **246 pruebas aprobadas**, cero fallidas; no se modificó su código en esta tarea.

## Frecuencia de pantalla opcional añadida después

Se retiró el recuadro vacío de la antigua selección y se colocaron los controles junto al título: Actualizar ahora y actualización de pantalla configurable. Dashboard y Estado ofrecen 10 segundos (predeterminado de pruebas), 5, 10, 15, 30 minutos, 1 hora y Solo manual. Historial mantiene su consulta manual. La elección se conserva mientras esté montada la aplicación y no modifica frecuencia de envío, muestreo, backend, base de datos o firmware.

Cambiar intervalo consulta inmediatamente y luego respeta la nueva frecuencia; Actualizar ahora sigue disponible. Solo manual hace una carga inicial y consultas posteriores por clic; no consulta automáticamente al volver al foco. Los demás modos refrescan también al regresar a la pestaña, sin solapamientos. Todos mantienen el vencimiento de 60 segundos basado en receivedAt: modos de varios minutos pueden dejar el semáforo gris entre consultas. La pantalla explica esa consecuencia; no se extiende silenciosamente la vigencia de una lectura antigua.

Para monitorear el semáforo durante pruebas se recomienda 10 segundos. Los intervalos largos sirven para consultar de forma pausada, no garantizan detección inmediata ni son una recomendación oficial de CONRED. Las lecturas originales continúan almacenándose a la cadencia del nodo.

Pruebas de frontend después del menú: **48 aprobadas**, incluyendo cada intervalo ofrecido y actualización inmediata en manual; build TypeScript/Vite verificado. No se volvió a ejecutar la suite de backend en este ajuste de presentación para respetar la limitación de batería, puesto que no cambió su código.
