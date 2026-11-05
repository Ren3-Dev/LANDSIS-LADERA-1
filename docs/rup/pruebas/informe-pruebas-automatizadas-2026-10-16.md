# Informe técnico de pruebas automatizadas

## 1. Identificación y alcance

| Campo | Valor |
|---|---|
| Proyecto | LANDSIS LADERA-1 |
| Disciplina | Implementación y Pruebas — RUP |
| Fecha de ejecución | 16 de octubre de 2026 |
| Zona horaria | America/Guatemala, UTC−06:00 |
| Rama evaluada | `main` |
| Commit evaluado | `cfabf5256274b928b8d6836eaad5eb191b71fd7d` |
| Estado Git inicial y posterior a las pruebas | Árbol de trabajo limpio |
| Resultado final backend | 191 de 191 pruebas aprobadas |
| Resultado final frontend | 12 de 12 pruebas aprobadas |

Este informe documenta la ejecución observada y comunicada previamente en la conversación del proyecto. Su elaboración no incluye nuevas ejecuciones de pruebas. Los identificadores RF-01 a RF-12 son provisionales; no se presentan como requisitos oficialmente aprobados.

La ejecución estuvo limitada a pruebas automatizadas locales previamente inspeccionadas. No se realizaron operaciones sobre PostgreSQL real, modificaciones de usuarios reales, migraciones, pruebas físicas, programación del ESP32, cambios de código, commits ni push.

## 2. Entorno y comandos

| Elemento | Versión o característica |
|---|---|
| Sistema y shell observados | Windows y PowerShell |
| Node.js | `v24.21.0` |
| npm | `11.19.0` |
| Backend | Compilación TypeScript y runner `node:test` |
| Frontend | Runner `node:test`, cargador `tsx` existente y renderizado estático React |
| Persistencia de pruebas | Dobles y datos sintéticos en memoria |
| HTTP de backend | Servidores temporales en `127.0.0.1`, con puertos asignados dinámicamente |

Desde `backend/` se ejecutó dos veces:

```powershell
npm.cmd test
```

El script del proyecto ejecuta:

```text
npm run build && node --test tests/*.test.cjs
```

El build ejecuta `tsc`. Desde `frontend/` se ejecutó una vez:

```powershell
npm.cmd test
```

El script del frontend ejecuta:

```text
node --import ../backend/node_modules/tsx/dist/loader.mjs --test tests/*.test.tsx
```

No se ejecutó build del frontend porque su script de pruebas no lo requiere. No se instalaron ni actualizaron dependencias. También se consultaron fecha/hora, versiones, rama, hash, estado Git y artefactos de compilación.

## 3. Resultados observados

| Ejecución | Horario local observado | Total reportado | Aprobadas | Fallidas | Omitidas | Canceladas | Duración del runner |
|---|---|---:|---:|---:|---:|---:|---:|
| Backend, primer intento en aislamiento | 13:13:47–13:13:59 | 191 | 45 | 146 | 0 | 0 | 4.361,9231 ms |
| Backend, reejecución fuera del aislamiento | 13:14:18–13:14:31 | 191 | 191 | 0 | 0 | 0 | 9.066,1795 ms |
| Frontend | 13:14:01–13:14:04 | 12 | 12 | 0 | 0 | 0 | 1.191,3216 ms |

La ejecución completa final del backend, incluidos npm y compilación, duró aproximadamente 12,41 segundos; la del frontend, aproximadamente 3,76 segundos. Estos tiempos corresponden a las marcas observadas del comando, mientras que la última columna contiene el tiempo informado por el runner. No son mediciones de rendimiento del sistema desplegado.

### 3.1. Incidencia del primer intento

El backend compiló, pero las solicitudes a los servidores temporales locales fallaron con el siguiente patrón observado:

```text
TypeError: fetch failed
cause: connect EACCES 127.0.0.1:<puerto temporal>
```

El marcador `<puerto temporal>` resume los puertos dinámicos; no es una transcripción literal de una línea completa del runner. El primer comando terminó con código de salida 1. Node informó 45 aprobadas y 146 fallidas, incluyendo grupos padre afectados por subpruebas fallidas.

La restricción de conexión del entorno aislado impidió evaluar los resultados HTTP esperados. Estos fallos no se documentan como 146 defectos independientes del producto.

### 3.2. Reejecución

Se repitió el mismo comando del backend fuera del aislamiento mediante el permiso de ejecución correspondiente. No se modificaron código ni configuraciones entre ambos intentos. La reejecución compiló y aprobó las 191 pruebas, con código de salida 0.

El resultado respalda la clasificación de la incidencia inicial como asociada al entorno de ejecución. No se aplicó una corrección de software.

### 3.3. Resúmenes del runner

Backend final:

```text
tests 191
pass 191
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 9066.1795
```

Frontend:

```text
tests 12
pass 12
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 1191.3216
```

El conteo de Node incluye grupos padre y subpruebas. No equivale a 191 requisitos ni necesariamente a 191 escenarios independientes del backend.

## 4. Naturaleza de las pruebas y archivos asociados

Las rutas de esta sección son relativas a la raíz del repositorio.

| Referencia | Archivo | Grupos y alcance |
|---|---|---|
| B1 | `backend/tests/readings.test.cjs` | Recepción HTTP; ADC y tipos; JSON; historial y última lectura; errores; contrato MPU; SQL y transformación de resultados con persistencia simulada |
| B2 | `backend/tests/nodes.test.cjs` | Catálogo; filtros por nodo y fechas; límites; calendario y zona; SQL parametrizado; transacciones de nodo y medición con dobles |
| B3 | `backend/tests/auth.test.cjs` | Hash y política de contraseñas; sesiones; autenticación y roles por HTTP local; usuarios sintéticos; controles de mutación y límites de login |
| B4 | `backend/tests/users-store.test.cjs` | Persistencia de usuarios simulada; conflictos; protección del último administrador; bootstrap y transacciones simuladas |
| B5 | `backend/tests/reset-password.test.cjs` | Restablecimiento con datos sintéticos; validación; sal y hash; usuario inexistente; preservación de otros campos |
| F1 | `frontend/tests/auth.test.tsx` | Markup del login; estado inicial; navegación por rol; cliente HTTP con mocks; error de credenciales y aviso de sesión vencida |
| F2 | `frontend/tests/telemetry.test.tsx` | Dashboard; RAW y vibración; MPU completo/null; vacíos; historial y gráfico; filtros con mocks; navegación activa |

El auxiliar `backend/tests/authenticated-app.cjs` sustituye la autenticación en las pruebas de telemetría. La autenticación real de la aplicación se evalúa separadamente en B3, con un almacén de usuarios simulado.

Las pruebas HTTP del backend sí realizan solicitudes reales contra una instancia temporal local de Express, pero no integran PostgreSQL real. Las pruebas de SQL comprueban construcción de consultas, parámetros y secuencias transaccionales mediante dobles; no demuestran la ejecución de esas consultas por el motor PostgreSQL.

Las pruebas frontend utilizan `renderToStaticMarkup` y sustituciones de `fetch`. No son pruebas E2E de navegador ni integración real frontend–backend–base de datos.

## 5. Casos de prueba RUP propuestos

Los identificadores CP-001 a CP-017 son propuestas documentales para agrupar escenarios existentes; no son identificadores previos del código ni casos de uso aprobados. Las referencias B1–F2 remiten a los archivos de la sección 4. El estado «Aprobado» se limita al alcance automatizado descrito y, para HTTP de backend, a la reejecución final.

| ID propuesto | Requisito provisional | Descripción | Datos de entrada | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|---|---|---|
| CP-001 | RF-01, RF-02, RF-04 | Recepción básica | Nodo sintético, ADC 1837/0/4095 y vibración booleana | HTTP 201 y entrega al guardado simulado | Coincidente con lo esperado | Aprobado | B1 |
| CP-002 | RF-01, RF-02, RF-04 | Rechazo de mediciones inválidas | ADC fuera de rango, tipos erróneos, campos ausentes/adicionales y JSON inválido | HTTP 400 sin persistir entradas inválidas | Coincidente con lo esperado | Aprobado | B1 |
| CP-003 | RF-03, RF-04, RF-05 | Compatibilidad MPU | Bloque ausente, completo decimal y completo con ceros | Aceptación y transformación correcta | Coincidente con lo esperado | Aprobado | B1 |
| CP-004 | RF-03 | Rechazo de MPU inválido | Bloques parciales, tipos erróneos, NaN e infinitos a nivel de función | Rechazo de datos inválidos | Coincidente con lo esperado | Aprobado | B1 |
| CP-005 | RF-05 | Persistencia parametrizada | Identificador con comilla y valores sintéticos | SQL con parámetros y transformación correcta | Coincidente con lo esperado | Aprobado | B1, B2 |
| CP-006 | RF-05, RF-12 | Transacción nodo/lectura | Inserción simulada exitosa y fallida | COMMIT/ROLLBACK y liberación de conexión | Coincidente con lo esperado | Aprobado | B2 |
| CP-007 | RF-06 | Historial y última lectura | Listas sintéticas, vacíos y errores simulados | HTTP 200, 404 o 500 según escenario | Coincidente con lo esperado | Aprobado | B1 |
| CP-008 | RF-07 | Filtros y fechas | Nodo, límites, fechas válidas/incorrectas y parámetros repetidos | Filtros correctos o HTTP 400 | Coincidente con lo esperado | Aprobado | B2 |
| CP-009 | RF-12 | Catálogo | Catálogo vacío, múltiple y error simulado | Listado correcto o error genérico | Coincidente con lo esperado | Aprobado | B2 |
| CP-010 | RF-10 | Hash y sesiones | Contraseñas sintéticas y reloj controlado | Sal distinta, verificación, expiración y revocación | Coincidente con lo esperado | Aprobado | B3 |
| CP-011 | RF-10 | Login y controles HTTP | Usuarios válidos, inexistentes/inactivos, contraseña incorrecta y peticiones inválidas | Cookie, códigos y restricciones esperadas | Coincidente con lo esperado | Aprobado | B3 |
| CP-012 | RF-10 | Roles | Administrador, investigador y CONRED sintéticos | Consulta permitida y administración restringida | Coincidente con lo esperado | Aprobado | B3 |
| CP-013 | RF-10 | Usuarios y bootstrap | Alta, duplicado, edición, último administrador y errores simulados | Salida pública, conflictos y transacciones correctas | Coincidente con lo esperado | Aprobado | B3, B4 |
| CP-014 | RF-10 | Restablecimiento local | Usuario sintético existente/inexistente y contraseñas válidas/inválidas | Nuevo hash, rechazo correcto y otros campos intactos | Coincidente con lo esperado | Aprobado | B5 |
| CP-015 | RF-09, RF-10 | Login, navegación y sesión frontend | Roles, respuestas mock 200/401 y logout 204 | Markup, cabeceras y notificaciones correctas | Coincidente con lo esperado | Aprobado | F1, F2 |
| CP-016 | RF-01, RF-02, RF-03, RF-09 | Presentación de sensores y vacíos | RAW, vibración, MPU completo/null y ausencia de datos | Representación fiel sin conversiones ni diagnóstico inventado | Coincidente con lo esperado | Aprobado | F2 |
| CP-017 | RF-06, RF-07, RF-09 | Historial y cliente | Lecturas sintéticas, fechas/límite, 404 y MPU parcial | Tabla/gráfico, query correcta y rechazo de respuesta inválida | Coincidente con lo esperado | Aprobado | F2 |

## 6. Alcance por requisito y validaciones pendientes

| Requisito provisional | Aspecto comprobado por estas pruebas | Pendiente o no verificado por esta ejecución |
|---|---|---|
| RF-01 — Humedad | Validación y presentación de RAW | Captura física, calibración, precisión y sensor desconectado |
| RF-02 — Vibración | Contrato booleano y representación | Detección física, pulsos y conservación del evento en firmware |
| RF-03 — MPU6050 | Contrato de siete campos y representación | Integración física actual, lectura, unidades verificadas y desconexión |
| RF-04 — WiFi/HTTP | Recepción HTTP local en backend | WiFi, ESP32, recuperación y transmisión física |
| RF-05 — PostgreSQL | Código de persistencia con dobles | Migraciones, restricciones y persistencia en motor real |
| RF-06 — Historial | Consultas HTTP locales y cliente mock | Recorrido integral contra PostgreSQL |
| RF-07 — Filtros | Validación, parámetros SQL y cliente mock | Comportamiento integral con datos reales |
| RF-08 — Riesgo | Sin evaluación de umbrales comprobada | Criterios aprobados e implementación/validación del evaluador |
| RF-09 — Dashboard | Renderizado estático y cliente | Navegador interactivo, responsividad actual y recorrido E2E |
| RF-10 — Autenticación y roles | Seguridad y HTTP local con usuarios simulados; presentación | Usuarios/base reales, despliegue, cookies en navegador y flujo integral |
| RF-11 — Alertas | Sin pruebas de generación de alertas | Definición, implementación y validación del ciclo de alertas |
| RF-12 — Nodos/configuraciones | Catálogo y registro automático simulado | Administración completa y configuración de nodos |

La comprobación del texto «riesgo pendiente» no prueba evaluación de riesgo. Tampoco se comprobaron estabilidad prolongada, carga, consumo energético ni comportamiento físico ante reinicios. Los resultados no permiten declarar integración física actual del MPU6050 ni valores definitivos de calibración o riesgo.

## 7. Éxito de ejecución y cobertura

La tasa de éxito se calcula como pruebas aprobadas divididas entre el total informado por el runner, multiplicado por 100:

- Backend final: `191 / 191 × 100 = 100 %`.
- Frontend: `12 / 12 × 100 = 100 %`.

Estos porcentajes describen únicamente el éxito de las suites ejecutadas en sus condiciones finales. El primer intento fallido permanece registrado y no se elimina de la evidencia histórica.

No se calculó cobertura porcentual de requisitos, líneas, ramas ni funciones. No se dispone en esta ejecución de una metodología de cobertura de requisitos aprobados ni de un reporte de instrumentación. El éxito del 100 % de las pruebas existentes no significa 100 % de funcionalidades implementadas, ausencia de defectos ni aprobación completa de RF-01 a RF-12.

## 8. Evidencia disponible y gestión de artefactos

Los resultados se documentaron a partir de la ejecución observada, las salidas mostradas por las herramientas y el resumen presentado en la conversación. No se dispone para este informe de un archivo identificado con el log íntegro del runner; el log íntegro debe conservarse en una futura ejecución autorizada. Los bloques de la sección 3 son resúmenes, no sustitutos de ese log.

No se adjuntan ni se afirman capturas, registros físicos, resultados SQL o archivos de evidencia no disponibles. Los archivos de prueba y scripts del commit evaluado permiten localizar los escenarios y reproducir los comandos bajo condiciones compatibles.

La compilación regeneró 20 archivos `.js` dentro de `backend/dist/`, ignorados por Git. La compilación de los comandos administrativos no los ejecutó. Los artefactos encontrados en `frontend/dist/` eran anteriores, del 8 de octubre, y no se regeneraron. No se limpiaron ni eliminaron archivos.

La comprobación posterior a las pruebas informó:

```text
On branch main
nothing to commit, working tree clean
```

Ese estado corresponde al cierre de la ejecución de pruebas, antes de crear este informe documental.

## 9. Conclusiones y recomendaciones

Las suites locales existentes aprobaron 191/191 pruebas de backend y 12/12 de frontend en la ejecución final. El backend compiló correctamente. La incidencia inicial EACCES fue superada al repetir la suite fuera del aislamiento, sin cambios de código. Esta evidencia respalda el comportamiento automatizado descrito, pero no valida el sistema físico ni la integración con PostgreSQL real.

Se recomienda:

1. Revisar y aprobar los identificadores CP propuestos para incorporarlos al Plan de Pruebas RUP.
2. Conservar en una futura ejecución autorizada la salida íntegra del runner, versión, fecha, entorno y códigos de salida, evitando secretos.
3. Preparar, con autorización independiente, pruebas de integración en una base PostgreSQL exclusiva de pruebas.
4. Verificar el recorrido completo en navegador con cuentas y datos de prueba, incluyendo permisos y sesión.
5. Planificar pruebas físicas de sensores y recuperación de comunicación con procedimientos y autorización propios.
6. Mantener separados los resultados de telemetría de la futura evaluación de riesgo y alertas; no establecer umbrales sin aprobación y evidencia.

LANDSIS LADERA-1 se considera en este informe un prototipo académico de apoyo al monitoreo preventivo. Estos resultados no constituyen certificación de predicción de deslizamientos.
