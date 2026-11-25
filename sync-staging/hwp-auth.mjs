// Firebase credentials are handled by Firebase Auth, never embedded in library data.
const transientCodes=new Set(['functions/unauthenticated','functions/unavailable','functions/deadline-exceeded','functions/internal','functions/unknown','auth/network-request-failed','auth/internal-error','auth/timeout','hwp/config-network']);
export function isTransientHwpConnection(error){return transientCodes.has(error?.code)||['TypeError','AbortError','NetworkError','TimeoutError'].includes(error?.name)}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// A read-only retry uses the same authenticated callable endpoint. Never retry
// a mutating command through a second transport after an ambiguous response.
export async function readHwpCallable({call,user,data,fetcher=fetch,endpoint='https://us-central1-sion-schedule-next.cloudfunctions.net/hwpWorkspace'}){
 try{return (await call(data)).data}catch(error){
  if(!isTransientHwpConnection(error)||!user)throw error;
  const token=await user.getIdToken(error?.code==='functions/unauthenticated');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({data}),signal:controller.signal,cache:'no-store'});
   const body=await response.json();
   if(body?.error){const status=String(body.error.status||'UNKNOWN').toLowerCase().replaceAll('_','-');throw Object.assign(new Error(body.error.message||'Ministry Connect request failed'),{code:'functions/'+status})}
   if(!response.ok||!Object.prototype.hasOwnProperty.call(body,'result'))throw Object.assign(new Error('Ministry Connect connection failed'),{code:'functions/unavailable'});
   return body.result;
  }finally{clearTimeout(timer)}
 }
}
const readActions=new Set(['access','get','preferences.get','worshipControlMobileServices','worshipControlMobileStatus','worshipControlStatus']);
export async function createHwpAuth({loadConfig,loadSdk}) {
 const [config,sdk]=await Promise.all([loadConfig(),loadSdk()]);
 if(config?.projectId!=='sion-schedule-next'||!config.apiKey||!config.appId)throw new Error('HWP sign-in is temporarily unavailable.');
 const existing=sdk.getApps().find(app=>app.name==='hwp-shared');
 const app=existing||sdk.initializeApp(config,'hwp-shared');
 const auth=sdk.getAuth(app),functions=sdk.getFunctions(app,'us-central1');
 const storage=sdk.getStorage(app,'gs://sion-schedule-next.firebasestorage.app');
 // Safari/private browsing may reject persistent storage. Retain authenticated
 // session checks even when browser-local persistence is unavailable.
 await configureHwpPersistence(auth,sdk);
 if(typeof auth.authStateReady==='function')await auth.authStateReady();
 const workspace=sdk.httpsCallable(functions,'hwpWorkspace');
 const media=sdk.httpsCallable(functions,'hwpMedia');
 const songLibrary=sdk.httpsCallable(functions,'zionServiceSongs');
 return {
  firebaseAuth:auth, firebaseStorage:storage, storageSdk:sdk,
  observe:callback=>sdk.onAuthStateChanged(auth,callback),
  watchWorshipSignal(serviceId,onChange,onError){let alive=true,stop=()=>{};import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js').then(fs=>{if(alive)stop=fs.onSnapshot(fs.doc(fs.getFirestore(app),'sionProductionLive','hwp-worship-signal:'+serviceId),onChange,onError)}).catch(err=>{if(alive)onError(err)});return()=>{alive=false;stop()}},
  // The signal contains only a workspace revision, never presentation contents.
  watchWorkspaceSignal(onChange,onError){let alive=true,stop=()=>{};import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js').then(fs=>{if(alive)stop=fs.onSnapshot(fs.doc(fs.getFirestore(app),'sionProductionLive','hwp-workspace-signal'),{includeMetadataChanges:true},snap=>{if(alive&&!snap.metadata.fromCache)onChange(snap.exists()?snap.data()?.revision:null)},err=>{if(alive)onError(err)})}).catch(err=>{if(alive)onError(err)});return()=>{alive=false;stop()}},
  async signIn(email,password){return sdk.signInWithEmailAndPassword(auth,email.trim(),password)},
  async signOut(){return sdk.signOut(auth)},
  async resetPassword(email){return sdk.sendPasswordResetEmail(auth,String(email||'').trim())},
  async workspace(data){return readActions.has(data?.action)?readHwpCallable({call:workspace,user:auth.currentUser,data}):(await workspace(data)).data},
  async media(data){return (await media(data)).data},
  async songLibrary(data){return (await songLibrary(data)).data},
  async syncWorshipLibrary(){return (await songLibrary({action:'syncHwpLibrary'})).data}
 };
}
export async function configureHwpPersistence(auth,sdk){
 const choices=[sdk.browserLocalPersistence,sdk.browserSessionPersistence,sdk.inMemoryPersistence].filter(Boolean);
 let failure;
 for(const choice of choices){
  try{await sdk.setPersistence(auth,choice);return}
  catch(error){failure=error;if(!['auth/web-storage-unsupported','auth/operation-not-supported-in-this-environment','auth/internal-error','auth/quota-exceeded','auth/unsupported-persistence-type'].includes(error?.code)&&!['SecurityError','QuotaExceededError','InvalidStateError','NotSupportedError','UnknownError','AbortError'].includes(error?.name))throw error}
 }
 throw failure||new Error('No supported sign-in storage is available.');
}
export async function loadHwpFirebaseSdk(){
 const base='https://www.gstatic.com/firebasejs/10.14.1/';
 const [app,auth,functions,storage]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-functions.js'),import(base+'firebase-storage.js')]);
 return {...app,...auth,...functions,...storage};
}
// These are public Firebase SDK configuration fields, never account credentials.
export function validHwpConfig(value){
 return value?.projectId==='sion-schedule-next'&&typeof value.apiKey==='string'&&value.apiKey.length>0&&typeof value.appId==='string'&&value.appId.length>0&&typeof value.authDomain==='string'&&value.authDomain.length>0;
}
export async function loadHwpConfig(){
 const endpoints=['https://us-central1-sion-schedule-next.cloudfunctions.net/hwpFirebaseConfig','https://sion-schedule-next.firebaseapp.com/__/firebase/init.json'];
 const cacheKey='hwp-public-firebase-config-v1';
 let failure;
 for(const endpoint of endpoints){
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   let response;
   try{response=await fetch(endpoint,{method:'GET',cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)}
   if(!response.ok){const error=new Error('Configuration HTTP '+response.status);error.code='hwp/config-http-'+response.status;throw error}
   const value=await response.json();
   if(!validHwpConfig(value))throw Object.assign(new Error('Invalid Firebase project configuration'),{code:'hwp/config-invalid'});
   const {apiKey,authDomain,projectId,appId,messagingSenderId}=value;
   const config={apiKey,authDomain,projectId,appId,messagingSenderId};
   try{localStorage.setItem(cacheKey,JSON.stringify(config))}catch{}
   return config;
  }catch(error){failure=error}
 }
 try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(validHwpConfig(cached))return cached}catch{}
 throw Object.assign(new Error('Could not load Ministry Connect Firebase configuration.'),{code:failure?.code||'hwp/config-network'});
}
export async function verifyHwpAccess(system,user){
 const check=async()=>{
  try{return await system.auth.workspace({action:'access'})}
  catch(error){if(error?.code==='functions/invalid-argument')return system.auth.workspace({action:'get'});throw error}
 };
 let failure;
 for(let attempt=0;attempt<3;attempt++){
  try{return await check()}catch(error){
   failure=error;
   if(!isTransientHwpConnection(error))throw error;
   if(attempt===2)break;
   // A failed forced refresh is itself transient on some mobile browsers.
   try{await user.getIdToken?.(true)}catch(refreshError){if(!isTransientHwpConnection(refreshError))throw refreshError}
   await delay(attempt===0?350:1000);
  }
 }
 throw failure;
}
