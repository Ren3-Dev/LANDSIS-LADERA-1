import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginForm from '../src/components/LoginForm';
import UserNavigation from '../src/components/UserNavigation';
import AuthApp from '../src/AuthApp';
import { apiRequest, jsonRequest, ApiError } from '../src/api/http';
import type { User } from '../src/types/user';
const user: User = { id: 1, name: 'Prueba', email: 'user@example.invalid', role: 'ADMINISTRADOR', active: true, createdAt: '2026-10-05T00:00:00Z' };

test('Login muestra campos accesibles y contraseña oculta', () => {
  const html = renderToStaticMarkup(<LoginForm onLogin={() => {}} notice="Sesión cerrada."/>);
  assert.match(html,/type="email"/); assert.match(html,/type="password"/); assert.match(html,/autoComplete="current-password"/);
  assert.match(html,/Iniciar sesión/); assert.match(html,/Sesión cerrada/);
});
test('Dashboard no se renderiza mientras se verifica sesión', () => {
  const html = renderToStaticMarkup(<AuthApp/>);
  assert.match(html,/Verificando sesión/); assert.doesNotMatch(html,/Humedad de suelo|Últimas mediciones/);
});
test('Navegación diferencia los tres roles', () => {
  for (const role of ['ADMINISTRADOR','INVESTIGADOR','CONRED'] as const) {
    const html = renderToStaticMarkup(<UserNavigation user={{ ...user, role }} page="dashboard" onPage={() => {}} onLogout={() => {}} busy={false}/>);
    assert.match(html,/Historial/); assert.match(html,/Estado del nodo/); assert.match(html,/aria-current="page"/); assert.match(html,/Dashboard/); assert.match(html,/Cerrar sesión/); assert.match(html,new RegExp(role));
    assert.equal(html.includes('Usuarios'),role === 'ADMINISTRADOR');
  }
});
test('Cliente login, restauración me y logout usa cookie y cabecera CSRF', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options! });
    return String(url).endsWith('/logout') ? new Response(null,{status:204}) : Response.json({user});
  };
  await jsonRequest('auth/login','POST',{email:user.email,password:'sintetica-para-prueba'});
  assert.equal(calls[0].options.credentials,'same-origin'); assert.equal((calls[0].options.headers as Record<string,string>)['X-Landsis-Request'],'1');
  assert.deepEqual((await jsonRequest<{user:User}>('auth/me')).user,user);
  await jsonRequest('auth/logout','POST',{}); assert.match(calls[2].url,/auth\/logout$/);
  assert.equal((calls[1].options.headers as Record<string,string>).Authorization,undefined);
});
test('Credenciales inválidas producen error claro', async t => {
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async()=>Response.json({message:'Correo o contraseña inválidos.'},{status:401});
  await assert.rejects(jsonRequest('auth/login','POST',{}),error=>error instanceof ApiError && error.status===401 && error.message==='Correo o contraseña inválidos.');
});
test('Una sesión vencida en telemetría notifica al contenedor',async t=>{
  const original=globalThis.fetch; const oldWindow=globalThis.window;
  t.after(()=>{globalThis.fetch=original;globalThis.window=oldWindow;});
  let expired=false;globalThis.window={dispatchEvent:(event:Event)=>{expired=event.type==='landsis-session-expired';return true;}} as Window & typeof globalThis;
  globalThis.fetch=async()=>new Response(null,{status:401});
  await apiRequest('readings');assert.equal(expired,true);
});


test('Eliminar usuario envía DELETE protegido y admite 204 sin JSON', async t => {
  const original=globalThis.fetch; t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async(url,options)=>{
    assert.equal(String(url),'/api/v1/users/9'); assert.equal(options?.method,'DELETE');
    assert.equal(options?.credentials,'same-origin');
    assert.equal((options?.headers as Record<string,string>)['X-Landsis-Request'],'1');
    assert.equal((options?.headers as Record<string,string>)['Content-Type'],'application/json');
    return new Response(null,{status:204});
  };
  assert.equal(await jsonRequest('users/9','DELETE'),undefined);
});
test('Acciones de usuarios ocultan Eliminar para ADMINISTRADOR y conservan Editar', async () => {
  const { UserActions } = await import('../src/components/UsersPanel');
  for (const role of ['ADMINISTRADOR','INVESTIGADOR','CONRED'] as const) {
    for (const active of [true,false]) {
      const html=renderToStaticMarkup(<UserActions user={{...user,role,active}} disabled={false} onEdit={()=>{}} onDelete={()=>{}}/>);
      assert.match(html,/>Editar<\/button>/);
      assert.equal(html.includes('>Eliminar</button>'),role!=='ADMINISTRADOR');
      const busy=renderToStaticMarkup(<UserActions user={{...user,role,active}} disabled={true} onEdit={()=>{}} onDelete={()=>{}}/>);
      assert.equal((busy.match(/disabled=""/g)||[]).length,role==='ADMINISTRADOR'?1:2);
    }
  }
});