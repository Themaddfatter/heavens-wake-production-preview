const test=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('fs'),{runInNewContext}=require('vm');
test('local library and cloud revision commit in the same completed transaction',async()=>{
 const source=readFileSync('index.html','utf8'),start=source.indexOf('async function hwpPersistStateAndRevision('),end=source.indexOf('\nfunction HwpCloudAgent(',start);assert.ok(start>0&&end>start);
 const writes=[];let tx;const db={transaction(name,mode){assert.equal(name,'kv');assert.equal(mode,'readwrite');tx={objectStore:()=>({put:(value,key)=>writes.push([key,value])})};setImmediate(()=>tx.oncomplete());return tx}};
 const persist=runInNewContext(source.slice(start,end)+'; hwpPersistStateAndRevision',{m:async()=>db,Error,Promise});
 await persist({doc:{presentations:[1]},live:{},session:{}},7);assert.equal(writes.length,2);assert.equal(writes[0][0],'state');assert.equal(writes[1][0],'hwpCloudRevision');assert.equal(writes[1][1],7);
});
