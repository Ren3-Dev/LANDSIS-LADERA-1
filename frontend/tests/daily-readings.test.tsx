import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import DailyReadings from '../src/components/DailyReadings';
import {HistoryView} from '../src/components/TelemetryViews';
import {getDailyHistory} from '../src/api/telemetry';
import type {Reading} from '../src/types/telemetry';
const reading:Reading={id:1,nodeId:'LADERA-1',receivedAt:'2026-11-03T05:59:59Z',soilMoistureRaw:0,vibrationDetected:false,accelX:null,accelY:null,accelZ:null,gyroX:null,gyroY:null,gyroZ:null,temperature:null};

test('Mediciones diarias se muestran primero sin reemplazar el historial detallado',()=>{
  const html=renderToStaticMarkup(<HistoryView readings={[reading,{...reading,id:2}]} dailyReadings={[reading]}/>);
  assert.ok(html.indexOf('Mediciones diarias')<html.indexOf('Humedad del suelo — %'));
  assert.ok(html.indexOf('Mediciones diarias')<html.indexOf('Historial de mediciones almacenadas'));
  assert.match(html,/1 día con datos/);assert.match(html,/2 lecturas/);
  assert.match(html,/última recibida del nodo dentro del intervalo consultado/);
  const empty=renderToStaticMarkup(<DailyReadings readings={[]}/>);assert.match(empty,/No hay mediciones diarias/);
});
test('Día y hora se muestran en Guatemala incluso al cruzar medianoche UTC',()=>{
  const html=renderToStaticMarkup(<DailyReadings readings={[reading]}/>);
  assert.ok(html.includes(new Intl.DateTimeFormat('es-GT',{timeZone:'America/Guatemala',dateStyle:'medium'}).format(new Date(reading.receivedAt))));
  assert.match(html,/2[\/ ](?:11|nov)/);assert.match(html,/No detectada/);assert.match(html,/class="raw-cell">100 % · RAW 0</);
});
test('Cliente diario consulta endpoint propio con filtros y valida las filas',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});let url='';
  globalThis.fetch=async input=>{url=String(input);return Response.json({readings:[reading]})};
  const filters={limit:20,from:'2026-11-01T00:00:00Z',to:'2026-11-04T00:00:00Z'};
  assert.deepEqual(await getDailyHistory('LADERA-1',new AbortController().signal,filters),[reading]);
  const parsed=new URL(url,'http://localhost');assert.match(parsed.pathname,/readings\/daily$/);assert.equal(parsed.searchParams.get('limit'),'20');assert.equal(parsed.searchParams.get('from'),filters.from);assert.equal(parsed.searchParams.get('nodeId'),'LADERA-1');
  for(const invalid of [{...reading,nodeId:'OTRO'},{...reading,accelX:1}]){
    globalThis.fetch=async()=>Response.json({readings:[invalid]});await assert.rejects(getDailyHistory('LADERA-1',new AbortController().signal),/Invalid history/);
  }
});
