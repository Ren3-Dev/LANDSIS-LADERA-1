import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardView, HistoryView, NodeStatusView } from '../src/components/TelemetryViews';
import { formatVibration } from '../src/presentation';
import { getHistory, getLatest } from '../src/api/telemetry';
import type { Reading } from '../src/types/telemetry';
const reading: Reading = { id:1,nodeId:'PRUEBA',soilMoistureRaw:0,vibrationDetected:false,receivedAt:'2026-10-05T12:00:00Z',accelX:null,accelY:null,accelZ:null,gyroX:null,gyroY:null,gyroZ:null,temperature:null };
test('Dashboard muestra RAW, vibración y riesgo pendiente sin conversiones', () => {
  for (const detected of [true,false]) {
    const html=renderToStaticMarkup(<DashboardView reading={{...reading,vibrationDetected:detected}} nodeId="PRUEBA"/>);
    assert.match(html,/Lectura RAW — pendiente de calibración/); assert.match(html,/Pendiente de configuración/); assert.ok(html.includes(formatVibration(detected))); assert.doesNotMatch(html,/humedad %|ambiental|averiado/);
  }
});
test('Estado del nodo distingue bloque MPU completo y null sin diagnosticar fallos ADC', () => {
  for (const raw of [0,4095]) for (const available of [true,false]) {
    const r={...reading,soilMoistureRaw:raw,...(available ? {accelX:0,accelY:0,accelZ:0,gyroX:0,gyroY:0,gyroZ:0,temperature:0} : {})};
    const html=renderToStaticMarkup(<NodeStatusView reading={r}/>);
    assert.ok(html.includes(available ? 'Telemetría MPU disponible' : 'Sin telemetría MPU')); assert.match(html,/Datos recibidos/); assert.match(html,/Lectura disponible/); assert.match(html,/Lectura digital disponible/); assert.doesNotMatch(html,/averiado/);
  }
});
test('Vistas manejan nodo sin mediciones e historial vacío', () => {
  assert.match(renderToStaticMarkup(<NodeStatusView reading={null}/>),/Sin datos/);
  assert.match(renderToStaticMarkup(<DashboardView reading={null} nodeId="PRUEBA"/>),/Sin lectura/);
  assert.match(renderToStaticMarkup(<HistoryView readings={[]}/>),/No hay mediciones/);
  assert.equal(formatVibration(null),'Sin lectura');
});
test('Historial muestra tabla simplificada, gráfico y detalles MPU', () => {
  const html=renderToStaticMarkup(<HistoryView readings={[reading]}/>);
  for (const text of ['Fecha/hora','Humedad RAW','Vibración','MPU disponible','Ver MPU','No detectada','Sin telemetría MPU']) assert.ok(html.includes(text));
});
test('API historial envía filtros existentes, latest sin mediciones y rechaza MPU parcial', async t => {
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  let url='';globalThis.fetch=async input=>{url=String(input);return Response.json({readings:[reading]});};
  const from='2026-10-01T00:00:00.000Z',to='2026-10-06T00:00:00.000Z';
  assert.deepEqual(await getHistory('PRUEBA',new AbortController().signal,{limit:10,from,to}),[reading]);
  const query=new URL(url,'http://localhost').searchParams;assert.equal(query.get('limit'),'10');assert.equal(query.get('from'),from);assert.equal(query.get('to'),to);
  globalThis.fetch=async()=>new Response(null,{status:404});assert.equal(await getLatest('PRUEBA',new AbortController().signal),null);
  globalThis.fetch=async()=>Response.json({readings:[{...reading,accelX:1}]});await assert.rejects(getHistory('PRUEBA',new AbortController().signal),/Invalid history/);
});
import type { User } from '../src/types/user';
import UserNavigation from '../src/components/UserNavigation';
test('Cada vista tiene un único destino activo en la navegación', () => {
  const user: User = {id:1,name:'Demo',email:'demo@example.invalid',role:'ADMINISTRADOR',active:true,createdAt:reading.receivedAt};
  for (const page of ['dashboard','history','node','users'] as const) {
    const html=renderToStaticMarkup(<UserNavigation user={user} page={page} onPage={()=>{}} onLogout={()=>{}} busy={false}/>);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length,1);
  }
});
