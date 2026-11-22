// Firebase credentials are handled by Firebase Auth, never embedded in library data.
export async function createHwpAuth({loadConfig,loadSdk}) {
 const [config,sdk]=await Promise.all([loadConfig(),loadSdk()]);
 if(config?.projectId!=='sion-schedule-next'||!config.apiKey||!config.appId)throw new Error('HWP sign-in is temporarily unavailable.');
 const existing=sdk.getApps().find(app=>app.name==='hwp-shared');
 const app=existing||sdk.initializeApp(config,'hwp-shared');
 const auth=sdk.getAuth(app),functions=sdk.getFunctions(app,'us-central1');
 await sdk.setPersistence(auth,sdk.browserLocalPersistence);
 if(typeof auth.authStateReady==='function')await auth.authStateReady();
 const workspace=sdk.httpsCallable(functions,'hwpWorkspace');
 const media=sdk.httpsCallable(functions,'hwpMedia');
 return {
  observe:callback=>sdk.onAuthStateChanged(auth,callback),
  async signIn(email,password){return sdk.signInWithEmailAndPassword(auth,email.trim(),password)},
  async signOut(){return sdk.signOut(auth)},
  async workspace(data){return (await workspace(data)).data},
  async media(data){return (await media(data)).data}
 };
}
export async function loadHwpFirebaseSdk(){
 const base='https://www.gstatic.com/firebasejs/10.14.1/';
 const [app,auth,functions]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-functions.js')]);
 return {...app,...auth,...functions};
}
export async function loadHwpConfig(){
 const response=await fetch('https://us-central1-sion-schedule-next.cloudfunctions.net/hwpFirebaseConfig',{method:'GET'});
 if(!response.ok)throw new Error('HWP sign-in is temporarily unavailable.');
 return response.json();
}
