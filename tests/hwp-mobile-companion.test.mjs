import test from 'node:test';
import assert from 'node:assert/strict';
import {isCompanionDevice,visibleSchedules,sameCue,remoteCue,selectAvailable,cameraRoster,commandFeedback,normalizeAppearance,searchSongs} from '../sync-staging/hwp-mobile-companion.mjs';
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

test('mobile appearance uses valid account colors and desktop defaults',()=>{
 assert.deepEqual(normalizeAppearance({appearance:'light',accent:'#ABCDEF'}),{appearance:'light',accent:'#abcdef'});
 assert.deepEqual(normalizeAppearance({appearance:'invalid',accent:'red'}),{appearance:'dark',accent:'#e2a04a'});
 assert.deepEqual(normalizeAppearance(null),{appearance:'dark',accent:'#e2a04a'});
});

test('screen command acknowledgement requires the requested actual output state',()=>{
 const command={id:'screen',serviceId:'a',expiresAt:100,scope:'screen',target:{role:'stage',on:true}};
 const status={serviceId:'a',command:{id:'screen',status:'applied'},stageOn:true,audienceOn:false};
 assert.equal(commandFeedback(status,command,50),'applied');
 assert.equal(commandFeedback({...status,stageOn:false},command,50),null);
 assert.equal(commandFeedback({...status,serviceId:'other'},command,50),null);
});

test('lookup acknowledgement requires the exact live song or scripture',()=>{
 const targets=[{kind:'song',presentationId:'p',slideId:'s',cueIndex:1},{kind:'scripture',id:'verse-1',book:'John',chapter:3,verse:16,translation:'KJV',text:'Example verse'}];
 for(const target of targets){
  const command={id:'lookup',serviceId:'a',expiresAt:100,scope:'lookup',target};
  const status={serviceId:'a',command:{id:'lookup',status:'applied'},lookupActive:target};
  assert.equal(commandFeedback(status,command,50),'applied');
  assert.equal(commandFeedback({...status,lookupActive:null},command,50),null);
  assert.equal(commandFeedback({...status,lookupActive:{...target,kind:'other'}},command,50),null);
 }
});

test('song titles always precede lyric-only matches, and duplicate titles do not repeat',()=>{
 const song=(id,name,text,binding='lyrics')=>({id,name,category:'song',slides:[{objects:[{kind:'text',binding,text}]}]});
 const songs=[song('lyrics','Other song','Amazing Grace'),song('title','Amazing Grace','Amazing Grace'),song('copyright','Copyright','Amazing Grace','copyright'),song('title2','Amazing Love','Something else'),{...song('other','Amazing','Amazing'),category:'scripture'}];
 assert.deepEqual(searchSongs(songs,'amazing').map(p=>p.id),['title','title2','lyrics']);
 assert.deepEqual(searchSongs(songs,'   '),[]);
});

test('Add to Service confirmation is independent of current live slide',()=>{
 const command={id:'add',serviceId:'a',scope:'addLookup',expiresAt:100,target:{kind:'song',presentationId:'p'}};
 const status={serviceId:'a',command:{id:'add',status:'applied'},active:cue};
 assert.equal(commandFeedback(status,command,50),'applied');
 assert.equal(commandFeedback({...status,command:{id:'wrong',status:'applied'}},command,50),null);
 assert.equal(commandFeedback({...status,command:{id:'add',status:'rejected'}},command,50),'rejected');
});
