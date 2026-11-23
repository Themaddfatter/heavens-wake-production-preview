// Client-side network operations for the shared workspace. Supply Firebase callable adapters.
export class HwpSyncError extends Error {constructor(message,code){super(message);this.name='HwpSyncError';this.code=code}}
export function createHwpSyncClient({workspaceCall,mediaCall,cloudMedia=null,fetcher=fetch,now=Date.now}) {
 if(typeof workspaceCall!=='function'||typeof mediaCall!=='function')throw new TypeError('Authenticated callable adapters required');
 const signed=new Map();
 const localUrls=new Map();
 async function load(){return workspaceCall({action:'get'})}
 async function save(workspace,expectedRevision){
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new HwpSyncError('Missing cloud revision.','invalid-revision');
  const result=await workspaceCall({action:'save',workspace,expectedRevision});
  if(result?.conflict)throw new HwpSyncError('Another device changed the library. Reload before saving.','conflict');
  if(!result?.saved)throw new HwpSyncError('The library was not saved. Your local work is unchanged.','save-failed');
  return result;
 }
 async function upload(blob,name){
  if(!(blob instanceof Blob)||!blob.size)throw new HwpSyncError('The local file is missing.','missing-file');
  if(cloudMedia){
   try {
     const result=await cloudMedia.remote.upload(blob,name);
     if(!result?.id)throw new HwpSyncError('Firebase upload did not return an ID.','upload-failed');
     // Begin local synchronization of the uploaded immutable object.
     void cloudMedia.local.runSync().catch(()=>{});
     return {id:result.id};
   }catch(error){
     // Until initial Storage rules are live, preserve the existing signed-media
     // gateway rather than break autosave. All other cloud errors remain visible.
     if(error?.code!=='storage/unauthorized' && error?.code!=='storage/permission-denied')
       throw error;
   }
  }
  const sign=await mediaCall({action:'signUpload',name,type:blob.type,size:blob.size});
  if(!sign?.id||!sign?.uploadUrl)throw new HwpSyncError('Could not prepare the media upload.','upload-failed');
  const response=await fetcher(sign.uploadUrl,{method:'PUT',headers:{'Content-Type':sign.contentType||blob.type},body:blob});
  if(!response.ok)throw new HwpSyncError('Media upload failed; local file is unchanged.','upload-failed');
  const finish=await mediaCall({action:'completeUpload',id:sign.id});
  if(!finish?.saved)throw new HwpSyncError('The server could not verify the uploaded media.','upload-failed');
  return {id:sign.id};
 }
 async function mediaUrl(id){
  if(cloudMedia){
   const cached=localUrls.get(id);
   if(cached)return cached;
   const local=await cloudMedia.local.localEntry(id);
   if(local){
     const source=await cloudMedia.local.playback(id);
     if(source?.url){localUrls.set(id,source.url);return source.url}
   }
   // Only attempt a cloud download when this ID is actually in the shared Firebase
   // manifest. Legacy PC/Garage files retain their existing access path until migrated.
   const manifest=await cloudMedia.remote.listRemote().catch(()=>[]);
   if(manifest.some(item=>item.id===id)){
     await cloudMedia.local.runSync();
     const source=await cloudMedia.local.playback(id);
     if(!source?.url)throw new HwpSyncError('Firebase media was not downloaded.','media-unavailable');
     localUrls.set(id,source.url);
     return source.url;
   }
  }
  const old=signed.get(id);if(old&&old.until>now())return old.url;
  const reply=await mediaCall({action:'signRead',id});const url=reply?.urls?.[id];
  if(!url)throw new HwpSyncError('The media file is unavailable.','media-unavailable');
  signed.set(id,{url,until:now()+Math.max(0,Number(reply.expiresIn||0)-60)*1000});return url;
 }
 return {load,save,upload,mediaUrl,cloudMedia,
  clearSignedUrls:()=>{
   signed.clear();
   for(const url of localUrls.values())URL.revokeObjectURL(url);
   localUrls.clear();
  }
 };
}
