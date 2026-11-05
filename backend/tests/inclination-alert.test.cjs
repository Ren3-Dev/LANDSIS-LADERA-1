const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createInclinationNotifier,alertSignal}=require('../dist/alerts/notifier.js');
const {inclinationAlertTemplate}=require('../dist/mail/inclination-template.js');
const {alertEmailEnabled}=require('../dist/config/alerts.js');
const {createAcceptReading}=require('../dist/controllers/readings.js');
const reading=(id=1,patch={})=>({id,nodeId:'LADERA-1',receivedAt:new Date().toISOString(),soilMoistureRaw:4095,vibrationDetected:false,orientation:{status:'ready',roll:2.5,pitch:0,baselineRoll:0,baselinePitch:0,deltaRoll:2.5,deltaPitch:0,inclinationState:'CRITICO',precautionCount:6,alertCount:6,criticalCount:6,...patch}});
function store(){let active=false,last=0;return {counts:[],async claim(r,s){if(r.id<=last)return false;last=r.id;if(s==='normal')active=false;if(s!=='critical'||active)return false;active=true;return true;},async finish(n,id,c){this.counts.push(c)},async fail(){}}}
test('critical requires ready state, threshold and full persistence',()=>{
 assert.equal(alertSignal(reading()),'critical');
 assert.equal(alertSignal(reading(1,{criticalCount:5})),'other');
 assert.equal(alertSignal(reading(1,{deltaRoll:1.9})),'other');
 assert.equal(alertSignal({...reading(),orientation:{status:'calibrating'}}),'other');
});
test('active users, unique individual recipients, failure continues and persisted latch rearms only at normal',async()=>{
 const state=store(),sent=[];const opts={store:state,users:{list:async()=>[{active:true,email:'A@example.com'},{active:true,email:'a@example.com'},{active:false,email:'inactive@example.com'},{active:true,email:'bad'},{active:true,email:'b@example.com'}]},mail:{send:async m=>{sent.push(m);if(m.to==='a@example.com')throw Error('SMTP')}},onError:()=>{}};
 let n=createInclinationNotifier(opts);n.observe(reading());await n.idle();assert.equal(sent.length,2);assert.deepEqual(state.counts[0],{accepted:1,failed:1,skipped:1});assert.ok(sent.every(m=>!m.cc&&!m.bcc));
 n=createInclinationNotifier(opts);n.observe(reading(2));n.observe({...reading(3),orientation:{status:'calibrating'}});n.observe(reading(4));await n.idle();assert.equal(sent.length,2);
 n.observe(reading(5,{inclinationState:'NORMAL',deltaRoll:0,precautionCount:0,alertCount:0,criticalCount:0}));n.observe(reading(6));await n.idle();assert.equal(sent.length,4);
});
test('mail template reports RAW and real vibration without inventing global danger',()=>{const c=inclinationAlertTemplate({...reading(),nodeId:'<script>'});assert.match(c.text,/4095 RAW ADC/);assert.match(c.text,/No detectada/);assert.match(c.text,/6\/6/);assert.ok(c.html.includes('&lt;script&gt;'));assert.ok(!c.html.includes('<script>'));});
test('disabled by default, invalid switch rejected',()=>{assert.equal(alertEmailEnabled({}),false);assert.equal(alertEmailEnabled({ALERT_EMAIL_ENABLED:'true'}),true);assert.throws(()=>alertEmailEnabled({ALERT_EMAIL_ENABLED:'yes'}));});
test('notification failure cannot reject committed measurement',async()=>{let code;const res={status(c){code=c;return this},json(){return this}};await createAcceptReading(async()=>reading(),undefined,()=>{throw Error('observer')})({body:{nodeId:'LADERA-1',soilMoistureRaw:10,vibrationDetected:false},is:()=>true},res);assert.equal(code,201);});
test('pending mail does not block receiving controller',async()=>{let release;const pending=new Promise(r=>release=r);const n=createInclinationNotifier({store:store(),users:{list:async()=>[{active:true,email:'a@example.com'}]},mail:{send:()=>pending},onError:()=>{}});let code;await createAcceptReading(async()=>reading(),undefined,n.observe)({body:{nodeId:'LADERA-1',soilMoistureRaw:10,vibrationDetected:false,accelX:0,accelY:0,accelZ:9.8,gyroX:0,gyroY:0,gyroZ:0,temperature:25,orientation:reading().orientation},is:()=>true},{status(c){code=c;return this},json(){}});assert.equal(code,201);release();await n.idle();});
