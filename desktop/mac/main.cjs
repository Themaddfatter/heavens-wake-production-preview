'use strict';
const { app, BrowserWindow, Menu, dialog, shell, session } = require('electron');
const path = require('node:path');
const { createDisplayManager } = require('./display-manager.cjs');
const { autoUpdater } = require('electron-updater');
const { hwpPreview = false } = require('./package.json');
const HOME = 'https://production.sioncdo.com/';
const ORIGIN = new URL(HOME).origin;
let displayManager;
let mainWindow, ready = false, checking = false, timer, updateMenu, quitting = false;
const securePrefs = { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false, allowRunningInsecureContent: false };
function isHwp(url) { try { return new URL(url).origin === ORIGIN; } catch { return false; } }
function isExternalHttps(url) { try { return new URL(url).protocol === 'https:'; } catch { return false; } }
function configureSession() {
  const allowed = new Set(['media','fullscreen','speaker-selection']);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(isHwp(contents.getURL()) && isHwp(details.requestingUrl || contents.getURL()) && allowed.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) =>
    !!contents && isHwp(contents.getURL()) && isHwp(origin) && (!details.requestingUrl || isHwp(details.requestingUrl)) && allowed.has(permission));
}
function protect(contents) {
  contents.on('will-navigate', (event, url) => { if (!isHwp(url)) event.preventDefault(); });
  contents.on('will-redirect', (event, url) => { if (!isHwp(url)) event.preventDefault(); });
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.setWindowOpenHandler(({url}) => {
    if (isHwp(url) || (url === 'about:blank' && isHwp(contents.getURL()))) return {action:'allow', overrideBrowserWindowOptions:{webPreferences:securePrefs}};
    if (isExternalHttps(url)) void shell.openExternal(url).catch(console.error);
    return {action:'deny'};
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({width:1440,height:900,minWidth:850,minHeight:560,title:"HWP",show:false,webPreferences:{...securePrefs,preload:path.join(__dirname,"preload.cjs")}});
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { displayManager?.closeAll(); mainWindow = null; });
  mainWindow.loadURL(HOME).catch(error => { console.error(error); mainWindow?.show(); });
}
function confirmReload() {
  const window = BrowserWindow.getFocusedWindow();
  if (!window || !isHwp(window.webContents.getURL())) return;
  if (dialog.showMessageBoxSync(window,{type:'warning',message:'Reload HWP?',detail:'Reloading may interrupt a live presentation. Only continue when it is safe.',buttons:['Cancel','Reload'],defaultId:0,cancelId:0}) === 1) window.webContents.reloadIgnoringCache();
}
function installNow() {
  if (!ready) return;
  const choice = dialog.showMessageBoxSync({type:'warning',message:'Install HWP update and restart?',detail:'This closes all HWP windows and may interrupt an active service. Install only when it is safe.',buttons:['Cancel','Install and Restart'],defaultId:0,cancelId:0});
  if (choice === 1) { quitting = true; autoUpdater.quitAndInstall(false, true); }
}
async function checkUpdates(manual = false) {
  if (!app.isPackaged || hwpPreview) { if (manual) dialog.showMessageBox({message:'Updates are available in signed release builds only.'}); return; }
  if (ready) { if (manual) installNow(); return; }
  if (checking) return;
  checking = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    if (manual && result?.isUpdateAvailable === false) await dialog.showMessageBox({message:'HWP is up to date.'});
    else if (manual && result?.isUpdateAvailable === true && !ready) await dialog.showMessageBox({message:'HWP update found.',detail:'The update will download in the background. You can install it when it is safe.'});
  } catch (error) {
    console.error('Update check failed', error);
    if (manual) await dialog.showMessageBox({type:'warning',message:'Unable to check for updates.',detail:'HWP can continue running. Try again later.'});
  } finally { checking = false; }
}
function configureUpdater() {
  if (!app.isPackaged || hwpPreview) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('error', error => console.error('HWP updater:',error));
  autoUpdater.on('update-downloaded', () => {
    ready = true;
    if (updateMenu) { updateMenu.label = 'Install Downloaded Update…'; }
  });
  void checkUpdates();
  timer = setInterval(() => void checkUpdates(), 30 * 60 * 1000);
  timer.unref();
}
function createMenu() {
  const menu = Menu.buildFromTemplate([
    {label:"HWP",submenu:[{role:'about'},{id:'update',label:'Check for Updates…',click:()=>void checkUpdates(true)},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
    {role:'editMenu'},
    {label:'View',submenu:[{label:'Reload HWP…',accelerator:'CmdOrCtrl+R',click:confirmReload},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},
    {role:'windowMenu'}
  ]);
  Menu.setApplicationMenu(menu);
  updateMenu = menu.getMenuItemById('update');
}
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('web-contents-created', (_event, contents) => protect(contents));
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(() => { configureSession(); displayManager=createDisplayManager({app,home:HOME,securePrefs,getOperator:()=>mainWindow}); createMenu(); createWindow(); configureUpdater(); app.on('activate',()=>{if(!mainWindow && !quitting) createWindow();}); });
  app.on('before-quit', () => { quitting = true; displayManager?.closeAll(); if (timer) clearInterval(timer); });
}
