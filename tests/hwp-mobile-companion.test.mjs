import test from 'node:test';
import assert from 'node:assert/strict';
import {isCompanionDevice,visibleSchedules,sameCue,remoteCue,selectAvailable,cameraRoster,commandFeedback,normalizeAppearance,searchSongs,sameMobileStatus} from '../sync-staging/hwp-mobile-companion.mjs';
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

test('receiver polling does not redraw the mobile screen when only heartbeat timestamps change',()=>{
 const before={serviceId:'s',online:true,audienceOn:true,stageOn:true,songs:[],active:null,updatedAt:100,serverTime:100};
 assert.equal(sameMobileStatus(before,{...before,updatedAt:200,serverTime:200}),true);
 assert.equal(sameMobileStatus(before,{...before,audienceOn:false}),false);
 assert.equal(sameMobileStatus(before,{...before,command:{id:'c',status:'applied'}}),false);
 assert.equal(sameMobileStatus(before,{...before,lookupActive:{kind:'song',presentationId:'p',slideId:'a',cueIndex:0}}),false);
});

test('installed iOS uses final HWW opaque native chrome and fixed guard',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../hwp-mobile-companion.css',import.meta.url),'utf8');
 const mobile=readFileSync(new URL('../sync-staging/hwp-mobile-companion.mjs',import.meta.url),'utf8');
 assert.match(html,/navigator\.standalone === true/);
 assert.match(html,/apple-mobile-web-app-status-bar-style" content="default"/);
 assert.match(html,/viewport-fit=auto/);
 assert.doesNotMatch(html,/viewport-fit=cover|content="black-translucent"/);
 assert.match(html,/<body><div id="hwp-native-top" aria-hidden="true"><\/div>/);
 assert.match(css,/html\.hwp-ios-standalone #hwp-native-top\{[\s\S]*?height:16px;[\s\S]*?background-color:var\(--hwp-native-chrome,#202328\)/);
 assert.match(css,/html\.hwp-ios-standalone \.hwp-mobile-companion\{[\s\S]*?--hwp-top-guard:16px;[\s\S]*?padding-top:var\(--hwp-top-guard\)/);
 assert.doesNotMatch(css,/html\.hwp-ios-standalone #root::before/);
 assert.match(mobile,/style\.setProperty\('--hwp-native-chrome',chrome\)/);
});


test('published song-list revision signals refresh both desktop and mobile without replacing the active selection',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const mobile=readFileSync(new URL('../sync-staging/hwp-mobile-companion.mjs',import.meta.url),'utf8');
 const auth=readFileSync(new URL('../sync-staging/hwp-auth.mjs',import.meta.url),'utf8');
 assert.match(auth,/watchWorkspaceSignal[\s\S]*?sionProductionLive','hwp-workspace-signal/);
 assert.match(html,/stopWorkspaceSignal=system\.auth\.watchWorkspaceSignal/);
 assert.match(html,/if\(working\.current\|\|loading\.current\)\{signalTimer=window\.setTimeout\(refreshSignaledWorkspace,250\)/);
 assert.match(html,/signalRevision<=\(appliedRevision\.current\?\?-1\)/);
 assert.match(mobile,/stopSignal=system\.auth\.watchWorkspaceSignal/);
 assert.match(mobile,/revision\.current!==result\.revision/);
 assert.match(mobile,/signalAvailable\?10000:2000/);
});


test('remote schedule updates merge with unrelated unsaved local changes and preserve manual rows',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const code=html.slice(html.indexOf('function hwpMergeScheduleWorkspace('),html.indexOf('function HwpCloudAgent('));
 const merge=new Function(code+';return hwpMergeScheduleWorkspace')();
 const header={id:'praise',header:'Praise Songs',permanentHeaderKey:'praise-songs'},old={id:'old',presentationId:'p1',hwpScheduleSync:'song',groupHeaderId:'praise'},fresh={id:'fresh',presentationId:'p2',hwpScheduleSync:'song',groupHeaderId:'praise'};
 const base={playlists:[{id:'service',items:[header,old]}],presentations:[{id:'p1'}],settings:{theme:'dark'}};
 const local=structuredClone(base);local.playlists[0].items.push({id:'manual',presentationId:'manual'});local.settings.theme='light';
 const remote=structuredClone(base);remote.playlists[0].items=[header,fresh];remote.presentations.push({id:'p2'});
 const merged=merge(base,local,remote);
 assert.deepEqual(merged.playlists[0].items,[header,fresh,{id:'manual',presentationId:'manual'}]);
 assert.deepEqual(merged.presentations,remote.presentations);assert.equal(merged.settings.theme,'light');
 assert.match(html,/previous=signature.current===null\?null:JSON.parse\(signature.current\)\[0\]/);
 assert.match(html,/finally\{loading.current=false;if\(ready.current\)window.setTimeout\(\(\)=>run.current\(\),0\)\}/);
});


test('tablet access retries a transient callable failure using an authenticated read, never bypasses permission denial',async()=>{
 const {readHwpCallable,verifyHwpAccess}=await import('../sync-staging/hwp-auth.mjs');
 const data={action:'access'},user={getIdToken:async()=> 'test-token'};let requests=0;
 const result=await readHwpCallable({data,user,call:async()=>{throw Object.assign(Error('offline'),{code:'functions/unavailable'})},fetcher:async(url,options)=>{requests++;assert.equal(options.headers.Authorization,'Bearer test-token');assert.deepEqual(JSON.parse(options.body),{data});return {ok:true,json:async()=>({result:{allowed:true}})}}});
 assert.equal(result.allowed,true);assert.equal(requests,1);
 await assert.rejects(readHwpCallable({data,user,call:async()=>{throw Object.assign(Error('denied'),{code:'functions/permission-denied'})},fetcher:async()=>{throw Error('must not call')}}),/denied/);
 let calls=0;const access=await verifyHwpAccess({auth:{workspace:async()=>{if(++calls===1)throw Object.assign(Error('network'),{code:'functions/unavailable'});return {allowed:true}}}},user);
 assert.equal(access.allowed,true);assert.equal(calls,2);
});


test('tablet recovery initializes isolated Firebase email sign-in without old persistent auth data',async()=>{
 const {initializeHwpSignIn}=await import('../sync-staging/hwp-auth.mjs');
 const session={},memory={},calls=[];const app={name:'hwp-shared-recovery'},auth={authStateReady:async()=>{calls.push('ready')}};
 const sdk={getApps:()=>[{name:'hwp-shared'}],initializeApp:(config,name)=>{assert.equal(name,'hwp-shared-recovery');return app},initializeAuth:(a,options)=>{assert.equal(a,app);assert.deepEqual(options,{persistence:[session,memory]});calls.push('initialize');return auth},browserSessionPersistence:session,inMemoryPersistence:memory,getAuth:()=>{throw Error('must not load old session')}};
 assert.deepEqual(await initializeHwpSignIn(sdk,{projectId:'sion-schedule-next'},{recovery:true}),{app,auth});assert.deepEqual(calls,['initialize','ready']);
});
