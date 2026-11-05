# Evaluación física de grados — segunda sesión del 3 de noviembre de 2026

## Alcance y condiciones

Se conservó el firmware cargado, sin cambios de código ni umbrales. No se modificaron backend, frontend, PostgreSQL, API, credenciales, Wi-Fi, humedad ni vibración. Esta sesión no sustituye la medición en la instalación definitiva: el usuario confirmó un **apoyo provisional de pruebas**.

Con ayuda de otra persona se fijó el montaje. El usuario confirmó que estaba listo e inmóvil. La captura del teléfono, apoyado en la caja antes del reinicio, mostró **X=1,7° e Y=-1,1°** como referencia inicial. No se exige horizontalidad; se compararán cambios respecto a esa referencia, manteniendo la misma cara y orientación. Los ejes del teléfono y del MPU no se consideran equivalentes hasta comprobar su respuesta. El teléfono es una referencia práctica, sin exactitud angular certificada en esta prueba.

Se abrió COM3 a 115200 y se envió un pulso RTS de reinicio, sin recargar firmware. Serial mostró arranque normal, MPU6050 en 0x68 y progresión CALIBRANDO hasta baseline 75/75. Se pidió no tocar la caja ni pulsar Calibrar en el teléfono. Baseline de esta sesión: roll **0,2680°**, pitch **-0,9750°**.

El registro íntegro está en `logs/grados-20261103-165835.log`, ignorado por Git. Resumen de reposo: `logs/grados-20261103-165835-reposo.json`. Marcas de esos archivos en UTC; horarios de este informe en Guatemala.

## Paso 1 — Intento de reposo invalidado por sujeción manual

**Aclaración posterior del usuario:** la caja estuvo sostenida con las manos y fue difícil no moverla. Por lo tanto esta ventana **no es válida para caracterizar ruido en reposo**. Se conservan las cifras para trazabilidad, como variación observada durante sujeción manual. No se usarán para estimar ruido intrínseco, certificar ausencia de falsos positivos en reposo ni proponer cambios de umbrales. Se cerró la captura para preparar una repetición con apoyo autónomo estable, sin nuevo reinicio hasta confirmar esa condición.

Ventana: **10:59:54,935 a 11:02:55,005**, **181 lecturas angulares**, **180,07 s**. Se incluyeron todas las lecturas desde completar baseline, sin descartar valores iniciales ni seleccionar solamente una zona estable.

| Variable | Mínimo | Máximo | Media | Desviación estándar poblacional |
| --- | ---: | ---: | ---: | ---: |
| currentRoll | 0,1370° | 0,7261° | 0,43473° | 0,11449° |
| currentPitch | -1,2439° | -0,8367° | -1,04247° | 0,09063° |
| deltaRoll | -0,1310° | 0,4581° | 0,16674° | 0,11449° |
| deltaPitch | -0,2689° | 0,1383° | -0,06744° | 0,09062° |

Máxima desviación absoluta observada entre ambos deltas: **0,4581°**, en roll. Incluye movimiento real de la caja sostenida a mano; no es una medición de ruido de reposo. Los valores X/Y posteriores del teléfono todavía no se registraron.

Se registraron 180 líneas de estado dentro de los límites de las 181 líneas angulares, por la separación de milisegundos entre impresiones. Todas indicaron NORMAL, 0/0/0; no se observó activación persistente en esta ventana con sujeción manual. No constituye un ensayo válido de falsos positivos en reposo.

## Decisión provisional

No se modificaron 0,5°, 1° ni 2°. **No se puede decidir su idoneidad por este intento con movimiento manual.** Se requiere repetir la medición con la caja apoyada sin intervención de las manos y completar las comparaciones angulares. La sesión previa tuvo otro baseline y condiciones de apoyo diferentes; no se mezclan las muestras.

## Pasos pendientes

- Colocar la caja en apoyo autónomo estable, dejar USB holgado y teléfono fijo; repetir reinicio, baseline y al menos tres minutos sin tocarla. Registrar la referencia X/Y correspondiente a esa nueva posición.
- Movimiento pequeño, eje que responde y retorno sin reiniciar.
- Tabla de referencia 0,5° / 1° / 2° / 3° / 5°: aún sin datos, no inferidos de las fotos iniciales.
- Perturbación breve de unos 10–15 s y retorno, comprobando que los deltas filtrados y contadores se recuperan. Seis evaluaciones cada 10 s abarcan unos 50 s entre la primera y la sexta; sostener 59 s no garantiza evitar persistencia.
- Persistencia sostenida y validación de cada nivel experimental; ninguna condición se interpreta como riesgo global de deslave.
- Recomendación final por umbral basada en resultados, sin aplicar cambios automáticos. Sensibilidad/exactitud con referencia y validación en posición definitiva todavía pendientes.

## Comparación manual posterior con teléfono

El usuario indicó que no podían dejar la caja estable sin sostenerla. Se continuó únicamente con una comparación manual de respuesta, no como ensayo de ruido en reposo. Captura nueva **sin reinicio**: `logs/grados-manual-20261103-170856.log`, con resúmenes de referencia y posición en archivos JSON del mismo prefijo. Baseline del firmware permanece 0,2680° / -0,9750°; la referencia manual inicial del teléfono no se identifica con ese baseline.

El usuario reportó primero teléfono X=1,7° / Y=-2,5° y luego X=1,1° / Y=-1,5°: cambios -0,6° / +1,0° en dos ejes. Confirmó que se movieron caja y teléfono juntos, sin reacomodar el teléfono respecto a la caja. Las lecturas del teléfono fueron comunicadas manualmente y no están sincronizadas muestra a muestra con el MPU; la sujeción tampoco asegura un ángulo constante.

| Referencia manual del teléfono | Ventana MPU, hora Guatemala | deltaRoll medio [mín, máx] | deltaPitch medio [mín, máx] | Observación |
| --- | --- | --- | --- | --- |
| X=1,7°; Y=-2,5° | 11:08:59–11:09:06, 10 muestras | 0,39864° [0,3516°; 0,4725°] | -0,13879° [-0,1640°; -0,1088°] | NORMAL inicial; timestamps de recepción, sin reloj del nodo |
| X=1,1°; Y=-1,5°, reportados | 11:10:58–11:11:17, 20 muestras | -0,13330° [-0,1857°; -0,1005°] | -0,64819° [-0,7352°; -0,5562°] | NORMAL al final de esta ventana; contador precaución 3/6 |

Cambio de medias entre esas ventanas: deltaRoll -0,53194° y deltaPitch -0,50940°. Es respuesta observada de ambos ejes, no factor de calibración ni correspondencia directa entre X/Y del teléfono y roll/pitch. No se etiqueta esta maniobra como prueba de un ángulo puro de 1°. Se solicitó retorno al teléfono X≈1,7° / Y≈-2,5° para comprobar repetibilidad respecto al inicio manual, sin exigir delta cero del baseline anterior.

Durante la continuación de la captura apareció por primera vez PRECAUCION 6/0/0 a las **11:12:45**, con la condición experimental de persistencia cumplida. A las 11:13:47 se observó delta roll -0,2751° y delta pitch -0,7788°, PRECAUCION 6/0/0. Esto comprueba activación local del umbral de 0,5° según los valores del MPU; no certifica el ángulo externo ni elimina el efecto de sujeción manual. La lectura del teléfono y confirmación del retorno están pendientes. No se completó aún la tabla de ángulos conocidos ni se cambiaron umbrales.

El usuario reportó después teléfono X≈0,5° / Y≈-0,9°, que difiere de la referencia manual inicial 1,7° / -2,5°. Se registra como otra posición, **no como retorno verificado**. Ventana de las 11:14:02 a 11:14:21, 20 lecturas: delta roll medio -0,23333° (mínimo -0,2772°, máximo -0,1473°), delta pitch medio -0,82186° (mínimo -0,8993°, máximo -0,7675°); al final PRECAUCION 6/0/0. Resumen en `logs/grados-manual-20261103-170856-posicion2.json`. Las horas corresponden a recepción Serial y el valor del teléfono fue comunicado manualmente, sin sincronización por muestra. Se mantiene pendiente recuperar la referencia inicial para evaluar retorno; acercar el teléfono a horizontal no equivale a recuperar el baseline anterior del MPU.

## Cambio de referencia acordado por el usuario

Posteriormente el usuario indicó tomar la última lectura X/Y como referencia definitiva para la posición de 90° y confirmó la interpretación propuesta. **Se adopta teléfono X≈0,5° / Y≈-0,9° como referencia de la prueba, denominada posición nominal de 90° del montaje.** Esta decisión reemplaza la referencia manual anterior X=1,7° / Y=-2,5° para comparaciones futuras; se conservan los datos y referencias históricas de arriba sin reinterpretarlos como ensayos de retorno a la nueva referencia.

Se trata de una designación del montaje por el usuario, no de una certificación de perpendicularidad ni de una conversión de X/Y a roll/pitch. El cambio relativo de referencia se define conceptualmente como cero respecto a esa posición. **No se reinició ni recalibró el baseline del firmware por esta anotación**: sus deltas siguen referidos al baseline que ya estaba en RAM hasta que se efectúe una nueva calibración explícita. No se modificaron código, umbrales ni configuración de red.

## Repetición tras apoyar la caja contra un punto fijo

Posteriormente el usuario confirmó que la caja estaba apoyada contra un punto fijo. Se cerró la captura manual anterior y se reinició el ESP32 por RTS, con nueva captura en `logs/grados-apoyo-fijo-20261103-172248.log`. El puerto se abrió a 115200 y se descartó su buffer antes del reinicio. No se modificó firmware ni umbrales. Se pidió dejar caja y teléfono sin tocar, USB holgado, durante baseline y tres minutos posteriores. El usuario reportó teléfono **X=5,0° / Y=3,9°** en esta nueva posición: esos son los valores efectivos iniciales del teléfono para comparar movimientos de esta repetición, distintos de las referencias manuales históricas.

Baseline nuevo del MPU: **roll -2,7654° / pitch 0,2604°**. Ventana posterior a baseline 75/75: **11:24:08,442 a 11:27:08,471**, 181 lecturas, **180,029 s**. Resumen en `logs/grados-apoyo-fijo-20261103-172248-reposo.json`.

| Variable | Mínimo | Máximo | Media | Desviación estándar poblacional |
| --- | ---: | ---: | ---: | ---: |
| currentRoll | -3,4214° | -2,7211° | -3,00178° | 0,20308° |
| currentPitch | -0,3879° | 0,3642° | 0,05699° | 0,19769° |
| deltaRoll | -0,6560° | 0,0443° | -0,23641° | 0,20308° |
| deltaPitch | -0,6483° | 0,1038° | -0,20344° | 0,19768° |

Máxima desviación absoluta observada: **0,6560°**. Es variación del sistema en el apoyo declarado, no ruido intrínseco del sensor demostrado. Se solicitó lectura X/Y final del teléfono antes de otro movimiento para distinguir posible desplazamiento del apoyo de variación instrumental.

Todas las líneas de estado registradas dentro de la ventana indicaron NORMAL. El contador de precaución llegó a 1 y 2 a las 11:26:08 y 11:26:18, y volvió a cero a las 11:26:24; no se activó persistencia. Esto demuestra cruces de 0,5° y reinicio del contador en esta ventana, pero no certifica inmunidad a falsos positivos prolongados. El umbral de 0,5° no tiene margen de reposo demostrado en este montaje. No se propuso ni aplicó un valor nuevo sin aclarar la estabilidad física y completar las pruebas restantes.

**Comprobación de estabilidad al final:** el usuario reportó teléfono **X=3,5° / Y=5,5°**, frente a 5,0° / 3,9° iniciales, cambios -1,5° / +1,6°. No se demostró estabilidad del conjunto caja/apoyo/teléfono; esos datos impiden atribuir la variación exclusivamente al ruido instrumental. El máximo 0,6560° se conserva como variación observada, **no como ruido de reposo validado para cambiar umbrales**. Queda sin resolver si cedió el apoyo o se desplazó el teléfono respecto a la caja. Se decidió continuar comprobando respuesta y persistencia sin presentar esta sesión como calibración metrológica ni repetir automáticamente otro baseline.

**Posición pequeña posterior:** teléfono X=5,6° / Y=3,5°, comunicado por el usuario; diferencia +0,6° / -0,4° respecto a 5,0° / 3,9° iniciales, no un giro puro en un eje. Ventana MPU 11:30:35–11:30:54, 20 lecturas: delta roll medio 0,41415° (0,4010°–0,4300°), delta pitch medio 0,54504° (0,5141°–0,5914°). Al final NORMAL con contador 4/0/0, pendiente de completar persistencia. Resumen en `logs/grados-apoyo-fijo-20261103-172248-posicion1.json`. No se convierte esa observación en una calibración exacta a 0,5°.

## Inclinación grande — activación crítica observada

El usuario reportó teléfono **X=-44,0° / Y=40,1°**. Esta maniobra excede ampliamente los pequeños ángulos solicitados y modifica ambos ejes. Se pidió no aumentar la inclinación y regresar al apoyo inicial al confirmar el estado. No se etiqueta como prueba de referencia a 2°, 3° o 5°.

Serial mostró la secuencia de contadores críticos 1, 2, 3, 4, 5 y 6 y alcanzó **CRITICO de inclinación, 6/6/6**. Primer estado CRITICO recibido por la PC a las **11:34:43,173**. En parte del tramo, las marcas de recepción se agrupan tras una pausa del lector (varios cambios recibidos a las 11:34:43); por eso no se usa ese segmento del log para certificar la temporización exacta del ESP32. La captura no contiene reloj del dispositivo en cada muestra.

Ventana 11:35:44–11:36:03, 20 lecturas: delta roll medio **25,01046°**, mínimo **24,7195°**, máximo **25,3644°**; delta pitch medio **-21,09847°**, mínimo **-21,2652°**, máximo **-20,9297°**. CRITICO 6/6/6 sostenido. Resumen en `logs/grados-apoyo-fijo-20261103-172248-critico.json`.

Resultado: activación persistente de la rama crítica con un cambio angular grande confirmada. **No confirma precisión ni sensibilidad en el límite de 2°**, no certifica equivalencia con ejes del teléfono y no implica riesgo global de deslave. No se infiere un factor de calibración de la diferencia teléfono/MPU. Se solicitó retorno al mismo apoyo, referencia telefónica aproximada X=5,0° / Y=3,9°, sin reiniciar, para comprobar recuperación del estado y contadores.

## Retorno después de la inclinación grande

El usuario confirmó retorno aproximado, sin comunicar X/Y finales. Se comprobó **NORMAL con 0/0/0** y el mismo baseline -2,7654° / 0,2604°, sin ordenar reinicio. Ventana de las **11:40:57 a 11:41:16**, 20 lecturas: delta roll medio **-0,21681°**, mínimo -0,3171°, máximo -0,0962°; delta pitch medio **0,14557°**, mínimo 0,0260°, máximo 0,2704°. Última lectura -0,1677° / 0,0260°.

Se confirma recuperación de estado y contadores y retorno aproximado de los deltas cerca de cero. No se demuestra retorno angular externo exacto ni error de repetibilidad metrológico, porque la referencia telefónica final no se registró y el apoyo ya mostró desplazamientos. Resumen en `logs/grados-apoyo-fijo-20261103-172248-retorno.json`.

Se solicitó como último ensayo una inclinación de pocos grados durante cinco segundos y regreso inmediato al apoyo, esperando después veinte segundos. Pendiente de confirmación y análisis de esa ventana; no se declara aún aprobada.

## Intento de perturbación breve

El usuario confirmó una maniobra de cinco segundos y retorno. En el intervalo de observación desde 11:41:30 hasta 11:43:25 hubo pico de **5,5711°** y el estado registrado siguió NORMAL. Al final los contadores eran 1/1/1 y el delta roll seguía en 5,5382°. Se esperó tiempo adicional sin solicitar otro movimiento para permitir el asentamiento del promedio.

A las **11:43:57**, delta roll **3,0817°**, delta pitch **-1,1597°**, NORMAL y **4/4/4**. La condición medida permanecía por encima de los umbrales después del retorno comunicado; el episodio angular observado no quedó limitado a cinco segundos. Esto impide declarar aprobada la prueba controlada de perturbación breve: el retorno físico no reprodujo suficientemente el baseline y no debe explicarse todo ese tiempo como retardo de un promedio de diez muestras. Tampoco se etiqueta un eventual estado persistente posterior como falso positivo, porque el propio sensor continúa midiendo una posición desplazada.

Se ofreció cerrar esta prueba como no concluyente o recuperar el apoyo inicial sin reiniciar. Resumen inicial de la ventana en `logs/grados-apoyo-fijo-20261103-172248-perturbacion.json`; la evolución posterior permanece en el log íntegro.

## Balance provisional por objetivo

| Objetivo | Evidencia y límite |
| --- | --- |
| Ruido máximo real de reposo | No determinado de forma válida: sujeción manual en un intento y cambio de referencia telefónica en el apoyo posterior. 0,4581° y 0,6560° son variaciones observadas de esos montajes, no ruido intrínseco certificado. |
| Sensibilidad del MPU instalado | Se observan respuestas de roll y pitch a movimientos. No se obtuvo exactitud ni factor de calibración con una referencia rígida y sincronizada. |
| Retorno al baseline | Recuperación aproximada y limpieza 0/0/0 comprobadas después de la inclinación grande; repetición posterior de retorno todavía no recuperó cero. Repetibilidad cuantitativa no validada. |
| 0,5° | Cruces y contadores observados; PRECAUCION persistente observada en la captura manual. Margen de reposo no validado. |
| 1° | ALERTA persistente observada en la primera sesión física documentada en VALIDACION_FISICA_2026-11-03.md. Exactitud del ángulo externo de 1° no certificada. |
| 2° | CRITICO 6/6/6 confirmado ante inclinación grande; no se ensayó de forma controlada la frontera externa exacta de 2°. |
| Falsos positivos | Sin ensayo de reposo físicamente estable suficiente para concluir su tasa. Persistencia durante desplazamiento real medido no se interpreta como falso positivo. |

**Recomendación:** conservar sin modificación automática 0,5° / 1° / 2° como parámetros experimentales pendientes de validación metrológica, sin presentarlos como umbrales adecuados ya demostrados. No elegir nuevos valores con datos de apoyo móvil ni calibrar multiplicando las discrepancias del teléfono. Para decidir cambios se requiere un apoyo rígido reproducible y repetir reposo y ángulos conocidos. No se implementó riesgo global ni se modificó frontend.

La tabla solicitada de referencias externas 0,5° / 1° / 2° / 3° / 5° sigue **sin completar de forma controlada**. Las posiciones de dos ejes comunicadas y el giro grande -44,0° / 40,1° no sustituyen esas cinco referencias.

## Cierre de la captura

En la continuación del intento breve, a las **11:45:14** se observó delta roll **2,3490°**, delta pitch **-1,0894°**, **CRITICO 6/6/6**. Por lo tanto no se declara esa última maniobra una perturbación breve con retorno validado ni se afirma que los contadores quedaron en cero al cierre.

Se cerró la captura tras ofrecer recuperación del apoyo o cierre con limitaciones y sin recibir todavía otra posición física confirmada. Se conservaron log y resúmenes locales. No se ordenó reinicio ni cambio de baseline para borrar el estado observado. El ESP32 sigue ejecutando su firmware; el cierre del lector no modifica la evaluación local. La validación queda **parcial**, con limitaciones físicas documentadas y sin cambios de código, umbrales, red, backend, frontend, base de datos ni riesgo global durante esta evaluación.

## Reapertura para un último intento de retorno

El usuario respondió después que podían recuperar el apoyo sin reiniciar. Se reabrió COM3 sin pulso de reset ni cambio de baseline y se inició captura acotada en `logs/retorno-final-20261103-174713.log`. El usuario comunicó posteriormente teléfono **X=0°**, sin Y final. Esa lectura no coincide con la referencia telefónica X=5,0° / Y=3,9° del baseline vigente.

A las **11:48:17**, el MPU mantenía baseline -2,7654° / 0,2604°, delta roll **3,1068°**, delta pitch **-2,4329°**, **CRITICO 6/6/6**. No se considera retorno recuperado por la sola confirmación verbal o por nivelar X del teléfono a cero. Se explicó la diferencia y se ofreció recuperar la referencia anterior o cerrar ese retorno como no concluyente y, de elegirlo el usuario, establecer un baseline nuevo en la posición actual. **Todavía no se había realizado esa recalibración al registrar esta anotación.**

## Baseline final elegido y cierre operativo

El usuario completó la lectura telefónica **X=0,2° / Y=-0,8°** y eligió adoptar la posición actual como referencia nueva. Tras pedir esperar, volvió a indicar terminar la calibración por batería baja. Se realizó entonces **un único reinicio RTS** para ese baseline, sin cambiar firmware, umbrales ni configuración. El retorno al baseline anterior sigue siendo no concluyente; esta nueva referencia no se usa como prueba de recuperación del cero anterior.

Captura final: `logs/baseline-final-20261103-175459.log`, resumen `logs/baseline-final-20261103-175459-resumen.json`. Serial confirmó MPU6050 en 0x68, calibración 75/75 y **15 lecturas posteriores**, entre **11:56:19 y 11:56:33**. Baseline nuevo: **roll -0,3142° / pitch -1,2777°**. Último estado **NORMAL, 0/0/0**. Últimos deltas: **roll 0,3553° / pitch -0,3035°**.

La primera lectura posterior tuvo delta roll 0,6123°; fue el máximo absoluto de estas quince lecturas y no se descarta del informe. Por ello no se afirma cero absoluto ni estabilidad metrológica. Se cerró la captura automáticamente tras esas quince lecturas para terminar sin más movimientos por la limitación de batería. No se repitieron otros tres minutos de reposo en esta referencia final. El baseline quedó establecido operativamente, pero **la precisión angular, el ruido real en reposo y la adecuación de los tres umbrales no quedaron certificados**. Se mantienen como experimentales, sin cambios, y queda pendiente la tabla controlada de ángulos externos.

COM3 quedó liberado. Al reiniciar de nuevo, el firmware recalculará otra referencia en RAM: para instalación definitiva se requiere mantener el montaje inmóvil durante el arranque y al menos ochenta segundos. No se modificó frontend ni se implementó riesgo global.
