import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {receptionNow,receptionState,RECEPTION_TIMEOUT_MS} from '../src/reception';
import RiskPanel from '../src/components/RiskPanel';
import {startLatestPolling} from '../src/api/pollLatest';
import {getLatest,type LatestReading} from '../src/api/telemetry';
import type {Reading} from '../src/types/telemetry';
import type {Orientation} from '../src/types/orientation';
const receivedAt='2026-11-03T18:00:00Z', timestamp=Date.parse(receivedAt);
const ready:Orientation={status:'ready',roll:0,pitch:0,baselineRoll:0,baselinePitch:0,deltaRoll:0,deltaPitch:0,inclinationState:'NORMAL',precautionCount:0,alertCount:0,criticalCount:0};
const reading:Reading={id:1,nodeId:'A',receivedAt,soilMoistureRaw:0,vibrationDetected:false,accelX:null,accelY:null,accelZ:null,gyroX:null,gyroY:null,gyroZ:null,temperature:null};
const latest:LatestReading={reading,serverTime:timestamp+2500,requestedAt:100};
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()};

test('Recepción vence exactamente a los 60 segundos y fechas ausentes/futuras no son recientes',()=>{
  assert.equal(RECEPTION_TIMEOUT_MS,60000);
  assert.equal(receptionState(receivedAt,timestamp+59999),'fresh');
  assert.equal(receptionState(receivedAt,timestamp+60000),'stale');
  assert.equal(receptionState(undefined,timestamp),'missing');
  assert.equal(receptionState('no fecha',timestamp),'invalid');
  assert.equal(receptionState(receivedAt,timestamp-1),'invalid');
});
test('Lectura antigua deja los cuatro niveles grises y una nueva recepción los recupera',()=>{
  const before=renderToStaticMarkup(<RiskPanel orientation={ready} receivedAt={receivedAt} now={timestamp+59000}/>);
  assert.match(before,/data-active="true"/);
  for(const o of [ready,{...ready,inclinationState:'CRITICO' as const,deltaRoll:3,precautionCount:6,alertCount:6,criticalCount:6}]){
    const stale=renderToStaticMarkup(<RiskPanel orientation={o} receivedAt={receivedAt} now={timestamp+60000}/>);
    assert.doesNotMatch(stale,/data-active="true"/);assert.match(stale,/Sin datos recientes/);
  }
  const fresh=renderToStaticMarkup(<RiskPanel orientation={ready} receivedAt={new Date(timestamp+61000).toISOString()} now={timestamp+62000}/>);
  assert.match(fresh,/data-active="true"/);
  // Una consulta nueva que devuelve la misma fila antigua no renueva su vigencia.
  assert.equal(receptionState(reading.receivedAt,timestamp+120000),'stale');
});
test('La referencia de latest activa el semáforo con el reloj local atrasado y conserva el vencimiento',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  const serverTime=Date.parse('2026-11-07T23:49:46.000Z');
  const receivedAt='2026-11-07T23:49:43.501Z';
  globalThis.fetch=async (_url,options)=>{
    assert.equal(options?.cache,'no-store');
    return Response.json({reading:{...reading,receivedAt},serverTime});
  };
  const snapshot=await getLatest('A',new AbortController().signal);
  assert.ok(snapshot);
  const localNow=serverTime-10_000;
  const panel=(now:number)=>renderToStaticMarkup(<RiskPanel orientation={ready} receivedAt={snapshot.reading.receivedAt} now={now}/>);
  const at=(elapsed:number)=>receptionNow(snapshot.reading.receivedAt,snapshot.serverTime,snapshot.requestedAt,snapshot.requestedAt+elapsed);
  assert.match(panel(localNow),/Hora de recepción por verificar/);
  assert.match(panel(at(100)),/data-level="NORMAL" data-active="true"/);
  assert.match(panel(at(57_500)),/data-active="true"/);
  assert.match(panel(at(57_501)),/Sin datos recientes/);
  assert.doesNotMatch(panel(at(57_501)),/data-active="true"/);
  assert.equal(receptionState(receivedAt,receptionNow(receivedAt,Date.parse(receivedAt)-1,100,70_000)),'invalid');

  globalThis.fetch=async()=>Response.json({reading});
  await assert.rejects(getLatest('A',new AbortController().signal),/Invalid server time/);
});
test('Polling evita solicitudes solapadas, actualiza cada 10 s e ignora respuestas tras cerrar',async t=>{
  t.mock.timers.enable({apis:['setInterval','setTimeout']});t.after(()=>t.mock.timers.reset());
  let calls=0,signal:AbortSignal|undefined,resolve!: (r:LatestReading|null)=>void;const data:(LatestReading|null)[]=[];
  const polling=startLatestPolling('A',{onData:r=>data.push(r),onError:()=>assert.fail('error inesperado')},async(_node,s)=>{calls++;signal=s;return new Promise(r=>{resolve=r})});
  t.after(()=>polling.stop());assert.equal(calls,1);
  t.mock.timers.tick(10000);assert.equal(calls,1);
  resolve(latest);await flush();assert.equal(data.length,1);
  t.mock.timers.tick(10000);assert.equal(calls,2);
  polling.stop();assert.equal(signal?.aborted,true);resolve({...latest,reading:{...reading,id:2}});await flush();
  t.mock.timers.tick(30000);assert.equal(calls,2);assert.equal(data.length,1);
});
test('Timeout de consulta notifica error y el polling puede recuperarse',async t=>{
  t.mock.timers.enable({apis:['setInterval','setTimeout']});t.after(()=>t.mock.timers.reset());
  let calls=0,errors=0,updates=0;
  const polling=startLatestPolling('A',{onData:()=>updates++,onError:()=>errors++},async(_node,signal)=>{
    calls++;if(calls>1)return latest;
    return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}));
  });
  t.after(()=>polling.stop());t.mock.timers.tick(15000);await flush();assert.equal(errors,1);
  t.mock.timers.tick(10000);await flush();assert.ok(calls>=2);assert.ok(updates>=1);
});

test('Intervalos de minutos respetan el menú y modo manual conserva la consulta inmediata',async t=>{
  t.mock.timers.enable({apis:['setInterval','setTimeout']});t.after(()=>t.mock.timers.reset());
  for(const ms of [300000,600000,900000,1800000,3600000,0]){
    let calls=0;
    const polling=startLatestPolling('A',{onData:()=>{},onError:()=>assert.fail('error inesperado')},async()=>{calls++;return latest},ms);
    await flush();assert.equal(calls,1);
    if(ms>0){t.mock.timers.tick(ms-1);await flush();assert.equal(calls,1);t.mock.timers.tick(1);await flush();assert.equal(calls,2);}
    else {t.mock.timers.tick(3600000);await flush();assert.equal(calls,1);await polling.refresh();assert.equal(calls,2);}
    polling.stop();
  }
});
