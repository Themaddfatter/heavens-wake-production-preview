import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverMissingLocalMedia} from './sync-core.mjs';
const photo=(id,src)=>({id,name:id,kind:'image',folderId:'folder_uploads',src});
const slide=(id,mediaId)=>({id,background:{type:'media',mediaId},objects:[]});

test('recovers local backgrounds without overwriting newer cloud presentation',async()=>{
 const remote={media:[photo('existing','cloud:saved')],presentations:[{id:'pres_background',slides:[slide('current','existing')]}],mediaFolders:[],libraries:[],logoMediaId:null};
 const old={media:[photo('lost','idb:local-blob')],presentations:[{id:'pres_background',slides:[slide('lost-slide','lost')]}],mediaFolders:[{id:'folder_uploads',name:'Uploads'}],logoMediaId:'lost'};
 let committed, uploaded=0;
 const result=await recoverMissingLocalMedia({remoteDoc:remote,localDocs:[old],expectedRevision:4,
  readLocalMedia:async()=>new Blob(['image'],{type:'image/png'}),
  uploadMedia:async()=>{uploaded++;return {id:'new-firebase-file'}},
  commit:async ({doc,expectedRevision})=>{assert.equal(expectedRevision,4);committed=doc;return {saved:true,revision:5}}
 });
 assert.equal(uploaded,1);assert.equal(result.recovered,1);assert.equal(remote.media.length,1);
 assert.equal(committed.media.find(x=>x.id==='lost').src,'cloud:new-firebase-file');
 assert.equal(committed.presentations[0].slides.length,2);
 assert.equal(committed.logoMediaId,'lost');
});

test('skips existing cloud files and does not save unavailable browser blobs',async()=>{
 const cloud={media:[photo('same','cloud:already')],presentations:[]};
 let saved=0;
 const outcome=await recoverMissingLocalMedia({remoteDoc:cloud,localDocs:[{media:[photo('same','idb:old'),photo('missing','idb:unavailable')],presentations:[]}],
  readLocalMedia:async()=>null,uploadMedia:async()=>{throw Error('Should not upload')},
  commit:async()=>{saved++;return {saved:true}},expectedRevision:3});
 assert.equal(outcome.unavailable,1);assert.equal(outcome.recovered,0);
 assert.equal(saved,0);
});

test('detects newer cloud revision and never replaces it',async()=>{
 await assert.rejects(recoverMissingLocalMedia({
  remoteDoc:{media:[],presentations:[]},
  localDocs:[{media:[photo('old','idb:x')],presentations:[]}],
  readLocalMedia:async()=>new Blob(['a'],{type:'image/png'}),
  uploadMedia:async()=>({id:'cloudfile'}),
  commit:async()=>({conflict:true,revision:8}),expectedRevision:7
 }),/cloud library changed/i);
});
