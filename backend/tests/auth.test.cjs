const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { createApp } = require('../dist/app.js');
const { createSecurity } = require('../dist/auth/security.js');
const { Sessions } = require('../dist/auth/sessions.js');
const { hashPassword, verifyPassword, validPassword } = require('../dist/auth/password.js');
const { UserConflict, LastAdmin } = require('../dist/data/users.js');
const { randomBytes } = require('node:crypto');

// Datos exclusivamente sintéticos: nunca crean usuarios en PostgreSQL.
const password = randomBytes(18).toString('base64url');
test('Hash scrypt, sal aleatoria y política', async () => {
  const a = await hashPassword(password), b = await hashPassword(password);
  assert.notEqual(a,b); assert.equal(a.includes(password),false);
  assert.equal(await verifyPassword(password,a),true);
  assert.equal(await verifyPassword('incorrecta',a),false);
  assert.equal(await verifyPassword(password,'malformado'),false);
  for (const v of ['', ' '.repeat(12), 'a'.repeat(11), 'a'.repeat(129), null]) assert.equal(validPassword(v),false);
  assert.equal(validPassword('a'.repeat(12)),true); assert.equal(validPassword('a'.repeat(128)),true);
});
test('Sesiones expiran, son opacas y se revocan', () => {
  let now=0; const sessions=new Sessions(()=>now);
  const token=sessions.create(7); assert.equal(sessions.userId(token),7);
  assert.equal(sessions.userId('invalid'),null);
  now=8*60*60*1000; assert.equal(sessions.userId(token),null);
  const other=sessions.create(9); sessions.delete(other); assert.equal(sessions.userId(other),null);
});
test('Auth y roles por HTTP', async t => {
  const hash=await hashPassword(password);
  const users=[
    {id:1,name:'Admin de prueba',email:'admin@example.invalid',role:'ADMINISTRADOR',active:true,createdAt:new Date().toISOString(),passwordHash:hash},
    {id:2,name:'Investigador',email:'research@example.invalid',role:'INVESTIGADOR',active:true,createdAt:new Date().toISOString(),passwordHash:hash},
    {id:3,name:'Inactivo',email:'inactive@example.invalid',role:'CONRED',active:false,createdAt:new Date().toISOString(),passwordHash:hash},
    {id:4,name:'CONRED',email:'conred@example.invalid',role:'CONRED',active:true,createdAt:new Date().toISOString(),passwordHash:hash},
  ];
  const store={
    findByEmail:async email=>users.find(u=>u.email===email)||null,
    findById:async id=>users.find(u=>u.id===id)||null,
    list:async()=>users,
    create:async(input,passwordHash)=>{
      if(users.some(u=>u.email===input.email)) throw new UserConflict();
      const user={...input,id:users.length+1,createdAt:new Date().toISOString(),passwordHash}; users.push(user);return user;
    },
    patch:async(id,patch)=>{const user=users.find(u=>u.id===id);if(!user)return null;
      if(user.role==='ADMINISTRADOR' && (patch.active===false || (patch.role&&patch.role!=='ADMINISTRADOR')) && users.filter(u=>u.active&&u.role==='ADMINISTRADOR').length===1)throw new LastAdmin();
      Object.assign(user,patch);return user;},
  };
  let saved=0;
  const sessions=new Sessions();
  const server=createApp(async reading=>{saved++;return {id:99,...reading};},async()=>[],async()=>[{nodeId:'LADERA-1'}],createSecurity(store,sessions)).listen(0,'127.0.0.1');
  await once(server,'listening'); t.after(()=>{server.closeAllConnections();return new Promise(r=>server.close(r));});
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  const request=(path,method='GET',body,token)=>fetch(base+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json','X-Landsis-Request':'1'}:{}),...(token?{Cookie:`landsis_session=${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  let adminToken,researchToken,conredToken;
  await t.test('acceso sin sesión a todos los GET protegidos',async()=>{for(const path of ['/nodes','/readings','/readings/latest','/users','/auth/me'])assert.equal((await request(path)).status,401);});
  await t.test('token inválido',async()=>assert.equal((await request('/auth/me','GET',undefined,'f'.repeat(64))).status,401));
  await t.test('login correcto y cookie segura sin hash/token en JSON',async()=>{
    const response=await request('/auth/login','POST',{email:' ADMIN@example.invalid ',password});assert.equal(response.status,200);
    const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Max-Age=28800/);
    adminToken=cookie.split(';')[0].split('=')[1]; const data=await response.json();assert.equal(data.user.role,'ADMINISTRADOR');assert.equal(JSON.stringify(data).includes(hash),false);assert.equal(data.token,undefined);
  });
  await t.test('contraseña incorrecta y correo inexistente mismo error',async()=>{
    const wrong=await request('/auth/login','POST',{email:users[0].email,password:'incorrecta'});
    const missing=await request('/auth/login','POST',{email:'missing@example.invalid',password});
    assert.equal(wrong.status,401);assert.equal(missing.status,401);assert.deepEqual(await wrong.json(),await missing.json());
  });
  await t.test('inactivo solo se informa tras comprobar contraseña',async()=>{
    assert.equal((await request('/auth/login','POST',{email:users[2].email,password})).status,403);
    assert.equal((await request('/auth/login','POST',{email:users[2].email,password:'incorrecta'})).status,401);
  });
  await t.test('auth/me y lecturas con sesión válida',async()=>{
    const response=await request('/auth/me','GET',undefined,adminToken);assert.equal(response.status,200);
    assert.equal((await response.json()).user.email,users[0].email);
    for(const path of ['/nodes','/readings'])assert.equal((await request(path,'GET',undefined,adminToken)).status,200);
    assert.equal((await request('/readings/latest','GET',undefined,adminToken)).status,404);
  });
  await t.test('investigador y CONRED acceden a dashboard sin administrar',async()=>{
    for(const [email,role] of [[users[1].email,'INVESTIGADOR'],[users[3].email,'CONRED']]){
      const response=await request('/auth/login','POST',{email,password});assert.equal(response.status,200);
      const token=response.headers.get('set-cookie').split(';')[0].split('=')[1];
      if(role==='INVESTIGADOR')researchToken=token;else conredToken=token;
      assert.equal((await request('/nodes','GET',undefined,token)).status,200);
      assert.equal((await request('/users','GET',undefined,token)).status,403);
      assert.equal((await request('/users','POST',{name:'Test',email:'test@example.invalid',password,role:'CONRED',active:true},token)).status,403);
      assert.equal((await request('/users/1','PATCH',{active:false},token)).status,403);
    }
  });
  await t.test('admin crea usuario sin exponer hash',async()=>{
    const response=await request('/users','POST',{name:' Nuevo ',email:'NEW@example.invalid',password,role:'CONRED',active:true},adminToken);
    assert.equal(response.status,201);const data=await response.json();assert.equal(data.user.email,'new@example.invalid');assert.equal('passwordHash' in data.user,false);
    assert.equal(await verifyPassword(password,users.at(-1).passwordHash),true);
  });
  await t.test('email duplicado',async()=>assert.equal((await request('/users','POST',{name:'Otro',email:'NEW@example.invalid',password,role:'CONRED',active:true},adminToken)).status,409));
  await t.test('contraseña inválida, rol y campos desconocidos',async()=>{
    const input={name:'Otro',email:'other@example.invalid',password,role:'CONRED',active:true};
    for(const patch of [{password:'short'},{role:'GEOLOGO'},{extra:true},{active:'true'}])assert.equal((await request('/users','POST',{...input,...patch},adminToken)).status,400);
  });
  await t.test('listado no expone hashes aunque store sea privado',async()=>{
    const response=await request('/users','GET',undefined,adminToken);assert.equal(response.status,200);
    for(const user of (await response.json()).users){assert.equal('passwordHash' in user,false);assert.equal('password' in user,false);}
  });
  await t.test('PATCH nombre/rol/estado y sesión lee rol actualizado',async()=>{
    const response=await request('/users/2','PATCH',{name:'Cambio',role:'CONRED'},adminToken);assert.equal(response.status,200);assert.equal((await response.json()).user.role,'CONRED');
    assert.equal((await (await request('/auth/me','GET',undefined,researchToken)).json()).user.role,'CONRED');
    assert.equal((await request('/users/4','PATCH',{active:false},adminToken)).status,200);
    assert.equal((await request('/auth/me','GET',undefined,conredToken)).status,401);
    users[3].active=true;assert.equal((await request('/auth/me','GET',undefined,conredToken)).status,401);
  });
  await t.test('último admin, PATCH inexistente e inválido',async()=>{
    assert.equal((await request('/users/1','PATCH',{active:false},adminToken)).status,409);
    assert.equal((await request('/users/999','PATCH',{name:'Cambio'},adminToken)).status,404);
    for(const path of ['/users/0','/users/1abc'])assert.equal((await request(path,'PATCH',{name:'Cambio'},adminToken)).status,400);
    assert.equal((await request('/users/2','PATCH',{password},adminToken)).status,400);
  });
  await t.test('mutaciones sin cabecera CSRF rechazadas y JSON inválido claro',async()=>{
    const response=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:users[0].email,password})});assert.equal(response.status,403);
    const malformed=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Landsis-Request':'1'},body:'{'});assert.equal(malformed.status,400);assert.equal((await malformed.text()).includes('SyntaxError'),false);
  });
  await t.test('POST readings sin auth humana sigue compatible',async()=>{
    assert.equal((await request('/readings','POST',{nodeId:'LADERA-1',soilMoistureRaw:4095,vibrationDetected:false})).status,201);assert.equal(saved,1);
  });
  await t.test('logout revoca sesión y elimina cookie',async()=>{
    const response=await request('/auth/logout','POST',{},adminToken);assert.equal(response.status,204);assert.match(response.headers.get('set-cookie'),/Expires=Thu, 01 Jan 1970/);
    assert.equal((await request('/auth/me','GET',undefined,adminToken)).status,401);
  });
  await t.test('limitación de intentos login',async()=>{
    for(let i=0;i<4;i++)await request('/auth/login','POST',{});
    assert.equal((await request('/auth/login','POST',{email:users[0].email,password})).status,429);
  });
});
