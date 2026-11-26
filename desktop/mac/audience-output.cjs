'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// The native output covers its own display; HTML fullscreen could hide operator system UI.
contextBridge.exposeInMainWorld('hwpNativeOutput',true);
function close(){void ipcRenderer.invoke('hwp:screens:closeAudience').catch(console.error);}
// Allow the existing page handler to broadcast the off state before native teardown.
window.addEventListener('click',event=>{if(event.isTrusted&&event.target?.closest?.('.hwp-audience-close'))close();},true);
window.addEventListener('keydown',event=>{if(event.isTrusted&&event.key==='Escape')close();},true);
