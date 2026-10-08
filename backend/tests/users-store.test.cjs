const assert = require('node:assert/strict');
const { test } = require('node:test');
const postgres = require('../dist/data/postgres.js');
const { userStore, UserConflict, LastAdmin } = require('../dist/data/users.js');
const { createInitialAdmin } = require('../dist/auth/bootstrap.js');
const { randomBytes } = require('node:crypto');
const row={id:7,name:'Prueba',email:'user@example.invalid',role:'INVESTIGADOR',active:true,createdAt:new Date(),passwordHash:'hash-sintetico'};
test('Persistencia users: SELECT/INSERT parametrizados y salida pública',async t=>{
 const original=postgres.getPool;t.after(()=>postgres.getPool=original);const calls=[];
 postgres.getPool=()=>({query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.startsWith('INSERT')?[{id:7}]:[row]};}});
 assert.equal((await userStore.findByEmail("x'@example.invalid")).passwordHash,row.passwordHash);
 assert.deepEqual(calls.at(-1).args,["x'@example.invalid"]);assert.equal(calls.at(-1).sql.includes("x'@"),false);
 assert.equal('passwordHash' in await userStore.findById(7),false);
 assert.equal('passwordHash' in (await userStore.list())[0],false);
 const input={name:'Prueba',email:'user@example.invalid',role:'CONRED',active:false};
 await userStore.create(input,'hash-sintetico');const insert=calls.find(c=>c.sql.startsWith('INSERT'));
 assert.deepEqual(insert.args,['Prueba','user@example.invalid','hash-sintetico','CONRED',false]);
 postgres.getPool=()=>({query:async()=>{throw Object.assign(new Error('interno'),{code:'23505'});}});
 await assert.rejects(userStore.create(input,'hash'),UserConflict);
});
test('PATCH serializa cambios y preserva último administrador',async t=>{
 const original=postgres.getPool;t.after(()=>postgres.getPool=original);
 for(const mode of ['update','last','missing','error']){
   const calls=[];let released=false;
   postgres.getPool=()=>({connect:async()=>({release:()=>{released=true},query:async(sql,args)=>{
     calls.push({sql,args});
     if(sql.includes('WHERE u.active'))return {rows:[{id:1}]};
     if(sql.startsWith('SELECT'))return {rows:mode==='missing'?[]:[{...row,role:mode==='last'?'ADMINISTRADOR':'INVESTIGADOR'}]};
     if(sql.startsWith('UPDATE')&&mode==='error')throw Error('interno');
     return {rows:[]};
   }})});
   if(mode==='last')await assert.rejects(userStore.patch(7,{active:false}),LastAdmin);
   else if(mode==='error')await assert.rejects(userStore.patch(7,{name:'Cambio'}));
   else if(mode==='missing')assert.equal(await userStore.patch(7,{name:'Cambio'}),null);
   else await userStore.patch(7,{name:'Cambio',active:false});
   assert.equal(calls[0].sql,'BEGIN');assert.match(calls[1].sql,/LOCK TABLE users/);
   assert.equal(calls.at(-1).sql,['last','error'].includes(mode)?'ROLLBACK':'COMMIT');assert.equal(released,true);
   if(mode==='update')assert.deepEqual(calls.find(c=>c.sql.startsWith('UPDATE')).args,[7,'Cambio','INVESTIGADOR',false]);
 }
});
test('Bootstrap admin: inserción segura, existente y rollback',async t=>{
 const original=postgres.getPool;t.after(()=>postgres.getPool=original);
 const password=randomBytes(18).toString('base64url');
 for(const mode of ['new','exists','error']){
   const calls=[];let released=false;
   postgres.getPool=()=>({connect:async()=>({release:()=>{released=true},query:async(sql,args)=>{
     calls.push({sql,args});
     if(sql.startsWith('SELECT'))return {rows:mode==='exists'?[{id:1}]:[]};
     if(sql.startsWith('INSERT')&&mode==='error')throw Error('interno');
     return {rows:[]};
   }})});
   const input={name:'Admin de prueba',email:'admin@example.invalid',password};
   if(mode==='error')await assert.rejects(createInitialAdmin(input));else assert.equal(await createInitialAdmin(input),mode==='new');
   assert.equal(calls[0].sql,'BEGIN');assert.match(calls[1].sql,/LOCK TABLE users/);
   const insert=calls.find(c=>c.sql.startsWith('INSERT'));
   if(mode==='exists')assert.equal(insert,undefined);else{assert.equal(insert.args[0],input.name);assert.match(insert.args[2],/^scrypt\$/);assert.equal(insert.args.includes(password),false);}
   assert.equal(calls.at(-1).sql,mode==='new'?'COMMIT':'ROLLBACK');assert.equal(released,true);
 }
});
