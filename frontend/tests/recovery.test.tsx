import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AuthApp from '../src/AuthApp';
import LoginForm from '../src/components/LoginForm';
import { ForgotPasswordView, ResetPasswordView, PasswordResetComplete } from '../src/components/RecoveryViews';
import { normalizeRecoveryEmail, passwordRecoveryError, readRecoveryLocation, recoveryMessage,
  requestPasswordRecovery, submitPasswordReset, recoveryPaths, watchRecoveryNavigation } from '../src/recovery';
import { ApiError } from '../src/api/http';

const token = 'a'.repeat(64), password = 'synthetic-password-for-test';
const noop = () => {};

function location(path: string) {
  const url = new URL(path, 'https://example.invalid');
  const replaced: unknown[][] = [];
  const browser = { location: url, history: { replaceState: (...args: unknown[]) => { replaced.push(args); } } } as unknown as Pick<Window, 'location' | 'history'>;
  return { browser, replaced };
}

test('Login enlaza recuperación sin cambiar formulario ni roles', () => {
  const html = renderToStaticMarkup(<LoginForm onLogin={noop}/>);
  assert.match(html, /href="\/forgot-password"/); assert.match(html, /¿Olvidaste tu contraseña\?/);
  assert.match(html, /Administrador, Investigador y CONRED/); assert.match(html, /autoComplete="current-password"/);
});

test('Ruta pública de solicitud funciona sin restaurar sesión', () => {
  const { browser } = location('/forgot-password'); assert.deepEqual(readRecoveryLocation(browser), { page: 'forgot' });
  const html = renderToStaticMarkup(<AuthApp initialRecovery={{ page: 'forgot' }}/>);
  assert.match(html, /Recuperar contraseña/); assert.match(html, /type="email"/);
  assert.doesNotMatch(html, /Verificando sesión|telemetría|Usuarios/);
});

test('Token válido se recibe desde fragmento y se retira toda query/hash sin copiarlo al historial', () => {
  const { browser, replaced } = location('/reset-password?other=1#token=' + token);
  assert.deepEqual(readRecoveryLocation(browser), { page: 'reset', token });
  assert.deepEqual(replaced, [[null, '', '/reset-password']]); assert.equal(JSON.stringify(replaced).includes(token), false);
});

test('Token ausente, inválido, duplicado o por query no se admite y también limpia URL', () => {
  for (const value of ['/reset-password', '/reset-password?token=' + token, '/reset-password#token=short',
    '/reset-password#token=' + token + '&token=' + token, '/reset-password#token=' + token + '&extra=1', '/reset-password#token=' + 'G'.repeat(64)]) {
    const { browser, replaced } = location(value);
    assert.deepEqual(readRecoveryLocation(browser), { page: 'reset', token: null });
    assert.deepEqual(replaced, [[null, '', '/reset-password']]);
  }
});

test('popstate y hashchange de la misma navegación capturan el token una sola vez', () => {
  const events = new EventTarget();
  const url = new URL('https://example.invalid/reset-password#token=' + token);
  const browser = { location: url,
    history: { replaceState: (_state: unknown, _unused: string, value: string) => { url.href = new URL(value, url).href; } },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
  } as unknown as Parameters<typeof watchRecoveryNavigation>[0];
  const routes: unknown[] = [];
  const stop = watchRecoveryNavigation(browser, route => routes.push(route));
  const previous = url.href;
  events.dispatchEvent(new Event('popstate'));
  events.dispatchEvent(Object.assign(new Event('hashchange'), { newURL: previous }));
  assert.deepEqual(routes, [{ page: 'reset', token }]); assert.equal(url.hash, '');
  events.dispatchEvent(new Event('popstate'));
  assert.deepEqual(routes.at(-1), { page: 'reset', token: null });
  stop(); events.dispatchEvent(new Event('popstate')); assert.equal(routes.length, 2);
});

test('Formulario de nueva contraseña no expone token ni agrega recursos externos', () => {
  const html = renderToStaticMarkup(<AuthApp initialRecovery={{ page: 'reset', token }}/>);
  assert.match(html, /Establecer nueva contraseña/); assert.equal((html.match(/type="password"/g) ?? []).length, 2);
  assert.match(html, /Confirmar nueva contraseña/); assert.equal(html.includes(token), false);
  assert.doesNotMatch(html, /Verificando sesión|<script|<img|<iframe|https?:\/\//);
});

test('Enlace inválido no presenta formulario y permite solicitar otro o volver al login', () => {
  const html = renderToStaticMarkup(<ResetPasswordView token={null} onComplete={noop} onNavigate={noop}/>);
  assert.match(html, /role="alert"/); assert.match(html, /Solicitar un nuevo enlace/);
  assert.match(html, /href="\/forgot-password"/); assert.match(html, /href="\/"/); assert.doesNotMatch(html, /<form/);
});

test('Correo usa validación y normalización compatibles con backend', () => {
  assert.equal(normalizeRecoveryEmail(' USER@Example.invalid '), 'user@example.invalid');
  for (const value of ['', 'invalid', 'a@b', 'a @example.invalid', 'a'.repeat(255) + '@example.invalid']) assert.equal(normalizeRecoveryEmail(value), null);
});

test('Política Unicode coincide con backend y no recorta ni normaliza contraseña', () => {
  for (const value of ['', 'short', ' '.repeat(12), 'a'.repeat(129)]) assert.ok(passwordRecoveryError(value, value));
  assert.equal(passwordRecoveryError('😀'.repeat(12), '😀'.repeat(12)), null);
  assert.equal(passwordRecoveryError('😀'.repeat(128), '😀'.repeat(128)), null);
  assert.ok(passwordRecoveryError('😀'.repeat(129), '😀'.repeat(129)));
  assert.equal(passwordRecoveryError('  spaced-password  ', '  spaced-password  '), null);
  assert.equal(passwordRecoveryError(password, password + 'x'), 'Las contraseñas no coinciden.');
});

test('Solicita recuperación con JSON/cabecera/cookie y muestra mensaje genérico uniforme', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options: options! }); return Response.json({ message: 'Contenido no usado para revelar existencia' }, { status: 202 }); };
  assert.equal(await requestPasswordRecovery(' USER@example.invalid '), recoveryMessage);
  assert.equal(calls[0].url, '/api/v1/auth/forgot-password');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal((calls[0].options.headers as Record<string, string>)['X-Landsis-Request'], '1');
  assert.equal((calls[0].options.headers as Record<string, string>)['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), { email: 'user@example.invalid' });
});

test('Validaciones rechazan correo, token, política y confirmación antes de enviar', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let called = false; globalThis.fetch = async () => { called = true; throw Error('Unexpected fetch'); };
  await assert.rejects(requestPasswordRecovery('invalid'));
  await assert.rejects(submitPasswordReset('invalid', password, password));
  await assert.rejects(submitPasswordReset(token, 'short', 'short'));
  await assert.rejects(submitPasswordReset(token, password, 'different'));
  assert.equal(called, false);
});

test('Reset manda solo token/password, sin login automático ni normalizar contraseña', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options: options! }); return Response.json({ message: 'Contraseña restablecida.' }); };
  const value = '  spaced-password  ';
  await submitPasswordReset(token, value, value);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/v1/auth/reset-password');
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), { token, password: value });
  assert.equal((calls[0].options.headers as Record<string, string>)['X-Landsis-Request'], '1');
});

test('Token vencido/inválido y límites conservan errores públicos sin evento de sesión vencida', async t => {
  const original = globalThis.fetch, oldWindow = globalThis.window;
  t.after(() => { globalThis.fetch = original; globalThis.window = oldWindow; });
  let expired = false;
  globalThis.window = { dispatchEvent: () => { expired = true; return true; } } as unknown as Window & typeof globalThis;
  for (const status of [400, 429, 503]) {
    globalThis.fetch = async () => Response.json({ message: 'Error público de recuperación.' }, { status });
    await assert.rejects(submitPasswordReset(token, password, password), error => error instanceof ApiError && error.status === status);
  }
  assert.equal(expired, false);
});

test('Confirmación ofrece volver a login y no afirma una sesión automática', () => {
  const html = renderToStaticMarkup(<PasswordResetComplete onNavigate={noop}/>);
  assert.match(html, /Contraseña restablecida/); assert.match(html, /Inicia sesión con tu nueva contraseña/);
  assert.match(html, /href="\/"/); assert.equal(recoveryPaths.login, '/');
  assert.doesNotMatch(html, /<form|telemetría|<script/);
});

test('Referrer-Policy está presente antes de recursos y no hay persistencia de tokens', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<meta name="referrer" content="no-referrer"\/>/);
  assert.ok(html.indexOf('name="referrer"') < html.indexOf('<script'));
  for (const file of ['../src/recovery.ts', '../src/components/RecoveryViews.tsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|console\./);
  }
});
