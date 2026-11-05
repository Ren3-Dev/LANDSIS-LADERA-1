import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import App from '../src/App';

test('Dashboard, historial y estado se enfocan en LADERA-1 sin selector ni catálogo de nodos',()=>{
  for(const page of ['dashboard','history','node'] as const){
    const html=renderToStaticMarkup(<App page={page}/>);
    assert.doesNotMatch(html,/select id="node"|Nodo seleccionado|Cargando catálogo|Sin nodos disponibles|No hay nodos registrados/);
    assert.match(html,/LADERA-1/);
    assert.match(html,/Actualizar ahora/);
    assert.match(html,/Cargando mediciones de LADERA-1/);
    assert.doesNotMatch(html,/class="toolbar|single-node-toolbar/);
    if(page!=='history') for(const label of ['Actualización de pantalla','10 segundos (pruebas)','5 minutos','10 minutos','15 minutos','30 minutos','1 hora','Solo manual']) assert.ok(html.includes(label),label);
    if(page==='history'){
      assert.match(html,/Desde \(incluido/);assert.match(html,/Hasta \(excluido/);assert.match(html,/Consultar historial/);
    }
  }
});
