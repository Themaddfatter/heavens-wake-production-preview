import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrateLocalLibrary,SyncConflictError} from './sync-core.mjs';
const original=()=>({presentations:[{id:'p'}],media:[{id:'m',name:'picture',kind:'image',src:'idb:one'},{id:'m2',src:'idb:one'}]});
test('copies local media once and commits a new library without changing the original',async()=>{
 const doc=original();let uploads=0, saved;
 const out=await migrateLocalLibrary({doc,appearance:'dark',readLocalMedia:async()=>new Blob(['a']),uploadMedia:async()=>{uploads++;return {id:'remote'}},commit:async data=>(saved=data,{saved:true,revision:2}),expectedRevision:1});
 assert.equal(uploads,1);assert.equal(out.revision,2);assert.equal(saved.doc.media[0].src,'cloud:remote');assert.equal(saved.doc.media[1].src,'cloud:remote');assert.equal(doc.media[0].src,'idb:one');assert.equal(saved.expectedRevision,1);
});
test('missing local media never commits',async()=>{
 let committed=false;await assert.rejects(migrateLocalLibrary({doc:original(),readLocalMedia:async()=>null,uploadMedia:async()=>({id:'x'}),commit:async()=>{committed=true}}),/Could not read/);assert.equal(committed,false);
});
test('failed uploads never commit and do not mutate local references',async()=>{
 const doc=original();let committed=false;await assert.rejects(migrateLocalLibrary({doc,readLocalMedia:async()=>new Blob(['a']),uploadMedia:async()=>{throw Error('offline')},commit:async()=>{committed=true}}),/offline/);assert.equal(committed,false);assert.equal(doc.media[0].src,'idb:one');
});
test('reports a conflicting cloud revision rather than overwriting it',async()=>{
 await assert.rejects(migrateLocalLibrary({doc:original(),readLocalMedia:async()=>new Blob(['a']),uploadMedia:async()=>({id:'x'}),commit:async()=>({conflict:true}),expectedRevision:2}),SyncConflictError);
});
