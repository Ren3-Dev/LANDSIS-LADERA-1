const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const postgres = require('../dist/data/postgres.js');
const { resetPassword } = require('../dist/auth/reset-password.js');
const { hashPassword, verifyPassword } = require('../dist/auth/password.js');

// Contraseñas aleatorias sintéticas; no se imprimen ni se conecta a PostgreSQL.
test('Reset local de contraseña', async t => {
  const original = postgres.getPool;
  t.after(() => { postgres.getPool = original; });
  const oldPassword = randomBytes(18).toString('base64url');
  const newPassword = randomBytes(18).toString('base64url');
  const oldHash = await hashPassword(oldPassword);
  const user = { email: 'test@example.invalid', role: 'ADMINISTRADOR', name: 'Prueba', active: true, passwordHash: oldHash };
  let calls = 0;
  postgres.getPool = () => ({ query: async (sql, params) => {
    calls++;
    assert.equal(sql, 'UPDATE users SET password_hash=$1 WHERE email=$2');
    assert.equal(params.length, 2);
    if (params[1] !== user.email) return { rowCount: 0 };
    user.passwordHash = params[0]; return { rowCount: 1 };
  } });
  await t.test('usuario existente, email normalizado y otros campos intactos', async () => {
    assert.equal(await resetPassword(' TEST@example.invalid ', newPassword), true);
    assert.equal(user.email, 'test@example.invalid'); assert.equal(user.role, 'ADMINISTRADOR');
    assert.equal(user.name, 'Prueba'); assert.equal(user.active, true);
  });
  await t.test('usuario inexistente no modifica ningún hash', async () => {
    const hash = user.passwordHash;
    assert.equal(await resetPassword('missing@example.invalid', newPassword), false);
    assert.equal(user.passwordHash, hash);
  });
  await t.test('contraseña inválida se rechaza antes de consultar la base', async () => {
    const before = calls;
    for (const password of ['', 'short', ' '.repeat(12), 'a'.repeat(129)]) await assert.rejects(resetPassword(user.email, password));
    assert.equal(calls, before);
  });
  await t.test('hash actualizado con sal nueva y sin contraseña literal', () => {
    assert.notEqual(user.passwordHash, oldHash);
    assert.notEqual(user.passwordHash.split('$')[4], oldHash.split('$')[4]);
    assert.equal(user.passwordHash.includes(newPassword), false);
  });
  await t.test('contraseña antigua deja de validar', async () => {
    assert.equal(await verifyPassword(oldPassword, oldHash), true);
    assert.equal(await verifyPassword(oldPassword, user.passwordHash), false);
  });
  await t.test('nueva contraseña valida', async () => {
    assert.equal(await verifyPassword(newPassword, user.passwordHash), true);
  });
});
