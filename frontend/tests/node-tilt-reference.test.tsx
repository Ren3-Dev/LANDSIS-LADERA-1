import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import NodeTiltReference from '../src/components/NodeTiltReference';
import type {Orientation} from '../src/types/orientation';
const receivedAt='2026-11-03T18:00:00Z',now=Date.parse(receivedAt)+1000;
const ready:Orientation={status:'ready',roll:7,pitch:-2,baselineRoll:5,baselinePitch:1,deltaRoll:2,deltaPitch:-3,inclinationState:'NORMAL',precautionCount:0,alertCount:0,criticalCount:0};

test('Referencia usa deltas reales con su signo, dos ejes y baseline visual fijo',()=>{
  const html=renderToStaticMarkup(<NodeTiltReference orientation={ready} receivedAt={receivedAt} now={now}/>);
  assert.equal((html.match(/class="node-tilt-moving"/g)??[]).length,2);
  assert.match(html,/rotate\(2deg\)/);assert.match(html,/rotate\(-3deg\)/);
  assert.doesNotMatch(html,/rotate\(7deg\)/);
  assert.match(html,/2\.00°/);assert.match(html,/-3\.00°/);assert.match(html,/Escala visual 1:1/);
  assert.match(html,/no representan desplazamiento del terreno/);
  const zero=renderToStaticMarkup(<NodeTiltReference orientation={{...ready,deltaRoll:0,deltaPitch:0}} receivedAt={receivedAt} now={now}/>);
  assert.equal((zero.match(/class="node-tilt-moving"/g)??[]).length,2);assert.match(zero,/0\.00°/);
});
test('Sin datos recientes o válidos solo muestra referencia neutral, sin ángulos inventados',()=>{
  for(const orientation of [undefined,{status:'calibrating'} as const,{status:'unavailable'} as const,{...ready,deltaRoll:NaN}]){
    const html=renderToStaticMarkup(<NodeTiltReference orientation={orientation} receivedAt={receivedAt} now={now}/>);
    assert.doesNotMatch(html,/class="node-tilt-moving"|rotate\(|NaN|0\.00°/);
  }
  for(const time of [Date.parse(receivedAt)+60000,Date.parse(receivedAt)-1]){
    const html=renderToStaticMarkup(<NodeTiltReference orientation={ready} receivedAt={receivedAt} now={time}/>);
    assert.doesNotMatch(html,/class="node-tilt-moving"|rotate\(/);
  }
  assert.match(renderToStaticMarkup(<NodeTiltReference orientation={ready} receivedAt={receivedAt} now={Date.parse(receivedAt)+60000}/>),/Sin datos recientes/);
});
