import test from 'node:test';
import assert from 'node:assert/strict';
import {isCompanionDevice,visibleSchedules,sameCue,remoteCue} from '../sync-staging/hwp-mobile-companion.mjs';
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
