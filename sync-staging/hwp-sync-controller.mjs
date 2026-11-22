import {migrateLocalLibrary} from './sync-core.mjs';
// Explicit initialization prevents a second device's sample library from replacing cloud data.
export function createHwpController({client, readLocalMedia}) {
 if(!client||typeof readLocalMedia!=='function')throw new TypeError('Sync adapters are required');
 let revision=null,busy=false;
 async function inspect(){const remote=await client.load();if(!Number.isSafeInteger(remote?.revision)||remote.revision<0)throw Error('Cloud library returned an invalid revision.');revision=remote.revision;return remote}
 async function send(localDoc,appearance,expectedRevision){
  if(busy)throw Error('A sync is already in progress.');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Load the shared library before saving.');
  busy=true;
  try{
   const result=await migrateLocalLibrary({doc:localDoc,appearance,readLocalMedia,uploadMedia:({blob,name})=>client.upload(blob,name),expectedRevision,
    commit:async ({doc,appearance,expectedRevision})=>client.save({...doc,hwpAppearance:appearance},expectedRevision)});
   revision=result.revision;return result;
  }finally{busy=false}
 }
 return {
  inspect,
  async initialize(localDoc,appearance){if(revision!==0)throw Error('A shared library already exists or has not been checked.');return send(localDoc,appearance,0)},
  async save(localDoc,appearance,expectedRevision){if(revision===null||revision!==expectedRevision)throw Error('Load the current library before saving.');return send(localDoc,appearance,expectedRevision)},
  async resolveMedia(src){if(!src.startsWith('cloud:'))return src;return client.mediaUrl(src.slice(6))},
  getRevision:()=>revision
 };
}
