import test from 'node:test';
import assert from 'node:assert/strict';
import {isCompanionDevice,visibleSchedules,sameCue,remoteCue,selectAvailable,cameraRoster,commandFeedback} from '../sync-staging/hwp-mobile-companion.mjs';
const cue={itemId:'row',presentationId:'p',slideId:'s',cueIndex:1};
test('mobile detection preserves desktop by default and supports explicit QA override',()=>{
 assert.equal(isCompanionDevice('',()=>({matches:false})),false);
 assert.equal(isCompanionDevice('',()=>({matches:true})),true);
 assert.equal(isCompanionDevice('?companion=0',()=>({matches:true})),false);
 assert.equal(isCompanionDevice('?companion=1',()=>({matches:false})),true);
});
test('only published scheduled services are shown',()=>{
 assert.deepEqual(visibleSchedules({playlists:[{id:'a',hwpScheduleId:'a'},{id:'b'},{id:'c',hwpScheduleId:'c',hwpSchedulePublished:false}]},x=>x).map(x=>x.id),['a']);
});
test('live selection requires exact enabled cue on connected receiver',()=>{
 const status={online:true,songs:[{itemId:'row',presentationId:'p',slides:[{slideId:'s',cueIndex:1,enabled:true}]}]};
 assert.equal(remoteCue(status,cue),true);
 for(const change of [{itemId:'other'},{presentationId:'other'},{slideId:'other'},{cueIndex:0}])assert.equal(remoteCue(status,{...cue,...change}),false);
 assert.equal(remoteCue({...status,online:false},cue),false);
 status.songs[0].slides[0].enabled=false;assert.equal(remoteCue(status,cue),false);
 assert.equal(sameCue(cue,{...cue,cueIndex:2}),false);
 assert.equal(sameCue(cue,{...cue}),true);
});

test('selection is retained across refreshed rows without following the active remote cue',()=>{
 const rows=[{id:'a'},{id:'b'}];
 assert.equal(selectAvailable(rows,'b').id,'b');
 assert.equal(selectAvailable([{id:'a'}],'b').id,'a');
 assert.equal(selectAvailable([],'b'),null);
});
test('camera roster contains only named saved views, not invented sources or credentials',()=>{
 assert.deepEqual(cameraRoster({cameraViews:[{id:'c',name:' Camera 1 ',color:'#aaa',deviceId:'private'},{id:'x',name:' '},null]}),[{id:'c',name:'Camera 1',color:'#aaa'}]);
 assert.deepEqual(cameraRoster(null),[]);
});
test('remote acknowledgement requires the exact service, command, and live cue',()=>{
 const command={id:'cmd',serviceId:'a',expiresAt:100,target:cue};
 const applied={serviceId:'a',command:{id:'cmd',status:'applied'},active:cue};
 assert.equal(commandFeedback(applied,command,50),'applied');
 assert.equal(commandFeedback({...applied,serviceId:'b'},command,50),null);
 assert.equal(commandFeedback({...applied,command:{id:'old',status:'applied'}},command,50),null);
 assert.equal(commandFeedback({...applied,active:{...cue,cueIndex:99}},command,50),null);
 assert.equal(commandFeedback({serviceId:'a',command:{id:'cmd',status:'rejected'}},command,50),'rejected');
 assert.equal(commandFeedback({serviceId:'a'},command,101),'rejected');
});
