import test from 'node:test';
import assert from 'node:assert/strict';
import {createHwpSyncClient} from './hwp-sync-client.mjs';

test('new Firebase media uploads avoid the old PC media gateway', async()=>{
 let legacyCalls=0,cloudUploads=0,localSyncs=0;
 const cloudMedia={
  remote:{
   upload:async(blob,name)=>{cloudUploads++;assert.equal(name,'service.mp4');return {id:'cloud-id-123'}},
   listRemote:async()=>[{id:'cloud-id-123',version:'1',size:3}]
  },
  local:{
   runSync:async()=>{localSyncs++;return {completed:1}},
   localEntry:async()=>({file:new Blob(['abc']),version:'1',size:3}),
   playback:async()=>({url:'blob:hwp-local-media',file:new Blob(['abc'])})
  }
 };
 const client=createHwpSyncClient({
  workspaceCall:async()=>({revision:1}),
  mediaCall:async()=>{legacyCalls++;throw Error('Legacy media cannot be used for new files')},
  cloudMedia
 });
 const uploaded=await client.upload(new Blob(['abc'],{type:'video/mp4'}),'service.mp4');
 assert.deepEqual(uploaded,{id:'cloud-id-123'});
 const playback=await client.mediaUrl('cloud-id-123');
 assert.equal(playback,'blob:hwp-local-media');
 assert.equal(await client.mediaUrl('cloud-id-123'),playback);
 assert.equal(cloudUploads,1);assert.equal(legacyCalls,0);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(localSyncs,1);
});
test('legacy media remains playable until copied safely to Firebase', async()=>{
 let legacyReads=0;
 const cloudMedia={
  remote:{upload:async()=>{throw Error('unexpected')},listRemote:async()=>[]},
  local:{runSync:async()=>({}),localEntry:async()=>null,playback:async()=>null}
 };
 const client=createHwpSyncClient({
  workspaceCall:async()=>({revision:0}),
  mediaCall:async(data)=>{legacyReads++;assert.equal(data.action,'signRead');return {urls:{'old-id':'https://example.com/legacy.mp4'},expiresIn:600}},
  cloudMedia
 });
 assert.equal(await client.mediaUrl('old-id'),'https://example.com/legacy.mp4');
 assert.equal(legacyReads,1);
});

test('Firebase permission failure keeps local source and never falls back to retired storage', async()=>{
 let legacyCalls=0;
 const client=createHwpSyncClient({
  workspaceCall:async()=>({revision:0}),
  mediaCall:async()=>{legacyCalls++;throw Error('Retired media provider must not be called')},
  cloudMedia:{
   remote:{upload:async()=>{throw Object.assign(new Error('Denied'),{code:'storage/unauthorized'})},listRemote:async()=>[]},
   local:{runSync:async()=>({}),localEntry:async()=>null,playback:async()=>null}
  }
 });
 await assert.rejects(client.upload(new Blob(['abc'],{type:'image/png'}),'photo.png'),/original file remains/);
 assert.equal(legacyCalls,0);
});
test('non-permission Firebase errors do not silently fall back to another provider', async()=>{
 let oldCalls=0;
 const client=createHwpSyncClient({
  workspaceCall:async()=>({revision:0}),
  mediaCall:async()=>{oldCalls++;throw Error('Unexpected legacy access')},
  cloudMedia:{
   remote:{upload:async()=>{throw Object.assign(new Error('Cloud service unavailable'),{code:'storage/retry-limit-exceeded'})},listRemote:async()=>[]},
   local:{runSync:async()=>({}),localEntry:async()=>null,playback:async()=>null}
  }
 });
 await assert.rejects(client.upload(new Blob(['abc'],{type:'image/png'}),'intro.png'),/Cloud service unavailable/);
 assert.equal(oldCalls,0);
});
