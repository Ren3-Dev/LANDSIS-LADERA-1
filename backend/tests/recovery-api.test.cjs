const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app.js');
const { createSecurity } = require('../dist/auth/security.js');
const { createMailService } = require('../dist/mail/service.js');
const { loadRecoveryConfig } = require('../dist/config/recovery.js');
const { RecoveryLimit, RecoveryQueue } = require('../dist/auth/recovery-limits.js');

const token = randomBytes(32).toString('hex');
const password = randomBytes(18).toString('base64url');
const user = { id: 1, name: '<Prueba>', email: 'user@example.invalid', active: true };
const generic = { message: 'Si la cuenta puede recuperarse, recibirás un correo con instrucciones.' };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function waitFor(check) {
  const deadline = Date.now() + 3000;
  while (!check()) { if (Date.now() > deadline) throw Error('Trabajo simulado no terminó.'); await tick(); }
}
async function fixture(t, overrides = {}) {
  const sent = [], lookedUp = [], issued = [], reset = [], failures = [];
  const store = { findByEmail: async email => { lookedUp.push(email); return user; } };
  const options = {
    users: store, frontendUrl: 'https://frontend.example.invalid/landsis/',
    recovery: { issue: async id => { issued.push(id); return token; }, reset: async (...args) => { reset.push(args); return true; } },
    mail: createMailService({ sendMail: async message => { sent.push(message); } }, 'landsis@example.invalid'),
    onFailure: () => failures.push(true), ...overrides,
  };
  const server = createApp(undefined, undefined, undefined, createSecurity(undefined, undefined, options)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
  const request = (route, body, extraHeaders = {}) => fetch(base + '/' + route, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Landsis-Request': '1', ...extraHeaders }, body: JSON.stringify(body) });
  return { request, base, sent, lookedUp, issued, reset, failures };
}

test('Config FRONTEND_URL: explícita, segura, sin secretos ni origen derivado de HTTP', () => {
  assert.deepEqual(loadRecoveryConfig({}), { emailEnabled: false });
  assert.deepEqual(loadRecoveryConfig({ RECOVERY_EMAIL_ENABLED: 'true', FRONTEND_URL: 'https://example.invalid/app' }),
    { emailEnabled: true, frontendUrl: 'https://example.invalid/app/' });
  assert.ok(loadRecoveryConfig({ RECOVERY_EMAIL_ENABLED: 'true', FRONTEND_URL: 'http://localhost:5173' }).frontendUrl);
  for (const value of ['', 'javascript:alert(1)', 'http://remote.invalid', 'https://user:secret@example.invalid', 'https://example.invalid/?a=b', 'https://example.invalid/#token']) {
    assert.throws(() => loadRecoveryConfig({ RECOVERY_EMAIL_ENABLED: 'true', FRONTEND_URL: value }), error => {
      assert.equal(error.message, 'FRONTEND_URL inválida para recuperación.'); return true;
    });
  }
  assert.throws(() => loadRecoveryConfig({ RECOVERY_EMAIL_ENABLED: 'true', NODE_ENV: 'production', FRONTEND_URL: 'http://localhost:5173' }));
  assert.throws(() => loadRecoveryConfig({ RECOVERY_EMAIL_ENABLED: 'yes' }));
});

test('Solicitud válida: normaliza, prepara enlace configurado y envía solo recuperación', async t => {
  const f = await fixture(t);
  const response = await f.request('forgot-password', { email: ' USER@Example.invalid ' }, { Host: 'attacker.invalid', 'X-Forwarded-Host': 'attacker.invalid' });
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), generic);
  assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('set-cookie'), null);
  await waitFor(() => f.sent.length === 1);
  assert.deepEqual(f.lookedUp, ['user@example.invalid']); assert.deepEqual(f.issued, [1]);
  assert.match(f.sent[0].html, /https:\/\/frontend.example.invalid\/landsis\/reset-password#token=/);
  assert.ok(f.sent[0].text.includes(token)); assert.equal(f.sent[0].to, user.email);
  assert.doesNotMatch(f.sent[0].html, /attacker.invalid|<Prueba>/);
});

test('Cuenta inexistente e inactiva conservan respuesta y no generan ni envían tokens', async t => {
  for (const result of [null, { ...user, active: false }]) {
    let lookup = false;
    const f = await fixture(t, { users: { findByEmail: async () => { lookup = true; return result; } } });
    const response = await f.request('forgot-password', { email: user.email });
    assert.equal(response.status, 202); assert.deepEqual(await response.json(), generic);
    await waitFor(() => lookup); await tick();
    assert.deepEqual(f.sent, []); assert.deepEqual(f.issued, []);
  }
});

test('Respuesta no espera consultas ni SMTP; fallos no filtran datos ni producen logs', async t => {
  const output = [];
  for (const name of ['log', 'warn', 'error', 'info', 'debug']) {
    const original = console[name]; console[name] = (...args) => output.push(args);
    t.after(() => { console[name] = original; });
  }
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { users: { findByEmail: async () => { await gate; return user; } },
    mail: createMailService({ sendMail: async () => { throw Error('SMTP secret token=' + token); } }, 'landsis@example.invalid') });
  const response = await f.request('forgot-password', { email: user.email });
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), generic);
  assert.equal(f.issued.length, 0); release(); await waitFor(() => f.failures.length === 1);
  assert.deepEqual(output, []);
});

test('Fallos de persistencia y emisión mantienen respuesta genérica', async t => {
  for (const patch of [
    { users: { findByEmail: async () => { throw Error('SQL detail'); } } },
    { recovery: { issue: async () => { throw Error('SQL detail'); } } },
  ]) {
    const f = await fixture(t, patch);
    const response = await f.request('forgot-password', { email: user.email });
    assert.equal(response.status, 202); assert.deepEqual(await response.json(), generic);
    await waitFor(() => f.failures.length === 1); assert.deepEqual(f.sent, []);
  }
});

test('Validaciones forgot-password: esquema estricto y sin consultas', async t => {
  for (const body of [null, [], {}, { email: 'invalid' }, { email: user.email, extra: true }, { email: 5 }, { email: 'a'.repeat(255) + '@example.invalid' }]) {
    const f = await fixture(t);
    assert.equal((await f.request('forgot-password', body)).status, 400); assert.deepEqual(f.lookedUp, []);
  }
});

test('Mutaciones requieren cabecera/JSON; errores de parser y cuerpos grandes son sanitizados', async t => {
  const f = await fixture(t);
  for (const route of ['forgot-password', 'reset-password']) {
    assert.equal((await f.request(route, {}, { 'X-Landsis-Request': '' })).status, 403);
    assert.equal((await f.request(route, {}, { 'Content-Type': 'text/plain' })).status, 415);
    const bad = await fetch(f.base + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Landsis-Request': '1' }, body: '{' });
    assert.equal(bad.status, 400); assert.doesNotMatch(await bad.text(), /SyntaxError|stack/);
    assert.equal((await f.request(route, { email: 'a'.repeat(9000) })).status, 413);
  }
  assert.deepEqual(f.lookedUp, []);
});

test('Límite por cuenta normalizada es silencioso para existentes e inexistentes', async t => {
  let now = 0;
  const f = await fixture(t, { now: () => now });
  for (let i = 0; i < 4; i++) {
    const response = await f.request('forgot-password', { email: i % 2 ? ' USER@example.invalid ' : user.email });
    assert.equal(response.status, 202); assert.deepEqual(await response.json(), generic);
  }
  await waitFor(() => f.sent.length === 3); await tick(); assert.equal(f.lookedUp.length, 3);
  now = 15 * 60 * 1000;
  assert.equal((await f.request('forgot-password', { email: user.email })).status, 202);
  await waitFor(() => f.sent.length === 4);
});

test('Límite IP independiente de cuenta con IP enviada por proxy loopback', async t => {
  const f = await fixture(t, { users: { findByEmail: async () => null } });
  for (let i = 0; i < 5; i++) assert.equal((await f.request('forgot-password', { email: `missing${i}@example.invalid` }, { 'X-Forwarded-For': '192.0.2.9' })).status, 202);
  const response = await f.request('forgot-password', { email: user.email }, { 'X-Forwarded-For': '192.0.2.9' });
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '900');
  assert.equal((await f.request('forgot-password', { email: user.email }, { 'X-Forwarded-For': '192.0.2.10' })).status, 202);
});

test('Limitador acota memoria y recupera capacidad al vencer ventana', () => {
  let now = 0; const limiter = new RecoveryLimit(3, () => now);
  for (let i = 0; i < 1000; i++) assert.equal(limiter.take(String(i)), true);
  assert.equal(limiter.take('overflow'), false);
  now = 900000; assert.equal(limiter.take('overflow'), true);
});

test('Cola limita concurrencia a dos y capacidad a veinte, también ante errores', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  let running = 0, peak = 0, started = 0, failures = 0;
  const queue = new RecoveryQueue(() => { failures++; });
  for (let i = 0; i < 25; i++) queue.enqueue(async () => {
    running++; started++; peak = Math.max(peak, running); await gate; running--; throw Error('synthetic');
  });
  await waitFor(() => started === 2); assert.equal(peak, 2);
  release(); await waitFor(() => failures === 20); assert.equal(started, 20); assert.equal(peak, 2);
});

test('Reset exitoso delega transacción y no inicia sesión ni envía confirmación', async t => {
  const f = await fixture(t);
  const response = await f.request('reset-password', { token, password });
  assert.equal(response.status, 200); assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await response.text(), new RegExp(token + '|' + password));
  assert.deepEqual(f.reset, [[token, password]]); assert.deepEqual(f.sent, []);
});

test('Token expirado, reutilizado o manipulado produce mismo error público', async t => {
  const f = await fixture(t, { recovery: { reset: async () => false } });
  const bodies = [];
  for (let i = 0; i < 3; i++) {
    const response = await f.request('reset-password', { token: randomBytes(32).toString('hex'), password });
    assert.equal(response.status, 400); bodies.push(await response.json());
  }
  assert.deepEqual(bodies[0], bodies[1]); assert.deepEqual(bodies[1], bodies[2]);
});

test('Validaciones reset-password: no procesa contraseña/token inválidos ni campos extra', async t => {
  for (const body of [null, [], {}, { token, password: 'short' }, { token: 'invalid', password },
    { token, password, email: user.email }, { token, password: ' '.repeat(12) }, { token, password: 'a'.repeat(129) }]) {
    const f = await fixture(t); assert.equal((await f.request('reset-password', body)).status, 400); assert.deepEqual(f.reset, []);
  }
});

test('Fallo de reset devuelve 503 sin error SQL ni datos sensibles', async t => {
  const f = await fixture(t, { recovery: { reset: async () => { throw Error('SQL secret ' + password); } } });
  const response = await f.request('reset-password', { token, password });
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /SQL|secret|stack/);
});

test('Reset limita por token y por IP antes de trabajo costoso', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.request('reset-password', { token, password })).status, 200);
  assert.equal((await f.request('reset-password', { token, password })).status, 429);
  for (let i = 0; i < 4; i++) assert.equal((await f.request('reset-password', { token: randomBytes(32).toString('hex'), password })).status, 200);
  assert.equal((await f.request('reset-password', { token: randomBytes(32).toString('hex'), password })).status, 429);
  assert.equal(f.reset.length, 9);
});

test('Reset limita dos operaciones simultáneas y libera capacidad al fallar', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; }); let started = 0;
  const f = await fixture(t, { recovery: { reset: async () => { started++; await gate; throw Error('synthetic'); } } });
  const first = f.request('reset-password', { token, password }), second = f.request('reset-password', { token, password });
  try {
    await waitFor(() => started === 2);
    assert.equal((await f.request('reset-password', { token, password })).status, 429);
  } finally { release(); }
  assert.equal((await first).status, 503); assert.equal((await second).status, 503);
  assert.equal((await f.request('reset-password', { token, password })).status, 503); assert.equal(started, 3);
});

test('Correo deshabilitado conserva API genérica sin consulta ni configuración SMTP', async t => {
  const f = await fixture(t, { mail: undefined, frontendUrl: undefined });
  const response = await f.request('forgot-password', { email: user.email });
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), generic);
  await tick(); assert.deepEqual(f.lookedUp, []); assert.deepEqual(f.sent, []);
});
