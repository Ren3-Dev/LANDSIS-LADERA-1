const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkSmtp, SmtpCheckError } = require('../dist/check-smtp.js');
const env = { SMTP_HOST:'smtp.gmail.com',SMTP_PORT:'465',SMTP_SECURE:'true',SMTP_USER:'synthetic@example.invalid',
  SMTP_PASSWORD:'synthetic-app-secret',MAIL_FROM:'synthetic@example.invalid',FRONTEND_URL:'http://127.0.0.1:5173/',
  NODE_ENV:'development',RECOVERY_EMAIL_ENABLED:'false' };

test('Comprobación Gmail valida sin crear transporte ni conectar por defecto', async () => {
  let called = false;
  assert.deepEqual(await checkSmtp(env,false,()=>{called=true;throw Error('unexpected');}),
    {configurationValid:true,connectionChecked:false,messagesSent:0});
  assert.equal(called,false); assert.equal(env.RECOVERY_EMAIL_ENABLED,'false');
});

test('Comprobación rechaza faltantes, otro destino, TLS incorrecto o recuperación habilitada', async () => {
  for (const patch of [{SMTP_USER:''},{SMTP_PASSWORD:''},{MAIL_FROM:''},{FRONTEND_URL:''},{SMTP_HOST:'attacker.invalid'},
    {SMTP_PORT:'587',SMTP_SECURE:'false'},{RECOVERY_EMAIL_ENABLED:'true'}, {FRONTEND_URL:'https://user:secret@example.invalid'}]) {
    await assert.rejects(checkSmtp({...env,...patch},true,()=>{throw Error('Factory must not run');}),error=>error instanceof SmtpCheckError && error.category==='CONFIGURATION');
  }
});

test('Verificación autorizada llama solo verify y close con TLS y tiempos existentes', async () => {
  const calls = [];
  const result = await checkSmtp(env,true,options=>{
    assert.equal(options.host,'smtp.gmail.com'); assert.equal(options.port,465); assert.equal(options.secure,true);
    assert.equal(options.tls.rejectUnauthorized,true); assert.equal(options.logger,false); assert.equal(options.debug,false);
    assert.equal(options.connectionTimeout,10000); assert.equal(options.socketTimeout,20000);
    return {verify:async()=>{calls.push('verify');return true;},close:()=>calls.push('close')};
  });
  assert.deepEqual(calls,['verify','close']); assert.deepEqual(result,{configurationValid:true,connectionChecked:true,messagesSent:0});
});

test('Errores de autenticación/red/TLS se sanitizan, cierran transporte y no registran secretos', async t => {
  const output = [];
  for (const method of ['log','error','warn','debug','info']) {
    const original = console[method]; console[method]=(...args)=>output.push(args); t.after(()=>{console[method]=original;});
  }
  for (const [code,category] of [['EAUTH','AUTHENTICATION'],['ETLS','TLS'],['ETIMEDOUT','CONNECTION'],['EDNS','CONNECTION'],['ESOCKET','CONNECTION'],['secret-in-code','UNKNOWN']]) {
    let closed=false;
    await assert.rejects(checkSmtp(env,true,()=>({verify:async()=>{throw Object.assign(Error(env.SMTP_PASSWORD),{code});},close:()=>{closed=true;}})), error=>{
      assert.equal(error.category,category); assert.equal(error.cause,undefined);
      assert.equal((JSON.stringify(error)+error.stack).includes(env.SMTP_PASSWORD),false); return true;
    });
    assert.equal(closed,true);
  }
  assert.deepEqual(output,[]);
});

test('verify falso se rechaza y fallo al cerrar no expone el error original', async () => {
  await assert.rejects(checkSmtp(env,true,()=>({verify:async()=>false,close:()=>{throw Error(env.SMTP_PASSWORD);}})),
    error=>error instanceof SmtpCheckError && error.category==='CONNECTION');
});

test('Diagnóstico conserva solo campos permitidos y elimina argumentos AUTH y respuesta', async () => {
  await assert.rejects(checkSmtp(env,true,()=>({verify:async()=>{throw {
    code:'EAUTH',command:'AUTH PLAIN '+env.SMTP_PASSWORD,responseCode:535,
    response:env.SMTP_PASSWORD,message:env.SMTP_PASSWORD,
  };},close(){}})),error=>{
    assert.deepEqual(error.diagnostic,{code:'EAUTH',stage:'AUTHENTICATION',command:'AUTH',responseCode:535});
    assert.equal(JSON.stringify(error).includes(env.SMTP_PASSWORD),false);return true;
  });
});

test('Diagnóstico distingue certificados TLS y descarta campos arbitrarios', async () => {
  for (const [fields,category,diagnostic] of [
    [{code:'CERT_HAS_EXPIRED',command:'CONN'},'TLS',{code:'CERT_HAS_EXPIRED',stage:'TLS',command:'CONN'}],
    [{code:env.SMTP_PASSWORD,command:env.SMTP_PASSWORD,responseCode:env.SMTP_PASSWORD},'UNKNOWN',{code:'UNKNOWN',stage:'VERIFY'}],
  ]) {
    await assert.rejects(checkSmtp(env,true,()=>({verify:async()=>{throw fields;},close(){}})),error=>{
      assert.equal(error.category,category);assert.deepEqual(error.diagnostic,diagnostic);return true;
    });
  }
});
