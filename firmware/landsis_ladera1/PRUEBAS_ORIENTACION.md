# Orientación relativa experimental

## Implementación y límites

Se conservan Adafruit MPU6050, ±8 g, ±500 °/s y DLPF 21 Hz. Las unidades HTTP siguen siendo m/s², rad/s y °C. No se modifica telemetria.h ni el contrato HTTP: orientación solo existe en RAM y en el diagnóstico Serial, fuera del JSON original.

Después de 3 s de estabilización se promedian 75 vectores válidos de aceleración, a la cadencia existente de aproximadamente 1 s. Mantener completamente inmóvil durante unos 80 s desde el arranque. No se detecta automáticamente la inmovilidad: si se mueve durante la calibración, repetir el arranque ya instalado. La adquisición no bloquea el loop de humedad/vibración ni HTTP. No se resta una calibración de fábrica ni se estima sesgo de sensores.

El baseline se calcula desde el vector promedio, no promediando ángulos. Roll = atan2(y,z); pitch = atan2(-x,hypot(y,z)), en grados. Después se usa media móvil de 10 vectores (~10 s), sin integración de giroscopio ni yaw. Las diferencias se normalizan a [-180,180). Los valores crudos enviados no pasan por este promedio.

La evaluación local es independiente del éxito HTTP y ocurre cada 10 s después del baseline. Cada umbral inclusivo (>=0,5°, >=1°, >=2°) tiene su contador saturado en 6; cae a cero cuando deja de cumplirse. El estado corresponde al umbral más alto con seis evaluaciones consecutivas. Antes de persistir se muestra NORMAL con contadores pendientes; no equivale a ausencia de movimiento. El descenso de estado ocurre al observar una muestra filtrada por debajo del umbral, incluso entre evaluaciones, sin persistencia adicional de recuperación. Seis evaluaciones representan ~60 s nominales, con fase de muestreo y retardo del promedio: no es un temporizador exacto. No se cuentan ciclos omitidos como lecturas nuevas.

Una lectura fallida, no finita o de vector cero borra filtro y contadores y muestra SIN_DATO_VALIDO; no genera una condición NORMAL válida. Durante calibración reinicia las muestras acumuladas. Si falta el MPU se mantiene el diagnóstico existente. Baseline no persistente: cada reinicio adopta la orientación actual; no permite detectar desplazamientos acumulados entre reinicios.

Los niveles describen inclinación experimental, no riesgo global ni valores geotécnicos oficiales. Aceleración dinámica también afecta estos ángulos. Roll/pitch son coordenadas de gravedad: no miden traslación ni rotación alrededor de gravedad, y roll es singular cuando el eje X queda alineado con gravedad. La placa horizontal descrita evita esa singularidad en su posición inicial; no se garantiza independencia arbitraria de orientación ni precisión subgrado sin pruebas físicas.

## Procedimiento verificable A–E

Registrar fecha, montaje, versión, salida Serial 115200 y resultados reales. No asumir una tolerancia angular definitiva: anotar ruido observado y valores antes/después. Compilar y cargar solo con acceso físico autorizado; no reiniciar o mover el nodo durante captura del baseline.

1. **A — inmóvil:** arrancar instalado y no tocar por al menos 80 s. Confirmar baseline 75/75, valores finitos, deltas cercanos a cero, NORMAL y contadores 0/0/0 durante al menos 70 s. Registrar extremos de deltaRoll/deltaPitch para caracterizar ruido. No considerar esta observación calibración metrológica.
2. **B — inclinación suave:** tras A, mover suavemente un eje sin traslación brusca; esperar 10 s para llenar el filtro. Registrar qué delta cambia y su signo. Repetir con el otro eje, evitando la singularidad indicada. Comparar con una referencia angular independiente si se requiere comprobar exactitud.
3. **C — retorno:** devolver a marcas físicas de la posición de A. Esperar el llenado del filtro y la próxima evaluación. Confirmar deltas aproximadamente de vuelta a cero y contadores reiniciados.
4. **D — perturbación breve:** desde A, inclinar brevemente y regresar. Verificar que los contadores pueden subir, pero ninguno llega a 6 y no aparece estado persistente. Registrar al menos 70 s incluyendo retorno. Un impulso muy grande puede afectar varias muestras del promedio; observar su duración real.
5. **E — sostenida:** mantener un delta filtrado entre 0,5° y 1° durante seis evaluaciones: esperar PRECAUCION. Repetir entre 1° y 2° para ALERTA y >=2° para CRITICO, con retorno a A entre ensayos. Guiarse por deltas registrados, no por inclinación física del poste. Comprobar contadores individuales 1…6, sin aumento a cada reporte de 1 s. Incluir al menos 80 s por ensayo para filtro y fase de evaluación.
6. **Reinicio e inválidos:** reiniciar inmóvil en otra posición y comprobar nuevo baseline y deltas cercanos a cero. En banco, simular lectura inválida o pérdida del MPU de forma controlada y comprobar diagnóstico, reinicio de persistencia y ausencia de valores de orientación presentados como válidos.
7. **Compatibilidad:** durante A–E comprobar HTTP 201 aproximadamente cada 10 s y filas reales nuevas con los siete campos MPU originales; comprobar humedad y vibración con su procedimiento existente. No enviar roll/pitch al backend, que rechaza campos desconocidos. La calibración no debe detener los reportes de 1 s ni la recepción.

Pendiente: ejecución física A–E en el nodo. La compilación y las pruebas del backend/frontend no sustituyen estas observaciones.

## Verificación de software — 3 de noviembre de 2026

- Arduino CLI, core ESP32 3.3.12, FQBN `esp32:esp32:esp32`, compilación completa exitosa con dos procesos. Flash 973756 bytes (74%); RAM global 50184 bytes (15%). Artefactos locales en `build/orientacion/`, ignorados por Git; no publicar esa carpeta, que contiene copias de configuración local.
- Backend: `npm test`, 240 aprobadas, cero fallidas u omitidas. Fue necesario ejecutar fuera del aislamiento de sockets para las pruebas HTTP; el primer intento aislado no permitió validarlas.
- Frontend: `npm test`, 29 aprobadas, cero fallidas u omitidas.
- No se cargó firmware al ESP32 ni se ejecutaron físicamente A–E. Estos resultados comprueban compilación y regresión de las suites existentes, no precisión angular ni persistencia en hardware. Los ensayos anteriores constituyen el procedimiento verificable para el nuevo comportamiento.

## Revisión previa a carga — continuación del 3 de noviembre de 2026

- Se repitió la compilación sin modificar fuentes: exitosa, 973756 bytes de flash (74%) y 50184 bytes de RAM global (15%), misma placa y core.
- Configuración local y cabeceras coinciden con las copias compiladas, excluyendo las directivas `#line` que Arduino agrega. No se modificaron ni publicaron credenciales. `secrets.h` sigue ignorado por Git.
- nodeId sigue siendo `LADERA-1`. La IP actual de la PC coincide con la URL local configurada; se conserva `/api/v1/readings`, puerto 3000 e intervalo 10000 ms.
- Se verificaron exactamente los diez campos HTTP originales: nodeId, soilMoistureRaw, vibrationDetected, accelX, accelY, accelZ, gyroX, gyroY, gyroZ y temperature. Orientación permanece fuera del POST. No se modificaron backend, frontend, base de datos, humedad, vibración ni riesgo global.
- No se detectó puerto serie: Arduino CLI informó `detected_ports: []`. No se intentó cargar ni reiniciar el ESP32.
- El usuario confirmó que el nodo sigue instalado y encendido a casi cuatro metros de altura; no desea desmontarlo. El firmware disponible en el repositorio no implementa actualización OTA ni diagnóstico Serial por red. El nodo físico debe seguir considerándose con el firmware anterior; no se verificó su imagen binaria por lectura física.
- Pendientes las pruebas físicas solicitadas: A inmóvil y registro de mínimos/máximos durante varios minutos; B inclinación 0,5–1°; C >1°; D >=2°; E perturbación breve; F retorno al baseline. No hay mediciones nuevas de ruido ni evidencia de persistencia física. No se proponen cambios de umbral sin esos datos.
- No se inició el backend en esta continuación: la comprobación de transmisión solicitada después de validar el MPU sigue pendiente. Una eventual evaluación de datos crudos en PC debe distinguirse de la validación del firmware nuevo instalado.

