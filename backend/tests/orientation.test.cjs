const assert=require('node:assert/strict');
const {test}=require('node:test');
const {once}=require('node:events');
const {isReading}=require('../dist/readings/reading.js');
const {isOrientation,LatestOrientation}=require('../dist/readings/orientation.js');
const {createApp}=require('./authenticated-app.cjs');
const mpu={accelX:0,accelY:0,accelZ:9.8,gyroX:0,gyroY:0,gyroZ:0,temperature:0};
const base={nodeId:'LADERA-1',soilMoistureRaw:4095,vibrationDetected:false,...mpu};
const ready={status:'ready',roll:0,pitch:0,baselineRoll:0,baselinePitch:0,deltaRoll:0,deltaPitch:0,inclinationState:'NORMAL',precautionCount:0,alertCount:0,criticalCount:0};

test('Orientación opcional estricta, ceros válidos, estados de arranque y legacy',()=>{
  assert.equal(isReading(base),true);
  for(const orientation of [ready,{status:'calibrating'},{status:'unavailable'}]) assert.equal(isReading({...base,orientation}),true);
  for(const orientation of [null,{},[],{status:'ready'}, {...ready,extra:1},{...ready,roll:NaN},{...ready,pitch:Infinity},{...ready,criticalCount:-1},{...ready,criticalCount:7},{...ready,alertCount:1.5},{...ready,inclinationState:'riesgo global'},{status:'calibrating',deltaRoll:0}]) assert.equal(isReading({...base,orientation}),false);
  for(const k of Object.keys(ready)){const partial={...ready};delete partial[k];assert.equal(isOrientation(partial),false,k);}
  assert.equal(isReading({nodeId:'LADERA-1',soilMoistureRaw:0,vibrationDetected:false,orientation:ready}),false);
});

test('Caché acotada separa IDs/nodos, soporta commits fuera de orden y reinicio',()=>{
  const cache=new LatestOrientation();
  cache.remember({id:2,nodeId:'A'},ready);cache.remember({id:1,nodeId:'A'},{status:'calibrating'});
  assert.deepEqual(cache.forReading({id:2,nodeId:'A'}),ready);
  assert.equal(cache.forReading({id:2,nodeId:'B'}),undefined);
  assert.equal(cache.forReading({id:3,nodeId:'A'}),undefined);
  assert.equal(new LatestOrientation().forReading({id:2,nodeId:'A'}),undefined);
  for(let id=3;id<=258;id++)cache.remember({id,nodeId:'A'},ready);
  assert.equal(cache.forReading({id:2,nodeId:'A'}),undefined);
});

test('POST confirma persistencia antes de exponer grados; latest exacto, historial y legacy intactos',async t=>{
  let rows=[],nextId=0,fail=false;
  const app=createApp(async value=>{
    assert.equal(Object.hasOwn(value,'orientation'),false);
    if(fail)throw Error('fallo simulado');
    const row={...value,id:++nextId,receivedAt:new Date().toISOString()};rows.unshift(row);return row;
  },async(limit,filters)=>rows.filter(r=>!filters?.nodeId||r.nodeId===filters.nodeId).slice(0,limit));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const url=`http://127.0.0.1:${server.address().port}/api/v1/readings`;
  const post=value=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
  assert.equal((await post({...base,orientation:ready})).status,201);
  let latest=await(await fetch(url+'/latest?nodeId=LADERA-1')).json();assert.deepEqual(latest.reading.orientation,ready);
  let history=await(await fetch(url)).json();assert.equal(Object.hasOwn(history.readings[0],'orientation'),false);
  assert.equal((await post({...base,nodeId:'OTRO',orientation:{status:'calibrating'}})).status,201);
  latest=await(await fetch(url+'/latest?nodeId=LADERA-1')).json();assert.deepEqual(latest.reading.orientation,ready);
  assert.equal((await post(base)).status,201);
  latest=await(await fetch(url+'/latest?nodeId=LADERA-1')).json();assert.equal(Object.hasOwn(latest.reading,'orientation'),false);
  fail=true;assert.equal((await post({...base,orientation:ready})).status,500);
  latest=await(await fetch(url+'/latest?nodeId=LADERA-1')).json();assert.equal(Object.hasOwn(latest.reading,'orientation'),false);
  assert.equal((await post({...base,orientation:{...ready,deltaRoll:null}})).status,400);
});
