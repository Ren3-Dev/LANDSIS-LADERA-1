import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import OrientationPanel from '../src/components/OrientationPanel';
import {DashboardView} from '../src/components/TelemetryViews';
import {getLatest} from '../src/api/telemetry';
import type {Orientation} from '../src/types/orientation';
const ready:Orientation={status:'ready',roll:0,pitch:-1,baselineRoll:0,baselinePitch:-1,deltaRoll:0,deltaPitch:0,inclinationState:'NORMAL',precautionCount:0,alertCount:0,criticalCount:0};
const reading={id:7,nodeId:'LADERA-1',receivedAt:'2026-11-03T18:00:00Z',soilMoistureRaw:0,vibrationDetected:false,accelX:0,accelY:0,accelZ:9.8,gyroX:0,gyroY:0,gyroZ:0,temperature:0};
test('Orientación muestra grados cero y distingue arranque/ausencia sin ceros ficticios',()=>{
  const html=renderToStaticMarkup(<OrientationPanel orientation={ready}/>);
  for(const text of ['DELTA ROLL','DELTA PITCH','0.00°','-1.00°','Baseline roll','NORMAL','independiente del riesgo global'])assert.ok(html.includes(text),text);
  for(const orientation of [undefined,{status:'calibrating'} as const,{status:'unavailable'} as const]){
    const h=renderToStaticMarkup(<OrientationPanel {...(orientation?{orientation}:{})}/>);
    assert.doesNotMatch(h,/0\.00°|DELTA ROLL/);
    assert.ok(h.includes(!orientation?'Esperando orientación':orientation.status==='calibrating'?'Calibrando referencia':'Sin lectura válida'));
  }
});
test('CRITICO de inclinación no activa el semáforo global',()=>{
  const o:Orientation={...ready,inclinationState:'CRITICO',deltaRoll:2.5,precautionCount:6,alertCount:6,criticalCount:6};
  const html=renderToStaticMarkup(<DashboardView reading={{...reading,orientation:o}} nodeId="LADERA-1" now={Date.parse(reading.receivedAt)+1000}/>);
  assert.ok(html.includes('Estado de inclinación: CRÍTICO'));assert.ok(html.includes('2.50°'));
  assert.match(html,/Riesgo global: no evaluado/);assert.equal((html.match(/data-active="true"/g)??[]).length,1);assert.doesNotMatch(html.slice(html.indexOf('class="global-risk-status"')),/data-active="true"/);
});

test('Tarjeta de inclinación muestra deltas y la temperatura solo queda en el detalle inferior',()=>{
  const html=renderToStaticMarkup(<DashboardView reading={{...reading,orientation:ready,temperature:24.827059}} nodeId="LADERA-1"/>);
  const cards=html.slice(html.indexOf('class="cards"'),html.indexOf('<section class="panel orientation-summary"'));
  assert.ok(cards.includes('INCLINACIÓN'));assert.ok(cards.includes('0.00°'));
  assert.doesNotMatch(cards,/24\.83|Temperatura|MPU6050/);
  assert.equal((html.match(/24\.83 °C/g)??[]).length,1);
  assert.doesNotMatch(html,/Telemetría MPU6050|Aceleración \(m\/s²\)|Giroscopio \(rad\/s\)/);
  for(const temperature of [null,undefined]){
    const detail=renderToStaticMarkup(<OrientationPanel orientation={ready} temperature={temperature}/>);
    assert.match(detail,/Sin lectura/);assert.doesNotMatch(detail,/Sin lectura °C/);
  }
});
test('Latest acepta orientación validada y legacy; rechaza bloques parciales y no finitos',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});
  const serverTime=Date.parse(reading.receivedAt)+2500;
  for(const o of [ready,{status:'calibrating'},{status:'unavailable'}]){
    globalThis.fetch=async()=>Response.json({reading:{...reading,orientation:o},serverTime});
    assert.deepEqual((await getLatest('LADERA-1',new AbortController().signal))?.reading.orientation,o);
  }
  globalThis.fetch=async()=>Response.json({reading,serverTime});assert.equal((await getLatest('LADERA-1',new AbortController().signal))?.reading.orientation,undefined);
  for(const o of [{status:'ready'},{...ready,deltaRoll:null},{...ready,deltaPitch:'1'},{...ready,criticalCount:7},{...ready,extra:0},null]){
    globalThis.fetch=async()=>Response.json({reading:{...reading,orientation:o},serverTime});
    await assert.rejects(getLatest('LADERA-1',new AbortController().signal),/Invalid reading/);
  }
});
