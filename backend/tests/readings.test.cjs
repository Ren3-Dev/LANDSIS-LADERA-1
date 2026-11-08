const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const nullMpu = { accelX: null, accelY: null, accelZ: null, gyroX: null, gyroY: null, gyroZ: null, temperature: null };
const nullMpuRow = { accel_x: null, accel_y: null, accel_z: null, gyro_x: null, gyro_y: null, gyro_z: null, temperature: null };
const { createApp } = require('./authenticated-app.cjs');
// Adaptar los dobles existentes a la conexión transaccional, manteniendo sus casos.
function transactionalPool(query) {
  return { query, connect: async () => ({
    release() {}, query: async (sql, parameters) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('INSERT INTO nodes')) return { rows: [] };
      return query(sql, parameters);
    },
  }) };
}

test('SELECT parametrizado: orden descendente, límite y transformación compartida', async (t) => {
  const postgres = require('../dist/data/postgres.js');
  const { listReadings } = require('../dist/data/readings.js');
  const original = postgres.getPool;
  t.after(() => { postgres.getPool = original; });
  const rows = [2, 1].map((id) => ({
    ...nullMpuRow, id, node_id: 'LADERA-1', soil_moisture_raw: 1837,
    vibration_detected: false, received_at: new Date(`2026-10-0${id}T00:00:00Z`),
  }));
  postgres.getPool = () => ({ query: async (sql, parameters) => {
    assert.match(sql, /ORDER BY received_at DESC, id DESC/);
    assert.match(sql, /LIMIT \$1/);
    assert.deepEqual(parameters, [20]);
    return { rows };
  } });
  assert.deepEqual(await listReadings(20), rows.map((row) => ({
    ...nullMpu, id: row.id, nodeId: row.node_id, soilMoistureRaw: row.soil_moisture_raw,
    vibrationDetected: row.vibration_detected, receivedAt: row.received_at.toISOString(),
  })));
  postgres.getPool = () => ({ query: async () => ({ rows: [] }) });
  assert.deepEqual(await listReadings(50), []);
  postgres.getPool = () => ({ query: async () => { throw new Error('Fallo simulado'); } });
  await assert.rejects(listReadings(50));
});

test('GET de mediciones y última medición', async (t) => {
  const readings = [2, 1].map((id) => ({
    id, nodeId: 'LADERA-1', soilMoistureRaw: 1837, vibrationDetected: false,
    receivedAt: `2026-10-0${id}T00:00:00.000Z`,
  }));
  const limits = [];
  let result = readings;
  let fail = false;
  const app = createApp(undefined, async (limit) => {
    limits.push(limit);
    if (fail) throw new Error('Detalle SQL interno que no debe exponerse');
    return result.slice(0, limit);
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/v1/readings`;

  await t.test('Lista 200, orden más reciente primero y límite 50 por defecto', async () => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { readings });
    assert.equal(limits.at(-1), 50);
  });
  for (const limit of [1, 20, 100]) {
    await t.test(`Acepta limit=${limit}`, async () => {
      const response = await fetch(`${url}?limit=${limit}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { readings: readings.slice(0, limit) });
      assert.equal(limits.at(-1), limit);
    });
  }
  for (const query of ['limit=0', 'limit=101', 'limit=-1', 'limit=1.5', 'limit=texto', 'limit=', 'limit=1&limit=2']) {
    await t.test(`Rechaza ${query} sin acceso a datos`, async () => {
      const before = limits.length;
      const response = await fetch(`${url}?${query}`);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).status, 'error');
      assert.equal(limits.length, before);
    });
  }
  await t.test('latest devuelve 200 y consulta una única medición', async () => {
    const before = Date.now();
    const response = await fetch(`${url}/latest`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const { reading, serverTime } = await response.json();
    assert.deepEqual(reading, readings[0]);
    assert.ok(Number.isSafeInteger(serverTime) && serverTime >= before && serverTime <= Date.now());
    assert.equal(limits.at(-1), 1);
  });
  result = [];
  await t.test('Lista vacía devuelve 200', async () => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { readings: [] });
  });
  await t.test('latest sin mediciones devuelve 404', async () => {
    const response = await fetch(`${url}/latest`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      status: 'error', message: 'No hay mediciones disponibles.',
    });
  });
  fail = true;
  for (const path of ['', '/latest']) {
    await t.test(`Error PostgreSQL en ${path || '/'} devuelve 500 genérico`, async () => {
      const response = await fetch(url + path);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        status: 'error', message: 'No se pudieron consultar las mediciones.',
      });
    });
  }
});

test('Acceso a datos: INSERT parametrizado y valores generados por PostgreSQL', async (t) => {
  const postgres = require('../dist/data/postgres.js');
  const { insertReading } = require('../dist/data/readings.js');
  const original = postgres.getPool;
  t.after(() => { postgres.getPool = original; });
  const reading = {
    nodeId: "LADERA-1'", soilMoistureRaw: 1837, vibrationDetected: false,
  };
  postgres.getPool = () => transactionalPool(async (sql, parameters) => {
      assert.match(sql, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10\)/);
      assert.match(sql, /RETURNING/);
      assert.equal(sql.includes(reading.nodeId), false);
      assert.deepEqual(parameters, [reading.nodeId, 1837, false, null, null, null, null, null, null, null]);
      return { rows: [{
        ...nullMpuRow, id: 7, node_id: reading.nodeId, soil_moisture_raw: 1837,
        vibration_detected: false, received_at: new Date('2026-10-01T00:00:00Z'),
      }] };
    });
  assert.deepEqual(await insertReading(reading), {
    ...reading, ...nullMpu, id: 7, receivedAt: '2026-10-01T00:00:00.000Z',
  });
  postgres.getPool = () => transactionalPool(async () => ({ rows: [] }));
  await assert.rejects(insertReading(reading));
  postgres.getPool = () => transactionalPool(async () => { throw new Error('Fallo simulado'); });
  await assert.rejects(insertReading(reading));
});

test('Contrato HTTP de lecturas y health', async (t) => {
  const saved = [];
  let failPersistence = false;
  const generated = { id: 1, receivedAt: '2026-10-01T00:00:00.000Z' };
  const app = createApp(async (reading) => {
    saved.push(reading);
    if (failPersistence) throw new Error('Detalle interno de persistencia de prueba');
    return { ...reading, ...generated };
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const valid = { nodeId: 'LADERA-1', soilMoistureRaw: 1837, vibrationDetected: false };

  for (const raw of [1837, 0, 4095]) {
    await t.test(`Acepta lectura ADC ${raw}`, async () => {
      const reading = { ...valid, soilMoistureRaw: raw };
      const response = await fetch(`${baseUrl}/api/v1/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reading),
      });
      assert.equal(response.status, 201);
      assert.deepEqual(saved.at(-1), reading);
      assert.equal(saved.length, [1837, 0, 4095].indexOf(raw) + 1);
      assert.deepEqual(await response.json(), {
        status: 'accepted', reading: { ...reading, ...generated },
      });
    });
  }

  const cases = [
    ['ADC menor que cero', { ...valid, soilMoistureRaw: -1 }],
    ['ADC mayor que 4095', { ...valid, soilMoistureRaw: 4096 }],
    ['ADC no entero', { ...valid, soilMoistureRaw: 1837.5 }],
    ['ADC string', { ...valid, soilMoistureRaw: '1837' }],
    ['vibración con tipo incorrecto', { ...valid, vibrationDetected: 'false' }],
    ['nodeId vacío', { ...valid, nodeId: '' }],
    ['nodeId con espacios', { ...valid, nodeId: '   ' }],
    ['nodeId con tipo incorrecto', { ...valid, nodeId: 1 }],
    ['campo adicional', { ...valid, extra: 1 }],
    ['body null', null],
    ['body array', [valid]],
  ];
  for (const field of Object.keys(valid)) {
    const reading = { ...valid };
    delete reading[field];
    cases.push([`campo ausente: ${field}`, reading]);
  }
  for (const [name, reading] of cases) {
    await t.test(name, async () => {
      const response = await fetch(`${baseUrl}/api/v1/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reading),
      });
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.equal(body.status, 'invalid');
      assert.match(body.message, /Medición inválida/);
      assert.equal(saved.length, 3, 'Los datos inválidos no deben persistirse');
    });
  }

  for (const [name, body, contentType] of [
    ['JSON malformado', '{"nodeId":', 'application/json'],
    ['body ausente', undefined, 'application/json'],
    ['tipo de contenido incorrecto', JSON.stringify(valid), 'text/plain'],
  ]) {
    await t.test(name, async () => {
      const response = await fetch(`${baseUrl}/api/v1/readings`, {
        method: 'POST', headers: { 'Content-Type': contentType }, body,
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).status, 'invalid');
      assert.equal(saved.length, 3, 'El body inválido no debe persistirse');
    });
  }

  await t.test('Error de persistencia devuelve 500 sin detalles internos', async () => {
    failPersistence = true;
    const response = await fetch(`${baseUrl}/api/v1/readings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valid),
    });
    assert.equal(response.status, 500);
    assert.equal(saved.length, 4);
    assert.deepEqual(await response.json(), {
      status: 'error', message: 'No se pudo almacenar la medición.',
    });
  });

  await t.test('GET /health continúa funcionando incluso si falla persistencia', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok', service: 'LANDSIS LADERA-1 API',
    });
  });
});

test('Incremento 5: multisensor, validación y consultas compatibles', async (t) => {
  const { isReading } = require('../dist/readings/reading.js');
  const postgres = require('../dist/data/postgres.js');
  const { insertReading, listReadings } = require('../dist/data/readings.js');
  const original = postgres.getPool;
  t.after(() => { postgres.getPool = original; });
  const legacy = { nodeId: 'LADERA-1', soilMoistureRaw: 4095, vibrationDetected: false };
  const mpu = { accelX: 10.082, accelY: 0.603, accelZ: 10.245, gyroX: -0.058, gyroY: -0.006, gyroZ: -0.005, temperature: 25.49 };
  const fields = Object.keys(mpu);
  const sqlFields = ['accel_x', 'accel_y', 'accel_z', 'gyro_x', 'gyro_y', 'gyro_z', 'temperature'];
  let row = { id: 9, node_id: legacy.nodeId, soil_moisture_raw: 4095, vibration_detected: false, received_at: new Date('2026-10-04T00:00:00Z'), ...nullMpuRow };
  let calls = 0;
  postgres.getPool = () => transactionalPool(async (sql, parameters) => {
    calls++;
    for (const field of sqlFields) assert.ok(sql.includes(field));
    if (sql.startsWith('INSERT')) {
      assert.match(sql, /\$10/);
      assert.deepEqual(parameters, [legacy.nodeId, 4095, false, ...sqlFields.map((field) => row[field])]);
      assert.match(sql, /RETURNING id/);
    }
    return { rows: [row] };
  });
  const app = createApp(insertReading, listReadings);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/v1/readings`;
  const post = (body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const expected = (values) => ({ ...legacy, ...values, id: 9, receivedAt: row.received_at.toISOString() });
  for (const [name, values] of [['legacy NULL', nullMpu], ['multisensor decimal y giros negativos', mpu], ['multisensor cero válido', Object.fromEntries(fields.map((f) => [f, 0]))]]) {
    row = { ...row, ...Object.fromEntries(sqlFields.map((f, i) => [f, values[fields[i]]])) };
    await t.test(`POST ${name}: INSERT y respuesta`, async () => {
      const response = await post(values === nullMpu ? legacy : { ...legacy, ...values });
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { status: 'accepted', reading: expected(values) });
    });
    for (const path of ['', '/latest']) {
      await t.test(`GET ${path || 'historial'} ${name}`, async () => {
        const response = await fetch(url + path);
        assert.equal(response.status, 200);
        const data = await response.json();
        if (path) {
          assert.deepEqual(data.reading, expected(values));
          assert.ok(Number.isSafeInteger(data.serverTime));
        } else {
          assert.deepEqual(data, { readings: [expected(values)] });
        }
      });
    }
  }
  const invalid = [];
  for (const field of fields) {
    const body = { ...legacy, ...mpu }; delete body[field];
    invalid.push([`falta ${field}`, body]);
    for (const value of ['1', null, [], {}, true]) invalid.push([`${field} tipo ${JSON.stringify(value)}`, { ...legacy, ...mpu, [field]: value }]);
  }
  for (let count = 1; count <= 6; count++) invalid.push([`bloque parcial de ${count}`, { ...legacy, ...Object.fromEntries(fields.slice(0, count).map((f) => [f, mpu[f]])) }]);
  invalid.push(['desconocido multisensor', { ...legacy, ...mpu, extra: 1 }]);
  for (const [name, body] of invalid) {
    await t.test(`Rechaza ${name}`, async () => {
      const before = calls;
      assert.equal((await post(body)).status, 400);
      assert.equal(calls, before, 'No persiste entradas inválidas');
    });
  }
  for (const field of fields) for (const value of [NaN, Infinity, -Infinity, undefined]) {
    await t.test(`${field} no finito/undefined a nivel de función`, () => {
      assert.equal(isReading({ ...legacy, ...mpu, [field]: value }), false);
    });
  }
});
