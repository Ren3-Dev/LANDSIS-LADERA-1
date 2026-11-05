const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes, createHash } = require('node:crypto');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, readFileSync } = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { Pool } = require('pg');
const { createPasswordResetStore } = require('../dist/data/password-resets.js');
const { createPasswordRecovery } = require('../dist/auth/password-recovery.js');
const { resetPassword } = require('../dist/auth/reset-password.js');
const { hashPassword, verifyPassword } = require('../dist/auth/password.js');
const { createSecurity } = require('../dist/auth/security.js');
const { createApp } = require('../dist/app.js');
const { createMailService } = require('../dist/mail/service.js');
const postgres = require('../dist/data/postgres.js');

// Jamás cargar dotenv ni reutilizar PGHOST/PGDATABASE/credenciales principales.
// Crea un CLUSTER efímero propio, con archivos/log ignorados por Git.
const bin = process.env.LANDSIS_TEST_PG_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';
const suffix = process.platform === 'win32' ? '.exe' : '';
const executable = name => path.join(bin, name + suffix);
const available = ['initdb', 'pg_ctl'].every(name => existsSync(executable(name)));
const digest = token => createHash('sha256').update(token).digest('hex');
const password = () => randomBytes(18).toString('base64url');

test('PostgreSQL aislado: migración, concurrencia y autenticación', { skip: available ? false : 'Configura LANDSIS_TEST_PG_BIN con initdb/pg_ctl para probar concurrencia real.', timeout: 120000 }, async t => {
  const root = path.resolve(__dirname, '../tmp'); mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(path.join(root, 'recovery-pg-'));
  const data = path.join(directory, 'data');
  const run = (name, args) => {
    const result = spawnSync(executable(name), args, { windowsHide: true, encoding: 'utf8', timeout: 30000 });
    // No volcar stdout/stderr de procesos ni datos al fallar.
    if (result.status !== 0) throw Error(`Falló ${name}; revisa el cluster aislado en backend/tmp.`);
  };
  run('initdb', ['-D', data, '-U', 'landsis_test', '--auth=trust', '--encoding=UTF8', '--no-locale']);
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  run('pg_ctl', ['-D', data, '-l', path.join(directory, 'server.log'), '-w', '-t', '20', 'start', '-o', `-h 127.0.0.1 -p ${port} -F`]);
  const pool = new Pool({ host: '127.0.0.1', port, database: 'postgres', user: 'landsis_test', password: '',
    max: 6, connectionTimeoutMillis: 5000, statement_timeout: 10000, application_name: 'landsis-recovery-test' });
  const originalPool = postgres.getPool;
  postgres.getPool = () => pool;
  t.after(async () => {
    postgres.getPool = originalPool;
    try { await pool.end(); } finally { run('pg_ctl', ['-D', data, '-m', 'fast', '-w', '-t', '20', 'stop']); }
  });
  await pool.query(readFileSync(path.resolve(__dirname, '../../database/004_create_users_and_roles.sql'), 'utf8'));
  // Comprobar default sobre usuario preexistente, además de inserts posteriores.
  const oldPassword = password(), newPassword = password();
  const oldHash = await hashPassword(oldPassword);
  await pool.query("INSERT INTO users(name,email,password_hash,role_id) VALUES ('Prueba','test@example.invalid',$1,1)", [oldHash]);
  await pool.query(readFileSync(path.resolve(__dirname, '../../database/005_create_password_resets.sql'), 'utf8'));
  await pool.query(readFileSync(path.resolve(__dirname, '../../database/006_soft_delete_users.sql'), 'utf8'));
  const store = createPasswordResetStore(() => pool), recovery = createPasswordRecovery(store);
  const state = async () => (await pool.query('SELECT password_hash,credential_version,active FROM users WHERE id=1')).rows[0];

  await t.test('Migración preserva usuario y aplica restricciones de integridad', async () => {
    assert.equal((await state()).credential_version, 0); assert.equal((await state()).password_hash, oldHash);
    await assert.rejects(pool.query('UPDATE users SET credential_version=-1 WHERE id=1'), { code: '23514' });
    await assert.rejects(pool.query("INSERT INTO password_reset_tokens VALUES (1,'raw-token',clock_timestamp(),clock_timestamp())"), { code: '23514' });
    await assert.rejects(pool.query("INSERT INTO password_reset_tokens SELECT 999,$1,at,at+INTERVAL '15 minutes' FROM (SELECT clock_timestamp() at) issued", ['a'.repeat(64)]), { code: '23503' });
  });

  await t.test('Creación/sustitución: solo un hash y vigencia exacta de quince minutos', async () => {
    const first = await recovery.issue(1), second = await recovery.issue(1);
    const rows = (await pool.query('SELECT *,extract(epoch FROM expires_at-created_at) lifetime FROM password_reset_tokens')).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].token_hash, digest(second));
    assert.equal(rows[0].lifetime, '900.000000'); assert.equal(JSON.stringify(rows).includes(second), false);
    assert.equal(await store.consume(digest(first), oldHash), false);
    assert.equal(await recovery.issue(999), null);
    await pool.query('UPDATE users SET active=false WHERE id=1');
    assert.equal(await recovery.issue(1), null); assert.equal(await store.consume(digest(second), oldHash), false);
    await pool.query('UPDATE users SET active=true WHERE id=1');
  });

  await t.test('Token expirado/manipulado no cambia contraseña ni versión', async () => {
    const token = await recovery.issue(1), before = await state();
    await pool.query("WITH expired AS (SELECT clock_timestamp()-INTERVAL '16 minutes' AS issued_at) UPDATE password_reset_tokens SET created_at=issued_at,expires_at=issued_at+INTERVAL '15 minutes' FROM expired");
    assert.equal(await store.consume(digest(token), oldHash), false);
    assert.equal(await store.consume('b'.repeat(64), oldHash), false);
    assert.deepEqual(await state(), before);
  });

  await t.test('Dos consumos simultáneos: uno exitoso, un incremento y un único cambio', async () => {
    const token = await recovery.issue(1), before = await state();
    const outcomes = await Promise.all([recovery.reset(token, newPassword), recovery.reset(token, newPassword)]);
    assert.deepEqual(outcomes.sort(), [false, true]);
    const after = await state(); assert.equal(after.credential_version, before.credential_version + 1);
    assert.equal(await verifyPassword(newPassword, after.password_hash), true);
    assert.equal(await verifyPassword(oldPassword, after.password_hash), false);
    assert.equal(await store.consume(digest(token), oldHash), false);
    assert.equal((await pool.query('SELECT * FROM password_reset_tokens')).rowCount, 0);
  });

  await t.test('Emisiones concurrentes y emisión contra consumo conservan un solo token', async () => {
    const tokens = await Promise.all([recovery.issue(1), recovery.issue(1)]);
    const saved = (await pool.query('SELECT token_hash FROM password_reset_tokens')).rows;
    assert.equal(saved.length, 1); assert.equal(tokens.filter(token => digest(token) === saved[0].token_hash).length, 1);
    const old = await recovery.issue(1);
    const [fresh, consumed] = await Promise.all([recovery.issue(1), store.consume(digest(old), oldHash)]);
    assert.equal(typeof consumed, 'boolean');
    assert.equal((await pool.query('SELECT token_hash FROM password_reset_tokens')).rows[0].token_hash, digest(fresh));
    assert.equal(await store.consume(digest(old), oldHash), false);
  });

  await t.test('Expiración se revalida después de esperar bloqueo de usuario', async () => {
    const token = await recovery.issue(1), blocker = await pool.connect();
    let pending;
    try {
      await blocker.query('BEGIN'); await blocker.query('SELECT id FROM users WHERE id=1 FOR UPDATE');
      pending = store.consume(digest(token), oldHash);
      const deadline = Date.now() + 5000;
      let waiting = false;
      while (Date.now() < deadline) {
        const result = await pool.query("SELECT 1 FROM pg_stat_activity WHERE application_name='landsis-recovery-test' AND wait_event_type='Lock'");
        if (result.rows.length) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(waiting, true);
      await blocker.query("WITH expired AS (SELECT clock_timestamp()-INTERVAL '16 minutes' AS issued_at) UPDATE password_reset_tokens SET created_at=issued_at,expires_at=issued_at+INTERVAL '15 minutes' FROM expired");
      await blocker.query('COMMIT'); assert.equal(await pending, false);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  });

  await t.test('Fallo al actualizar contraseña revierte eliminación del token', async () => {
    const token = await recovery.issue(1), before = await state();
    await assert.rejects(store.consume(digest(token), null), { code: '23502' });
    assert.equal((await pool.query('SELECT token_hash FROM password_reset_tokens')).rows[0].token_hash, digest(token));
    assert.deepEqual(await state(), before);
  });

  await t.test('Reset local incrementa versión y elimina enlaces; concurrencia con consumo', async () => {
    const token = await recovery.issue(1), before = await state();
    const localPassword = password();
    assert.equal(await resetPassword(' TEST@example.invalid ', localPassword), true);
    assert.equal((await state()).credential_version, before.credential_version + 1);
    assert.equal(await store.consume(digest(token), oldHash), false);
    const other = await recovery.issue(1), version = (await state()).credential_version;
    const outcomes = await Promise.all([store.consume(digest(other), oldHash), resetPassword('test@example.invalid', localPassword)]);
    assert.equal(outcomes[1], true);
    assert.equal((await state()).credential_version, version + 1 + Number(outcomes[0]));
    assert.equal(await verifyPassword(localPassword, (await state()).password_hash), true);
    assert.equal((await pool.query('SELECT * FROM password_reset_tokens')).rowCount, 0);
  });

  await t.test('HTTP real: revoca todas las sesiones, login nuevo funciona y contrato no cambia', async () => {
    const loginPassword = password(); await resetPassword('test@example.invalid', loginPassword);
    const server = createApp(undefined, undefined, undefined, createSecurity()).listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
      const login = value => fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Landsis-Request': '1' }, body: JSON.stringify({ email: 'test@example.invalid', password: value }) });
      const first = await login(loginPassword), second = await login(loginPassword);
      assert.equal(first.status, 200); assert.equal(second.status, 200);
      const body = await first.json();
      assert.deepEqual(Object.keys(body.user).sort(), ['id', 'name', 'email', 'role', 'active', 'createdAt'].sort());
      const cookies = [first, second].map(response => response.headers.get('set-cookie').split(';')[0]);
      const me = cookie => fetch(base + '/me', { headers: { Cookie: cookie } });
      assert.equal((await me(cookies[0])).status, 200);
      const token = await recovery.issue(1), nextPassword = password();
      assert.equal(await recovery.reset(token, nextPassword), true);
      for (const cookie of cookies) { const response = await me(cookie); assert.equal(response.status, 401); assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/); }
      assert.equal((await login(loginPassword)).status, 401);
      const next = await login(nextPassword); assert.equal(next.status, 200);
      const nextCookie = next.headers.get('set-cookie').split(';')[0]; assert.equal((await me(nextCookie)).status, 200);
      await resetPassword('test@example.invalid', password()); assert.equal((await me(nextCookie)).status, 401);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });

  await t.test('API completa con PostgreSQL y SMTP simulado: solicitud, reset, errores y sesiones', async () => {
    const loginPassword = password(), nextPassword = password();
    await resetPassword('test@example.invalid', loginPassword);
    await pool.query("INSERT INTO users(name,email,password_hash,role_id,active) VALUES ('Inactivo','inactive@example.invalid',$1,1,false)", [oldHash]);
    const sent = []; let failSmtp = false, failures = 0;
    const mail = createMailService({ sendMail: async message => {
      if (failSmtp) throw Error('Synthetic SMTP failure'); sent.push(message);
    } }, 'landsis@example.invalid');
    const security = createSecurity(undefined, undefined, { mail, frontendUrl: 'https://frontend.example.invalid/', onFailure: () => { failures++; } });
    const server = createApp(undefined, undefined, undefined, security).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const waitFor = async check => {
      const deadline = Date.now() + 5000;
      while (!check()) { if (Date.now() > deadline) throw Error('Trabajo de correo simulado no terminó.'); await new Promise(resolve => setTimeout(resolve, 10)); }
    };
    try {
      const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
      const post = (route, body) => fetch(base + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Landsis-Request': '1' }, body: JSON.stringify(body) });
      const first = await post('login', { email: 'test@example.invalid', password: loginPassword });
      const second = await post('login', { email: 'test@example.invalid', password: loginPassword });
      assert.equal(first.status, 200); assert.equal(second.status, 200);
      const cookies = [first, second].map(response => response.headers.get('set-cookie').split(';')[0]);
      const bodies = [];
      for (const email of [' TEST@example.invalid ', 'missing@example.invalid', 'inactive@example.invalid']) {
        const response = await post('forgot-password', { email }); assert.equal(response.status, 202);
        assert.equal(response.headers.get('set-cookie'), null); bodies.push(await response.json());
      }
      assert.deepEqual(bodies[0], bodies[1]); assert.deepEqual(bodies[1], bodies[2]);
      await waitFor(() => sent.length === 1);
      const link = new URL(sent[0].text.match(/https:\/\/[^\s]+/)[0]);
      assert.equal(link.origin, 'https://frontend.example.invalid');
      const deliveredToken = new URLSearchParams(link.hash.slice(1)).get('token');
      const manipulated = await post('reset-password', { token: randomBytes(32).toString('hex'), password: nextPassword });
      assert.equal(manipulated.status, 400); const invalidBody = await manipulated.json();
      const response = await post('reset-password', { token: deliveredToken, password: nextPassword });
      assert.equal(response.status, 200); assert.equal(response.headers.get('set-cookie'), null);
      for (const cookie of cookies) assert.equal((await fetch(base + '/me', { headers: { Cookie: cookie } })).status, 401);
      assert.equal((await post('login', { email: 'test@example.invalid', password: loginPassword })).status, 401);
      assert.equal((await post('login', { email: 'test@example.invalid', password: nextPassword })).status, 200);
      const reused = await post('reset-password', { token: deliveredToken, password: loginPassword });
      assert.equal(reused.status, 400); assert.deepEqual(await reused.json(), invalidBody);
      assert.equal((await post('forgot-password', { email: 'test@example.invalid' })).status, 202);
      await waitFor(() => sent.length === 2);
      const expiredLink = new URL(sent[1].text.match(/https:\/\/[^\s]+/)[0]);
      const expiredToken = new URLSearchParams(expiredLink.hash.slice(1)).get('token');
      await pool.query("WITH expired AS (SELECT clock_timestamp()-INTERVAL '16 minutes' AS issued_at) UPDATE password_reset_tokens SET created_at=issued_at,expires_at=issued_at+INTERVAL '15 minutes' FROM expired");
      const expired = await post('reset-password', { token: expiredToken, password: loginPassword });
      assert.equal(expired.status, 400); assert.deepEqual(await expired.json(), invalidBody);
      failSmtp = true;
      const failure = await post('forgot-password', { email: 'test@example.invalid' });
      assert.equal(failure.status, 202); assert.deepEqual(await failure.json(), bodies[0]);
      await waitFor(() => failures === 1); assert.equal(sent.length, 2);
      assert.equal(await verifyPassword(nextPassword, (await state()).password_hash), true);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
  await t.test('Eliminación lógica HTTP, autorización, sesiones, recuperación y concurrencia real', async () => {
    const { userStore, AdminDeletion } = require('../dist/data/users.js');
    const { Sessions } = require('../dist/auth/sessions.js');
    const sessions = new Sessions();
    const add = async (name, role=1) => (await pool.query('INSERT INTO users(name,email,password_hash,role_id) VALUES ($1,$2,$3,$4) RETURNING id', [name, name+'@example.invalid', oldHash, role])).rows[0].id;
    const admin = await add('delete-admin'), target = await add('delete-target',2), conred = await add('delete-conred',3);
    const cookie = id => 'landsis_session='+sessions.create(id,0);
    const adminCookie = cookie(admin), targetCookie = cookie(target), conredCookie = cookie(conred);
    const token = await recovery.issue(target);
    const server = createApp(undefined, undefined, undefined, createSecurity(userStore,sessions)).listen(0,'127.0.0.1');
    await once(server,'listening');
    try {
      const base = `http://127.0.0.1:${server.address().port}/api/v1`;
      const request = (route, method='GET', auth, headers={}) => fetch(base+route,{method,headers:{'Content-Type':'application/json','X-Landsis-Request':'1',...(auth?{Cookie:auth}:{}),...headers}});
      assert.equal((await request('/users/'+target,'DELETE')).status,401);
      for (const auth of [targetCookie,conredCookie]) assert.equal((await request('/users/'+target,'DELETE',auth)).status,403);
      assert.equal((await request('/users/'+target,'DELETE',adminCookie,{'X-Landsis-Request':'0'})).status,403);
      assert.equal((await request('/users/'+target,'DELETE',adminCookie,{'Content-Type':'text/plain'})).status,415);
      assert.equal((await request('/users/0','DELETE',adminCookie)).status,400);
      assert.equal((await request('/users/'+admin,'DELETE',adminCookie)).status,409);
      assert.equal((await request('/users/999999','DELETE',adminCookie)).status,404);
      // Datos exclusivos del cluster temporal: dos administradores activos y uno inactivo.
      const inactiveAdmin = await add('delete-inactive-admin');
      await pool.query('UPDATE users SET active=false WHERE id=$1',[inactiveAdmin]);
      for (const id of [1,inactiveAdmin]) {
        const before = (await pool.query('SELECT * FROM users WHERE id=$1',[id])).rows[0];
        const response = await request('/users/'+id,'DELETE',adminCookie);
        assert.equal(response.status,409);
        assert.equal((await response.json()).message,'No se pueden eliminar cuentas administradoras.');
        assert.deepEqual((await pool.query('SELECT * FROM users WHERE id=$1',[id])).rows[0],before);
      }
      const deleted = await request('/users/'+target,'DELETE',adminCookie);
      assert.equal(deleted.status,204); assert.equal(await deleted.text(),'');
      assert.equal((await request('/users/'+target,'DELETE',adminCookie)).status,404);
      assert.equal(await userStore.patch(target,{active:true}),null);
      const listed = await (await request('/users','GET',adminCookie)).json();
      assert.equal(listed.users.some(u=>u.id===target),false);
      for (const route of ['/auth/me','/nodes','/readings']) assert.equal((await request(route,'GET',targetCookie)).status,401);
      const login = await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Landsis-Request':'1'},body:JSON.stringify({email:'delete-target@example.invalid',password:oldPassword})});
      assert.equal(login.status,401);
      assert.equal(await userStore.findByEmail('delete-target@example.invalid'),null);
      assert.equal(await recovery.issue(target),null); assert.equal(await store.consume(digest(token),oldHash),false);
      assert.equal(await store.resetLocal('delete-target@example.invalid',oldHash),false);
      const kept = (await pool.query('SELECT * FROM users WHERE id=$1',[target])).rows[0];
      assert.ok(kept.deleted_at); assert.equal(kept.password_hash,oldHash); assert.equal(kept.credential_version,1);
      assert.equal((await pool.query('SELECT * FROM password_reset_tokens WHERE user_id=$1',[target])).rowCount,0);
      // DELETE de administrador se rechaza aunque compita con PATCH de otro administrador.
      const results = await Promise.allSettled([userStore.remove(1,conred),userStore.patch(admin,{active:false})]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      assert.ok(results.find(r=>r.status==='rejected').reason instanceof AdminDeletion);
      const remaining = (await userStore.list()).find(u=>u.role==='ADMINISTRADOR' && u.active);
      await assert.rejects(userStore.remove(remaining.id,conred),AdminDeletion);
      // Su versión actual puede haber cambiado por las pruebas previas.
      const version = (await pool.query('SELECT credential_version FROM users WHERE id=$1',[remaining.id])).rows[0].credential_version;
      const currentCookie = 'landsis_session='+sessions.create(remaining.id,version);
      assert.equal((await request('/users/'+conred,'DELETE',currentCookie)).status,204);
      assert.equal(await userStore.findById(conred),null);
    } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
  });
});
