'use strict';
const {app,BrowserWindow,Menu,dialog,shell,session}=require('electron');
const {autoUpdater}=require('electron-updater');
const {HOME,isHws,external,permission}=require('./policy.cjs');
const {hwsPreview=false}=require('./package.json');
const prefs={nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false};
let win,updateMenu,timer,checking=false,downloaded=false,quitting=false,loading=false;
const smoke=process.argv.includes('--hws-smoke-test');
function protect(wc){
 wc.on('will-navigate',(e,url)=>{if(!isHws(url))e.preventDefault()});
 wc.on('will-redirect',(e,url)=>{if(!isHws(url))e.preventDefault()});
 wc.on('will-attach-webview',e=>e.preventDefault());
 wc.setWindowOpenHandler(({url})=>{
  if(isHws(url)||(url==='about:blank'&&isHws(wc.getURL())))return {action:'allow',overrideBrowserWindowOptions:{webPreferences:prefs}};
  if(external(url))void shell.openExternal(url).catch(console.error);
  return {action:'deny'};
 });
}
function offline(error){
 if(!win||win.isDestroyed())return;
 if(smoke){console.error(error);app.exit(2);return}
 void dialog.showMessageBox(win,{type:'warning',message:'HWS could not connect',detail:'Check your internet connection. Your existing cloud sermons have not been changed.',buttons:['Retry','Close'],defaultId:0,cancelId:1}).then(({response})=>{if(response===0)void load();else win?.close()});
}
async function load(){
 if(loading||!win||win.isDestroyed())return;
 loading=true;
 try{await win.loadURL(HOME);if(smoke){const ok=await win.webContents.executeJavaScript("Boolean(document.querySelector('#root'))");app.exit(ok?0:3)}}catch(e){offline(e)}finally{loading=false}
}
function attachHangRecovery(window){
 let hangTimer=null,prompt=null,stalled=false;
 const clear=()=>{stalled=false;if(hangTimer)clearTimeout(hangTimer);hangTimer=null;prompt?.abort();prompt=null};
 const recover=async()=>{
  hangTimer=null;
  if(!stalled||window.isDestroyed()||quitting||prompt)return;
  const controller=new AbortController();prompt=controller;
  try{
   const {response}=await dialog.showMessageBox(window,{type:'warning',message:'HWS is not responding',detail:'You can keep waiting or recover the editor. Recovery reloads HWS and may lose changes not yet saved to the cloud.',buttons:['Keep Waiting','Recover HWS'],defaultId:0,cancelId:0,signal:controller.signal});
   if(response===1&&stalled&&!window.isDestroyed()&&!quitting){
    clear();
    // Terminate only the stuck renderer, never the entire application.
    // Its crash event is handled below and the existing session is preserved.
    window.webContents.forcefullyCrashRenderer();
    window.webContents.reloadIgnoringCache();
   }else if(stalled&&!window.isDestroyed()&&!quitting){hangTimer=setTimeout(()=>void recover(),30000)}
  }catch(error){if(!controller.signal.aborted)console.error('HWS recovery prompt:',error)}
  finally{if(prompt===controller)prompt=null}
 };
 window.on('unresponsive',()=>{if(smoke||stalled||quitting)return;stalled=true;hangTimer=setTimeout(()=>void recover(),8000)});
 window.on('responsive',clear);window.on('closed',clear);
}
function createWindow(){
 win=new BrowserWindow({width:1440,height:900,minWidth:720,minHeight:520,title:'HWS',show:!smoke,backgroundColor:'#ffffff',webPreferences:prefs});
 attachHangRecovery(win);
 win.on('closed',()=>{win=null});
 win.webContents.on('render-process-gone',(_e,details)=>{if(!quitting&&!['clean-exit','killed'].includes(details.reason))offline(details.reason)});
 void load();
}
async function confirmReload(){
 if(!win||!isHws(win.webContents.getURL()))return;
 const {response}=await dialog.showMessageBox(win,{type:'warning',message:'Reload HWS?',detail:'Save your sermon first. Reloading may interrupt preaching or editing.',buttons:['Cancel','Reload'],defaultId:0,cancelId:0});
 if(response===1)win.webContents.reloadIgnoringCache();
}
async function install(){
 if(!downloaded)return;
 const {response}=await dialog.showMessageBox({type:'warning',message:'Install HWS update?',detail:'Save your sermon before restarting HWS.',buttons:['Cancel','Install and Restart'],defaultId:0,cancelId:0});
 if(response===1){quitting=true;autoUpdater.quitAndInstall(false,true)}
}
async function check(manual=false){
 if(!app.isPackaged||hwsPreview){if(manual)await dialog.showMessageBox({message:'Native updates require the signed HWS release. Website updates continue to work.'});return}
 if(downloaded){if(manual)await install();return}
 if(checking)return;
 checking=true;
 try{const r=await autoUpdater.checkForUpdates();if(manual)await dialog.showMessageBox({message:r?.isUpdateAvailable?'HWS update found. It downloads in the background.':'HWS is up to date.'})}
 catch(e){console.error(e);if(manual)await dialog.showMessageBox({type:'warning',message:'Unable to check for updates. HWS can continue running.'})}finally{checking=false}
}
function updater(){
 if(!app.isPackaged||hwsPreview||smoke)return;
 autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;autoUpdater.allowDowngrade=false;autoUpdater.allowPrerelease=false;
 autoUpdater.on('error',e=>{console.error('HWS updater:',e);if(!downloaded&&updateMenu)updateMenu.label='Check for Updates…'});
 autoUpdater.on('update-available',()=>{if(updateMenu)updateMenu.label='Downloading HWS Update…'});
 autoUpdater.on('update-not-available',()=>{if(!downloaded&&updateMenu)updateMenu.label='Check for Updates…'});
 autoUpdater.on('update-downloaded',()=>{downloaded=true;if(updateMenu)updateMenu.label='Install Downloaded Update…'});
 void check();timer=setInterval(()=>void check(),300000);timer.unref();
}
function menu(){
 const m=Menu.buildFromTemplate([{label:'HWS',submenu:[{role:'about'},{id:'update',label:'Check for Updates…',click:()=>void check(true)},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},{role:'editMenu'},{label:'View',submenu:[{label:'Reload HWS…',accelerator:'CmdOrCtrl+R',click:()=>void confirmReload()},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},{role:'windowMenu'}]);
 Menu.setApplicationMenu(m);updateMenu=m.getMenuItemById('update');
}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('web-contents-created',(_e,wc)=>protect(wc));
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
 app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((wc,p,cb,d={})=>cb(permission(d.requestingUrl||wc.getURL(),p)&&isHws(wc.getURL())));
  session.defaultSession.setPermissionCheckHandler((wc,p,origin)=>Boolean(wc&&isHws(wc.getURL())&&permission(origin,p)));
  menu();createWindow();updater();app.on('activate',()=>{if(!win&&!quitting)createWindow()});
 });
 app.on('before-quit',()=>{quitting=true;if(timer)clearInterval(timer)});
}
