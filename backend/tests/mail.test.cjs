const assert = require('node:assert/strict');
const { test } = require('node:test');
const nodemailer = require('nodemailer');
const { loadMailConfig } = require('../dist/config/mail.js');
const { passwordRecoveryTemplate, passwordChangedTemplate } = require('../dist/mail/templates.js');
const { createMailService, createSmtpMailService, MailDeliveryError } = require('../dist/mail/service.js');

// Solo configuración sintética y transportes en memoria. No cargar dotenv.
const env = { SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '587', SMTP_SECURE: 'false',
  SMTP_USER: 'synthetic-user', SMTP_PASSWORD: 'synthetic-secret', MAIL_FROM: 'landsis@example.invalid' };
const input = { name: '<script>"&\' prueba</script>', resetUrl: 'https://example.invalid/reset#token=synthetic&other=1' };

test('Configuración SMTP obliga STARTTLS o TLS y certificados válidos', () => {
  const config = loadMailConfig(env);
  assert.equal(config.from, env.MAIL_FROM);
  assert.equal(config.smtp.requireTLS, true);
  assert.equal(config.smtp.secure, false);
  assert.equal(config.smtp.ignoreTLS, false);
  assert.deepEqual(config.smtp.tls, { rejectUnauthorized: true, minVersion: 'TLSv1.2' });
  assert.equal(config.smtp.logger, false); assert.equal(config.smtp.debug, false);
  assert.equal(config.smtp.disableFileAccess, true); assert.equal(config.smtp.disableUrlAccess, true);
  for (const key of ['connectionTimeout', 'greetingTimeout', 'socketTimeout', 'dnsTimeout']) {
    assert.ok(config.smtp[key] > 0 && config.smtp[key] <= 20000);
  }
  const implicit = loadMailConfig({ ...env, SMTP_PORT: '465', SMTP_SECURE: 'true' });
  assert.equal(implicit.smtp.secure, true); assert.equal(implicit.smtp.requireTLS, false);
  assert.equal(loadMailConfig({ ...env, SMTP_PASSWORD: ' secret with spaces ' }).smtp.auth.pass, ' secret with spaces ');
});

test('Configuración incompleta o insegura falla sin exponer valores', () => {
  const invalid = [{}, ...Object.keys(env).map(key => ({ ...env, [key]: '' })),
    ...['0', '65536', '1.5', '587oops'].map(port => ({ ...env, SMTP_PORT: port })),
    { ...env, SMTP_SECURE: 'yes' }, { ...env, SMTP_PORT: '465' },
    { ...env, SMTP_SECURE: 'true' }, { ...env, SMTP_HOST: 'smtp://user:secret@host' },
    { ...env, SMTP_USER: 'user\r\nheader' }, { ...env, SMTP_PASSWORD: 'secret\nheader' },
    { ...env, MAIL_FROM: 'a@example.invalid,b@example.invalid' },
    { ...env, MAIL_FROM: 'a\0@example.invalid' }];
  for (const value of invalid) assert.throws(() => loadMailConfig(value), error => {
    assert.equal(error.message, 'Configuración de correo inválida. Revisa las variables SMTP y MAIL_FROM.');
    assert.equal(error.cause, undefined); return true;
  });
});

test('Plantillas HTML/texto estructuradas, contenido escapado y enlace seguro', () => {
  const recovery = passwordRecoveryTemplate(input);
  const changed = passwordChangedTemplate({ name: input.name });
  for (const content of [recovery, changed]) {
    assert.ok(content.subject.includes('LANDSIS'));
    assert.match(content.html, /^<!doctype html><html lang="es">/);
    assert.match(content.html, /<main><h1>LANDSIS LADERA-1<\/h1>/);
    assert.match(content.html, /&lt;script&gt;&quot;&amp;&#39;/);
    assert.doesNotMatch(content.html, /<script>/);
    assert.ok(content.text.includes(input.name));
  }
  assert.match(recovery.html, /href="https:\/\/example.invalid\/reset#token=synthetic&amp;other=1"/);
  assert.match(recovery.text, /15 minutos/); assert.match(recovery.text, /una vez/);
  assert.ok(recovery.text.includes(input.resetUrl));
  assert.doesNotMatch(changed.html + changed.text, /synthetic|href=/);
  assert.match(changed.text, /contacta al administrador/);
  assert.ok(passwordRecoveryTemplate({ ...input, resetUrl: 'http://localhost:5173/#test' }).html);
  for (const resetUrl of ['javascript:alert(1)', 'data:text/html,test', 'http://remote.invalid',
    'https://user:secret@example.invalid', 'invalid', 'https://example.invalid/\nsecret']) {
    assert.throws(() => passwordRecoveryTemplate({ ...input, resetUrl }), /^Error: Enlace de recuperación inválido\.$/);
  }
});

test('Servicio inyectable permite plantillas y futuras notificaciones sin campos adicionales', async () => {
  const sent = [];
  const service = createMailService({ sendMail: async message => { sent.push(message); } }, env.MAIL_FROM);
  await service.sendPasswordRecovery('user@example.invalid', input);
  await service.sendPasswordChanged('user@example.invalid', { name: 'Prueba' });
  await service.send({ to: 'user@example.invalid', subject: 'Notificación futura', text: 'Texto', html: '<p>Texto</p>',
    auth: 'must-not-pass', headers: { 'X-Test': 'must-not-pass' } });
  assert.equal(sent.length, 3);
  for (const message of sent) {
    assert.deepEqual(Object.keys(message).sort(), ['from', 'to', 'subject', 'text', 'html'].sort());
    assert.equal(message.from, env.MAIL_FROM);
  }
  assert.throws(() => createMailService({}, 'invalid'));
  for (const patch of [{ to: 'a@example.invalid\r\nBcc: b@example.invalid' }, { subject: 'bad\nheader' },
    { to: 'a@example.invalid,b@example.invalid' }, { to: 'a\0@example.invalid' }, { text: '' }, { html: '' }]) {
    await assert.rejects(service.send({ to: 'user@example.invalid', subject: 'Test', text: 'Texto', html: '<p>Texto</p>', ...patch }));
  }
  assert.equal(sent.length, 3);
});

test('Falla SMTP y rechazo de destinatario producen error sanitizado sin logs', async t => {
  const output = [];
  for (const method of ['log', 'error', 'warn', 'info', 'debug']) {
    const original = console[method]; console[method] = (...args) => output.push(args);
    t.after(() => { console[method] = original; });
  }
  for (const transport of [
    { sendMail: async () => { throw new Error(`${env.SMTP_PASSWORD} token=synthetic user@example.invalid`); } },
    { sendMail: async () => ({ rejected: ['user@example.invalid'] }) },
  ]) {
    const service = createMailService(transport, env.MAIL_FROM);
    await assert.rejects(service.sendPasswordRecovery('user@example.invalid', input), error => {
      assert.ok(error instanceof MailDeliveryError);
      assert.equal(error.message, 'No se pudo enviar el correo.');
      assert.equal(error.cause, undefined);
      assert.doesNotMatch(JSON.stringify(error) + error.stack, /synthetic|user@example/);
      return true;
    });
  }
  assert.deepEqual(output, []);
});

test('Adaptador SMTP CommonJS se construye sin verificar conexión ni enviar', t => {
  const original = nodemailer.createTransport;
  let options;
  nodemailer.createTransport = value => { options = value; return { sendMail: async () => { throw Error('Unexpected send'); } }; };
  t.after(() => { nodemailer.createTransport = original; });
  assert.ok(createSmtpMailService(env).send);
  assert.deepEqual(options, loadMailConfig(env).smtp);
});

test('Nodemailer genera MIME multipart con transporte stream en memoria sin red', async () => {
  const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const content = passwordChangedTemplate({ name: 'Prueba' });
  const result = await transporter.sendMail({ from: env.MAIL_FROM, to: 'user@example.invalid', ...content });
  const mime = result.message.toString();
  assert.match(mime, /Content-Type: multipart\/alternative/);
  assert.match(mime, /Content-Type: text\/plain; charset=utf-8/);
  assert.match(mime, /Content-Type: text\/html; charset=utf-8/);
  assert.doesNotMatch(mime, /synthetic-secret|synthetic-user/);
});
