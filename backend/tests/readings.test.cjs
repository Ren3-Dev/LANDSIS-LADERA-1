const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { createApp } = require('../dist/app.js');

test('Acceso a datos: INSERT parametrizado y valores generados por PostgreSQL', async (t) => {
  const postgres = require('../dist/data/postgres.js');
  const { insertReading } = require('../dist/data/readings.js');
  const original = postgres.getPool;
  t.after(() => { postgres.getPool = original; });
  const reading = {
    nodeId: "LADERA-1'", soilMoistureRaw: 1837, vibrationDetected: false,
  };
  postgres.getPool = () => ({
    query: async (sql, parameters) => {
      assert.match(sql, /VALUES \(\$1, \$2, \$3\)/);
      assert.match(sql, /RETURNING/);
      assert.equal(sql.includes(reading.nodeId), false);
      assert.deepEqual(parameters, [reading.nodeId, 1837, false]);
      return { rows: [{
        id: 7, node_id: reading.nodeId, soil_moisture_raw: 1837,
        vibration_detected: false, received_at: new Date('2026-10-01T00:00:00Z'),
      }] };
    },
  });
  assert.deepEqual(await insertReading(reading), {
    ...reading, id: 7, receivedAt: '2026-10-01T00:00:00.000Z',
  });
  postgres.getPool = () => ({ query: async () => ({ rows: [] }) });
  await assert.rejects(insertReading(reading));
  postgres.getPool = () => ({ query: async () => { throw new Error('Fallo simulado'); } });
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
