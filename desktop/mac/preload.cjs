'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hwpNativeScreens',{
 list:()=>ipcRenderer.invoke('hwp:screens:list'),
 assign:(id,role)=>ipcRenderer.invoke('hwp:screens:assign',id,role),
 enable:(role,on)=>ipcRenderer.invoke('hwp:screens:enable',role,on),
 identify:()=>ipcRenderer.invoke('hwp:screens:identify'),
 onChanged:callback=>{const listener=(_event,status)=>callback(status);ipcRenderer.on('hwp:screens:changed',listener);return()=>ipcRenderer.removeListener('hwp:screens:changed',listener);}
});
