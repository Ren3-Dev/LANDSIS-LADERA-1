import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {receptionState,RECEPTION_TIMEOUT_MS} from '../src/reception';
import RiskPanel from '../src/components/RiskPanel';
import {startLatestPolling} from '../src/api/pollLatest';
import type {Reading} from '../src/types/telemetry';
import type {Orientation} from '../src/types/orientation';
const receivedAt='2026-11-03T18:00:00Z', timestamp=Date.parse(receivedAt);
const ready:Orientation={status:'ready',roll:0,pitch:0,baselineRoll:0,baselinePitch:0,deltaRoll:0,deltaPitch:0,inclinationState:'NORMAL',precautionCount:0,alertCount:0,criticalCount:0};
const reading:Reading={id:1,nodeId:'A',receivedAt,soilMoistureRaw:0,vibrationDetected:false,accelX:null,accelY:null,accelZ:null,gyroX:null,gyroY:null,gyroZ:null,temperature:null};
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
test('Polling evita solicitudes solapadas, actualiza cada 10 s e ignora respuestas tras cerrar',async t=>{
  t.mock.timers.enable({apis:['setInterval','setTimeout']});t.after(()=>t.mock.timers.reset());
  let calls=0,signal:AbortSignal|undefined,resolve!: (r:Reading|null)=>void;const data:(Reading|null)[]=[];
  const polling=startLatestPolling('A',{onData:r=>data.push(r),onError:()=>assert.fail('error inesperado')},async(_node,s)=>{calls++;signal=s;return new Promise(r=>{resolve=r})});
  t.after(()=>polling.stop());assert.equal(calls,1);
  t.mock.timers.tick(10000);assert.equal(calls,1);
  resolve(reading);await flush();assert.equal(data.length,1);
  t.mock.timers.tick(10000);assert.equal(calls,2);
  polling.stop();assert.equal(signal?.aborted,true);resolve({...reading,id:2});await flush();
  t.mock.timers.tick(30000);assert.equal(calls,2);assert.equal(data.length,1);
});
test('Timeout de consulta notifica error y el polling puede recuperarse',async t=>{
  t.mock.timers.enable({apis:['setInterval','setTimeout']});t.after(()=>t.mock.timers.reset());
  let calls=0,errors=0,updates=0;
  const polling=startLatestPolling('A',{onData:()=>updates++,onError:()=>errors++},async(_node,signal)=>{
    calls++;if(calls>1)return reading;
    return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}));
  });
  t.after(()=>polling.stop());t.mock.timers.tick(15000);await flush();assert.equal(errors,1);
  t.mock.timers.tick(10000);await flush();assert.ok(calls>=2);assert.ok(updates>=1);
});

test('Intervalos de minutos respetan el menú y modo manual conserva la consulta inmediata',async t=>{
  t.mock.timers.enable({apis:['setInterval','setTimeout']});t.after(()=>t.mock.timers.reset());
  for(const ms of [300000,600000,900000,1800000,3600000,0]){
    let calls=0;
    const polling=startLatestPolling('A',{onData:()=>{},onError:()=>assert.fail('error inesperado')},async()=>{calls++;return reading},ms);
    await flush();assert.equal(calls,1);
    if(ms>0){t.mock.timers.tick(ms-1);await flush();assert.equal(calls,1);t.mock.timers.tick(1);await flush();assert.equal(calls,2);}
    else {t.mock.timers.tick(3600000);await flush();assert.equal(calls,1);await polling.refresh();assert.equal(calls,2);}
    polling.stop();
  }
});
