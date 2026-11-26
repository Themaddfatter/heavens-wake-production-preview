'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// The native window owns fullscreen; never enter HTML fullscreen on top of kiosk.
contextBridge.exposeInMainWorld('hwpNativeOutput',true);
function close(){void ipcRenderer.invoke('hwp:screens:closeAudience').catch(console.error);}
// Allow the existing page handler to broadcast the off state before native teardown.
window.addEventListener('click',event=>{if(event.isTrusted&&event.target?.closest?.('.hwp-audience-close'))close();},true);
window.addEventListener('keydown',event=>{if(event.isTrusted&&event.key==='Escape')close();},true);
