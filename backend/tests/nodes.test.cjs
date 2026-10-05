const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { createApp } = require('../dist/app.js');
const { parseReadingQuery } = require('../dist/readings/query.js');

test('Consultas HTTP por nodo y fechas', async (t) => {
  const rows = [
    { id: 3, nodeId: 'LADERA-2', receivedAt: '2026-10-03T00:00:00Z' },
    { id: 2, nodeId: 'LADERA-1', receivedAt: '2026-10-02T00:00:00Z' },
    { id: 1, nodeId: 'LADERA-1', receivedAt: '2026-10-01T00:00:00Z' },
  ];
  let nodes = [], calls = 0, failNodes = false;
  const server = createApp(undefined, async (limit, filters = {}) => {
    calls++;
    return rows.filter(r => (!filters.nodeId || r.nodeId === filters.nodeId)
      && (!filters.from || Date.parse(r.receivedAt) >= Date.parse(filters.from))
      && (!filters.to || Date.parse(r.receivedAt) < Date.parse(filters.to))).slice(0, limit);
  }, async () => { if (failNodes) throw Error('interno'); return nodes; }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  await t.test('nodes vacío', async () => assert.deepEqual(await (await fetch(base + '/nodes')).json(), { nodes: [] }));
  nodes = [{nodeId:'LADERA-1'}, {nodeId:'LADERA-2'}];
  await t.test('nodes varios', async () => assert.deepEqual(await (await fetch(base + '/nodes')).json(), { nodes }));
  for (const [query, ids] of [
    ['nodeId=LADERA-1', [2,1]], ['nodeId=LADERA-2', [3]], ['nodeId=ausente', []],
    ['nodeId=LADERA-1&limit=1', [2]], ['from=2026-10-02T00:00:00Z', [3,2]],
    ['to=2026-10-02T00:00:00Z', [1]],
    ['nodeId=LADERA-1&from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z&limit=10', [1]],
    ['nodeId=%20LADERA-1%20', []],
  ]) await t.test(query, async () => {
    const response = await fetch(base + '/readings?' + query);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).readings.map(r=>r.id), ids);
  });
  for (const [query, status, id] of [['',200,3], ['?nodeId=LADERA-1',200,2], ['?nodeId=ausente',404]])
    await t.test('latest ' + query, async () => {
      const response = await fetch(base + '/readings/latest' + query);
      assert.equal(response.status,status);
      if(id) assert.equal((await response.json()).reading.id,id);
    });
  for(const query of [
    'nodeId=', 'nodeId=A&nodeId=B', 'from=x', 'from=2026-02-30T00:00:00Z',
    'from=2026-10-01T00:00:00', 'from=2026-10-01T00:00:00Z&from=2026-10-02T00:00:00Z',
    'to=x', 'to=x&to=y', 'limit=1&limit=2', 'nodeId[x]=A', 'extra=x',
    'from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z',
    'from=2026-10-01T00:00:00Z&to=2026-10-01T00:00:00Z',
  ]) await t.test('400 ' + query, async () => {
    const before=calls;
    assert.equal((await fetch(base+'/readings?'+query)).status,400);
    assert.equal(calls,before);
  });
  await t.test('latest rechaza filtros no admitidos', async()=>assert.equal((await fetch(base+'/readings/latest?from=x')).status,400));
  failNodes=true;
  await t.test('nodes error genérico', async()=>{
    const response=await fetch(base+'/nodes');assert.equal(response.status,500);
    assert.deepEqual(await response.json(),{status:'error',message:'No se pudieron consultar los nodos.'});
  });
});

test('Fechas: calendario, zona y precisión explícitos', () => {
  for(const value of ['2024-02-29T23:59:59.123Z','2026-10-01T00:00:00-06:00']) assert.equal(parseReadingQuery({from:value}).filters.from,value);
  for(const value of ['2025-02-29T00:00:00Z','2026-13-01T00:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:00:00+24:00']) assert.throws(()=>parseReadingQuery({from:value}));
});

test('SQL parametrizado y orden estable del catálogo', async(t)=>{
  const postgres=require('../dist/data/postgres.js'); const original=postgres.getPool;
  t.after(()=>{postgres.getPool=original});
  const {listNodes}=require('../dist/data/nodes.js'); const {listReadings}=require('../dist/data/readings.js');
  postgres.getPool=()=>({query:async(sql,params)=>{
    if(sql.includes('FROM nodes')) {assert.match(sql,/ORDER BY node_id COLLATE "C"/);return {rows:[{node_id:' A '},{node_id:'A'}]};}
    assert.match(sql,/node_id = \$2 AND received_at >= \$3 AND received_at < \$4/);
    assert.match(sql,/ORDER BY received_at DESC, id DESC/);
    assert.deepEqual(params,[10,"A'",'2026-01-01T00:00:00Z','2027-01-01T00:00:00Z']);
    assert.equal(sql.includes("A'"),false);return {rows:[]};
  }});
  assert.deepEqual(await listNodes(),[{nodeId:' A '},{nodeId:'A'}]);
  await listReadings(10,{nodeId:"A'",from:'2026-01-01T00:00:00Z',to:'2027-01-01T00:00:00Z'});
});

test('POST transaccional: registro, commit y rollback', async(t)=>{
  const postgres=require('../dist/data/postgres.js');const original=postgres.getPool;
  t.after(()=>{postgres.getPool=original});const {insertReading}=require('../dist/data/readings.js');
  for(const fail of [false,true]) {
    const calls=[];let released=false;
    postgres.getPool=()=>({connect:async()=>({release(){released=true},query:async(sql,params)=>{
      calls.push(sql);
      if(sql.startsWith('INSERT INTO nodes')) {assert.deepEqual(params,[' NEW ']);assert.match(sql,/ON CONFLICT DO NOTHING/);}
      if(sql.startsWith('INSERT INTO sensor_readings')) {
        if(fail) throw Error('fallo');
        return {rows:[{id:1,node_id:' NEW ',soil_moisture_raw:0,vibration_detected:false,received_at:new Date(),accel_x:null,accel_y:null,accel_z:null,gyro_x:null,gyro_y:null,gyro_z:null,temperature:null}]};
      }
      return {rows:[]};
    }})});
    const reading={nodeId:' NEW ',soilMoistureRaw:0,vibrationDetected:false};
    if(fail) await assert.rejects(insertReading(reading));else assert.equal((await insertReading(reading)).nodeId,' NEW ');
    assert.equal(calls[0],'BEGIN');assert.match(calls[1],/^INSERT INTO nodes/);
    assert.equal(calls.at(-1),fail?'ROLLBACK':'COMMIT');assert.equal(released,true);
  }
});
