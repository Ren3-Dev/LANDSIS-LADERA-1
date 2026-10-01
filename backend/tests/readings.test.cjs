const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const app = require('../dist/app.js').default;

test('Contrato HTTP de lecturas y health', async (t) => {
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
      assert.deepEqual(await response.json(), { status: 'accepted', reading });
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
    });
  }

  await t.test('GET /health continúa funcionando', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok', service: 'LANDSIS LADERA-1 API',
    });
  });
});
