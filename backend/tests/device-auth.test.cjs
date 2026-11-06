const {test} = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const {randomBytes} = require('node:crypto');
const http = require('node:http');
const {createApp} = require('../dist/app.js');
const {createDeviceAuth, deviceConfig} = require('../dist/auth/device.js');

test('Recepción IoT autentica, vincula nodo y conserva contrato', async t => {
  const token=randomBytes(32).toString('hex');
  let saves=0;
  const app=createApp(async value=>{saves++;return {...value,id:saves};},undefined,undefined,undefined,undefined,undefined,
    createDeviceAuth({IOT_NODE_ID:'LADERA-1',IOT_DEVICE_TOKEN:token}));
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>{server.closeAllConnections();return new Promise(r=>server.close(r));});
  const url=`http://127.0.0.1:${server.address().port}/api/v1/readings`;
  const reading={nodeId:'LADERA-1',soilMoistureRaw:123,vibrationDetected:false};
  const post=(credential,body=reading,path=url)=>fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...(credential!==undefined?{'X-Landsis-Device-Token':credential}:{})},body:JSON.stringify(body)});
  for(const invalid of [undefined,'',randomBytes(32).toString('hex'),'a'.repeat(63),'a'.repeat(65),'Bearer '+token]) {
    assert.equal((await post(invalid)).status,401);
  }
  // La cookie humana no sustituye el token del nodo.
  assert.equal((await fetch(url,{method:'POST',headers:{Cookie:'landsis_session='+token,'Content-Type':'application/json'},body:JSON.stringify(reading)})).status,401);
  const duplicate=await new Promise((resolve,reject)=>{
    const req=http.request(url,{method:'POST',headers:{'Content-Type':'application/json','X-Landsis-Device-Token':[token,token]}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject);req.end(JSON.stringify(reading));
  });
  assert.equal(duplicate,401);
  assert.equal(saves,0);
  assert.equal((await post(token,{...reading,nodeId:'OTRO'})).status,403);
  assert.equal((await post(token,{...reading,extra:true})).status,400);
  assert.equal((await post(token,{...reading,soilMoistureRaw:-1})).status,400);
  assert.equal((await post(token,{...reading,accelX:1})).status,400);
  assert.equal(saves,0);
  const accepted=await post(token); assert.equal(accepted.status,201);
  assert.deepEqual(await accepted.json(),{status:'accepted',reading:{...reading,id:1}});
  assert.equal((await post(token,reading,url+'/')).status,201);
  assert.equal(saves,2);
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{'X-Landsis-Device-Token':token}})).status,401);
  const proxy=app.get('trust proxy fn');
  assert.equal(proxy('127.0.0.1'),true);assert.equal(proxy('::1'),true);
  assert.equal(proxy('192.168.1.1'),false);assert.equal(proxy('203.0.113.1'),false);
  // Nginx debe sustituir esta cabecera; solo se acepta desde loopback.
  app.get('/test-ip',(req,res)=>res.json({ip:req.ip}));
  assert.deepEqual(await (await fetch(url.replace('/api/v1/readings','/test-ip'),{headers:{'X-Forwarded-For':'203.0.113.7'}})).json(),{ip:'203.0.113.7'});
});

test('Configuración ausente o inválida falla cerrada', async t=>{
  for(const env of [{},{IOT_NODE_ID:'LADERA-1',IOT_DEVICE_TOKEN:'placeholder'}]) {
    assert.equal(deviceConfig(env),null);
    const app=createApp(undefined,undefined,undefined,undefined,undefined,undefined,createDeviceAuth(env));
    const server=app.listen(0,'127.0.0.1');await once(server,'listening');
    try {
      const res=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/readings`,{method:'POST'});
      assert.equal(res.status,503);
    } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
  }
});
