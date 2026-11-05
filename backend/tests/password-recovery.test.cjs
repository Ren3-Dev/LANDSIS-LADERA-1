const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash, randomBytes } = require('node:crypto');
const { createPasswordRecovery } = require('../dist/auth/password-recovery.js');
const { createPasswordResetStore } = require('../dist/data/password-resets.js');
const { verifyPassword } = require('../dist/auth/password.js');

test('Recuperación genera 32 bytes aleatorios y entrega solo SHA-256 a persistencia', async () => {
  const saved = [];
  const recovery = createPasswordRecovery({ issue: async (id, hash) => { saved.push({ id, hash }); return true; } });
  const first = await recovery.issue(7), second = await recovery.issue(7);
  assert.match(first, /^[a-f0-9]{64}$/); assert.notEqual(first, second);
  assert.deepEqual(saved[0], { id: 7, hash: createHash('sha256').update(first).digest('hex') });
  assert.equal(JSON.stringify(saved).includes(first), false);
  for (const id of [0, -1, NaN, 1.5, '7']) await assert.rejects(recovery.issue(id));
  assert.equal(await createPasswordRecovery({ issue: async () => false }).issue(99), null);
});

test('Consumo conserva scrypt y política, valida formato antes de persistir', async () => {
  let calls = 0;
  const password = randomBytes(18).toString('base64url');
  const token = randomBytes(32).toString('hex');
  const recovery = createPasswordRecovery({ consume: async (hash, encoded) => {
    calls++;
    assert.equal(hash, createHash('sha256').update(token).digest('hex'));
    assert.match(encoded, /^scrypt\$/); assert.equal(await verifyPassword(password, encoded), true);
    return true;
  } });
  for (const value of ['', 'abc', 'g'.repeat(64), null, 'a'.repeat(65)]) assert.equal(await recovery.reset(value, password), false);
  for (const value of ['', 'short', ' '.repeat(12), 'a'.repeat(129)]) await assert.rejects(recovery.reset(token, value));
  assert.equal(calls, 0);
  assert.equal(await recovery.reset(token, password), true); assert.equal(calls, 1);
});

test('Errores SQL hacen rollback y liberan conexión; rollback fallido descarta cliente', async () => {
  for (const operation of ['issue', 'consume', 'resetLocal']) {
    for (const rollbackFails of [false, true]) {
      const queries = []; let released;
      const failure = new Error('synthetic persistence failure');
      const store = createPasswordResetStore(() => ({ connect: async () => ({
        query: async sql => {
          queries.push(sql);
          if (sql === 'BEGIN' || sql.startsWith('LOCK TABLE')) return { rows: [] };
          if (sql === 'ROLLBACK') { if (rollbackFails) throw Error('rollback'); return { rows: [] }; }
          throw failure;
        }, release: value => { released = value; },
      }) }));
      await assert.rejects(store[operation](7, 'synthetic-hash'), error => error === failure);
      assert.equal(queries[0], 'BEGIN'); assert.equal(queries.at(-1), 'ROLLBACK');
      assert.equal(queries.includes('COMMIT'), false); assert.equal(released, rollbackFails);
    }
  }
});

test('Fallo de COMMIT intenta rollback y no declara éxito', async () => {
  const queries = []; let released = false;
  const store = createPasswordResetStore(() => ({ connect: async () => ({
    query: async sql => { queries.push(sql); if (sql === 'COMMIT') throw Error('commit failure'); return { rows: [] }; },
    release: () => { released = true; },
  }) }));
  await assert.rejects(store.issue(7, 'synthetic-hash'), /commit failure/);
  assert.deepEqual(queries.slice(-2), ['COMMIT', 'ROLLBACK']); assert.equal(released, true);
});
