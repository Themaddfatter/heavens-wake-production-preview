import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('HWP exposes only inside service rows attached to the Sermon header and validates every cue',()=>{
 const start=html.indexOf('function hwpSermonRows('),end=html.indexOf('function hwpWorshipActive(',start);
 assert.ok(start>=0&&end>start);
 const helpers=new Function(html.slice(start,end)+`
 function hwpServiceZone(row){return row.serviceZone||'inside'}
 function hwpPermanentServiceName(row){return row.permanentHeaderKey==='sermon'||row.header==='Sermon'?'Sermon':null}
 function Ce(p){return p.slides.map((slide,index)=>({slide,index,group:p.groups[0]}))}
 function hwpBibleVisibleObjects(s){return s.objects||[]}
 return {hwpSermonRows,hwpSermonManifest,hwpSermonTarget,hwpSermonActive};
 `)();
 const p={id:'p',name:'Reference',category:'scripture',groups:[{name:'Reading'}],slides:[{id:'s',objects:[{kind:'text',text:'Actual scripture'}]},{id:'off',enabled:false}]};
 const service={hwpScheduleId:'service',items:[{id:'h',header:'Sermon',permanentHeaderKey:'sermon'},{id:'praise',header:'Praise Songs'},{id:'row',presentationId:'p',groupHeaderId:'h'},{id:'other',presentationId:'p',groupHeaderId:'praise'},{id:'after',presentationId:'p',groupHeaderId:'h',serviceZone:'after'}]};
 const state={doc:{presentations:[p],settings:{bible:{}}},live:{hwpScheduleId:'service',hwpServiceItemId:'row',presentationId:'p',slideId:'s',cueIndex:0}};
 const target={itemId:'row',presentationId:'p',slideId:'s',cueIndex:0};
 assert.deepEqual(helpers.hwpSermonRows(service).map(row=>row.id),['row']);
 assert.equal(helpers.hwpSermonManifest(state,service)[0].slides[0].text,'Actual scripture');
 assert.deepEqual(helpers.hwpSermonTarget(state,service,target),target);
 assert.equal(helpers.hwpSermonTarget(state,service,{...target,itemId:'other'}),null);
 assert.equal(helpers.hwpSermonTarget(state,service,{...target,slideId:'off',cueIndex:1}),null);
 assert.deepEqual(helpers.hwpSermonActive(state,service),target);
 assert.equal(helpers.hwpSermonActive({...state,live:{...state.live,hwpServiceItemId:'other'}},service),null);
});
test('HWP remote scope preserves worship and verifies sermon commands independently',()=>{
 assert.ok(html.includes('command.scope==="sermon"?hwpSermonTarget'));
 assert.ok(html.includes('verified=t.scope==="sermon"?hwpSermonTarget'));
 assert.ok(html.includes('payload.sermons=sermons'));
 assert.ok(html.includes('payload.sermonPreviewSnapshot=sermonPreviewSnapshot'));
 assert.ok(html.includes('scope:command.scope'));
});