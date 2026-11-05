const assert=require('node:assert/strict');
const {test}=require('node:test');
const {once}=require('node:events');
const {createApp}=require('./authenticated-app.cjs');
const postgres=require('../dist/data/postgres.js');
const {listDailyReadings}=require('../dist/data/readings.js');
const nulls={accel_x:null,accel_y:null,accel_z:null,gyro_x:null,gyro_y:null,gyro_z:null,temperature:null};

test('Consulta diaria agrupa antes del límite, usa Guatemala y desempata por ID con filtros parametrizados',async t=>{
  const original=postgres.getPool;t.after(()=>{postgres.getPool=original});
  let query;
  postgres.getPool=()=>({query:async(sql,parameters)=>{query={sql,parameters};return{rows:[{...nulls,id:200,node_id:'LADERA-1',soil_moisture_raw:0,vibration_detected:false,received_at:new Date('2026-11-03T05:59:59Z')}]}}});
  const rows=await listDailyReadings(50,{nodeId:'LADERA-1',from:'2026-11-01T00:00:00Z',to:'2026-11-04T00:00:00Z'});
  assert.match(query.sql,/DISTINCT ON \(\(received_at AT TIME ZONE 'America\/Guatemala'\)::date\)/);
  assert.match(query.sql,/ORDER BY .*::date DESC, received_at DESC, id DESC/);
  assert.match(query.sql,/node_id = \$1/);assert.match(query.sql,/received_at >= \$2/);assert.match(query.sql,/received_at < \$3/);assert.match(query.sql,/LIMIT \$4/);
  assert.deepEqual(query.parameters,['LADERA-1','2026-11-01T00:00:00Z','2026-11-04T00:00:00Z',50]);
  assert.equal(rows[0].receivedAt,'2026-11-03T05:59:59.000Z');assert.equal(rows[0].soilMoistureRaw,0);assert.equal(rows[0].accelX,null);
  await listDailyReadings(1,{nodeId:'OTRO'});assert.deepEqual(query.parameters,['OTRO',1]);
  await assert.rejects(listDailyReadings(50),/nodeId/);
});

test('GET diario usa consulta independiente, exige nodo y valida filtros antes de consultar',async t=>{
  let calls=[];
  const daily=async(limit,filters)=>{calls.push({limit,filters});return[]};
  const app=createApp(undefined,async()=>{throw Error('No usar historial limitado para agrupar días')},undefined,daily);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()}));
  const url=`http://127.0.0.1:${server.address().port}/api/v1/readings/daily`;
  let response=await fetch(url+'?nodeId=LADERA-1');assert.equal(response.status,200);assert.deepEqual(await response.json(),{readings:[]});assert.deepEqual(calls.at(-1),{limit:50,filters:{nodeId:'LADERA-1'}});
  response=await fetch(url+'?nodeId=LADERA-1&limit=100&from=2026-11-01T00%3A00%3A00Z&to=2026-11-04T00%3A00%3A00Z');assert.equal(response.status,200);assert.equal(calls.at(-1).limit,100);assert.equal(calls.at(-1).filters.to,'2026-11-04T00:00:00Z');
  for(const q of ['', '?nodeId=', '?nodeId=A&nodeId=B','?nodeId=A&limit=101','?nodeId=A&limit=0','?nodeId=A&limit=1&limit=2','?nodeId=A&from=no','?nodeId=A&to=2026-02-30T00:00:00Z','?nodeId=A&extra=1','?nodeId=A&from=2026-11-04T00:00:00Z&to=2026-11-01T00:00:00Z']){
    const before=calls.length;assert.equal((await fetch(url+q)).status,400,q);assert.equal(calls.length,before);
  }
});

test('Ruta diaria mantiene autenticación y errores internos no se exponen',async t=>{
  const {createApp:realApp}=require('../dist/app.js');let called=false;
  const protectedServer=realApp(undefined,undefined,undefined,undefined,async()=>{called=true;return[]}).listen(0,'127.0.0.1');await once(protectedServer,'listening');
  const failingServer=createApp(undefined,undefined,undefined,async()=>{throw Error('detalle secreto SQL')}).listen(0,'127.0.0.1');await once(failingServer,'listening');
  t.after(()=>Promise.all([protectedServer,failingServer].map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()}))));
  assert.equal((await fetch(`http://127.0.0.1:${protectedServer.address().port}/api/v1/readings/daily?nodeId=LADERA-1`)).status,401);assert.equal(called,false);
  const response=await fetch(`http://127.0.0.1:${failingServer.address().port}/api/v1/readings/daily?nodeId=LADERA-1`);assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/detalle secreto SQL/);
});
