import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import RiskPanel from '../src/components/RiskPanel';
import type {Orientation} from '../src/types/orientation';
const receivedAt='2026-11-03T18:00:00Z';
const normal:Orientation={status:'ready',roll:0,pitch:0,baselineRoll:0,baselinePitch:0,deltaRoll:0,deltaPitch:0,inclinationState:'NORMAL',precautionCount:0,alertCount:0,criticalCount:0};

test('Semáforo activa un único nivel recibido y mantiene el riesgo global sin evaluar',()=>{
  for(const [state,label,counts] of [
    ['NORMAL','NORMAL',[0,0,0]],['PRECAUCION','PRECAUCIÓN',[6,0,0]],
    ['ALERTA','ALERTA',[6,6,0]],['CRITICO','CRÍTICO',[6,6,6]],
  ] as const){
    const orientation:Orientation={...normal,inclinationState:state,precautionCount:counts[0],alertCount:counts[1],criticalCount:counts[2]};
    const html=renderToStaticMarkup(<RiskPanel orientation={orientation} receivedAt={receivedAt} now={Date.parse(receivedAt)+1000}/>);
    assert.equal((html.match(/data-active="true"/g)??[]).length,1);
    assert.ok(html.includes(`data-level="${state}" data-active="true"`));
    assert.ok(html.includes(`<strong class="state">${label}</strong>`));
    assert.match(html,/SEMÁFORO EXPERIMENTAL DE INCLINACIÓN/);
    assert.match(html,/Riesgo global: no evaluado/);
    assert.doesNotMatch(html.slice(html.indexOf('class="global-risk-status"')),/data-active="true"/);
    assert.match(html,/datetime="2026-11-03T18:00:00Z"/i);
    assert.match(html,/gris tras 60 segundos/);
  }
});

test('Un delta aislado alto no reemplaza la persistencia del firmware',()=>{
  const orientation:Orientation={...normal,deltaRoll:10,deltaPitch:10,precautionCount:1,alertCount:1,criticalCount:1};
  const html=renderToStaticMarkup(<RiskPanel orientation={orientation} receivedAt={receivedAt} now={Date.parse(receivedAt)+1000}/>);
  assert.ok(html.includes('data-level="NORMAL" data-active="true"'));
  assert.ok(html.includes('data-level="CRITICO" data-active="false"'));
  assert.match(html,/Persistencia en observación/);
  assert.match(html,/crítico 1\/6/);
  const inconsistent=renderToStaticMarkup(<RiskPanel orientation={{...orientation,inclinationState:'CRITICO'}} receivedAt={receivedAt} now={Date.parse(receivedAt)+1000}/>);
  assert.doesNotMatch(inconsistent,/data-active="true"/);
  assert.match(inconsistent,/Persistencia sin confirmar/);
});

test('Sin orientación, calibrando, inválida o sin fecha no se da verde por defecto',()=>{
  for(const orientation of [undefined,{status:'calibrating'} as const,{status:'unavailable'} as const]){
    const html=renderToStaticMarkup(<RiskPanel orientation={orientation} receivedAt={receivedAt} now={Date.parse(receivedAt)+1000}/>);
    assert.equal((html.match(/data-active="false"/g)??[]).length,4);
    assert.doesNotMatch(html,/data-active="true"/);
    assert.ok(html.includes(!orientation?'Esperando orientación':orientation.status==='calibrating'?'Calibrando referencia':'Sin lectura válida'));
  }
  assert.doesNotMatch(renderToStaticMarkup(<RiskPanel orientation={normal} receivedAt={undefined}/>),/data-active="true"/);
});
