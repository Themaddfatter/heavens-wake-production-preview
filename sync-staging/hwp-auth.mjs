// Firebase credentials are handled by Firebase Auth, never embedded in library data.
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
  async signIn(email,password){return sdk.signInWithEmailAndPassword(auth,email.trim(),password)},
  async signOut(){return sdk.signOut(auth)},
  async resetPassword(email){return sdk.sendPasswordResetEmail(auth,String(email||'').trim())},
  async workspace(data){return (await workspace(data)).data},
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
  catch(error){failure=error;if(!['auth/web-storage-unsupported','auth/operation-not-supported-in-this-environment','auth/internal-error','auth/quota-exceeded'].includes(error?.code)&&!['SecurityError','QuotaExceededError','InvalidStateError','NotSupportedError'].includes(error?.name))throw error}
 }
 throw failure||new Error('No supported sign-in storage is available.');
}
export async function loadHwpFirebaseSdk(){
 const base='https://www.gstatic.com/firebasejs/10.14.1/';
 const [app,auth,functions,storage]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-functions.js'),import(base+'firebase-storage.js')]);
 return {...app,...auth,...functions,...storage};
}
export async function loadHwpConfig(){
 const endpoint='https://us-central1-sion-schedule-next.cloudfunctions.net/hwpFirebaseConfig';
 const response=await fetch(endpoint,{method:'GET',cache:'no-store'});
 if(!response.ok){const error=new Error('Ministry Connect configuration request failed (HTTP '+response.status+').');error.code='hwp/config-http-'+response.status;throw error}
 return response.json();
}
