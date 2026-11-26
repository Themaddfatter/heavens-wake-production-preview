'use strict';
const { BrowserWindow, screen, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const roles = new Set(['audience','stage']);
function createDisplayManager({app,home,securePrefs,getOperator}) {
 const file=path.join(app.getPath('userData'),'screen-assignments.json');
 let assignments={}; try{const stored=JSON.parse(fs.readFileSync(file,'utf8'));for(const [id,role] of Object.entries(stored))if(/^[-]?\d+$/.test(id)&&roles.has(role))assignments[id]=role;}catch{}
 const enabled={audience:false,stage:false},windows=new Map(),identifiers=new Set();
 function displays(){const primary=screen.getPrimaryDisplay().id;return screen.getAllDisplays().map(d=>({id:String(d.id),label:d.label||('Display '+d.id),width:d.size.width,height:d.size.height,scaleFactor:d.scaleFactor,bounds:d.bounds,primary:d.id===primary,internal:!!d.internal,role:assignments[String(d.id)]||''}));}
 function status(){return {displays:displays(),assignments:{...assignments},enabled:{...enabled}};}
 function save(){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(assignments));fs.renameSync(file+'.tmp',file);}
 function close(id){const entry=windows.get(id);windows.delete(id);if(entry&&!entry.win.isDestroyed())entry.win.destroy();}
 function reconcile(){const current=displays(),wanted=new Map(current.filter(d=>d.role&&enabled[d.role]&&!d.primary&&!d.internal).map(d=>[d.id,d]));
  for(const [id,entry] of windows)if(!wanted.has(id)||wanted.get(id).role!==entry.role)close(id);
  for(const [id,d] of wanted){const existing=windows.get(id);if(existing){if(JSON.stringify(existing.bounds)!==JSON.stringify(d.bounds)){existing.win.setBounds(d.bounds);existing.bounds=d.bounds;}continue;}
   const win=new BrowserWindow({...d.bounds,frame:false,show:false,backgroundColor:'#000000',skipTaskbar:true,focusable:false,fullscreenable:false,hasShadow:false,webPreferences:securePrefs});
   windows.set(id,{win,role:d.role,bounds:d.bounds});
   win.setAlwaysOnTop(true,'screen-saver');win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});win.setBounds(d.bounds);
   win.once('ready-to-show',()=>{if(!win.isDestroyed()){win.setBounds(d.bounds);win.showInactive();}});
   win.on('closed',()=>{if(windows.get(id)?.win===win)windows.delete(id);});
   const url=new URL(home);url.searchParams.set('display',d.role);url.searchParams.set('nativeOutput','1');
   win.loadURL(url.toString()).catch(error=>{console.error('HWP output:',error);close(id);});
  }
 }
 function notify(){const op=getOperator();if(op&&!op.isDestroyed())op.webContents.send('hwp:screens:changed',status());}
 function changed(){reconcile();notify();}
 function assign(id,role){id=String(id);const display=displays().find(d=>d.id===id);if(role!==''&&!roles.has(role))throw Error('Invalid screen role');if(!display||display.primary||display.internal)throw Error('Select an external extended display.');if(role)assignments[id]=role;else delete assignments[id];save();changed();return status();}
 function setEnabled(role,on){if(!roles.has(role)||typeof on!=='boolean')throw Error('Invalid output');if(enabled[role]!==on){enabled[role]=on;changed();}return status();}
 function identify(){for(const w of identifiers)if(!w.isDestroyed())w.destroy();identifiers.clear();for(const [index,d] of displays().entries()){
  const win=new BrowserWindow({x:d.bounds.x+Math.max(0,Math.floor((d.width-260)/2)),y:d.bounds.y+Math.max(0,Math.floor((d.height-140)/2)),width:Math.min(260,d.width),height:Math.min(140,d.height),frame:false,show:false,focusable:false,skipTaskbar:true,backgroundColor:'#124c88',webPreferences:securePrefs});
  identifiers.add(win);win.setAlwaysOnTop(true,'screen-saver');win.once('ready-to-show',()=>{if(!win.isDestroyed())win.showInactive();});win.on('closed',()=>identifiers.delete(win));
  const content='<body style="margin:0;background:#124c88;color:white;display:grid;place-items:center;height:100vh;font:700 25px system-ui;text-align:center">Display '+(index+1)+'<br>'+d.width+' × '+d.height+'</body>';
  win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(content)).catch(()=>{if(!win.isDestroyed())win.destroy();});
  setTimeout(()=>{if(!win.isDestroyed())win.destroy();},2500).unref();
 }return status();}
 function authorize(event){const op=getOperator();if(!op||op.isDestroyed()||event.sender!==op.webContents||event.senderFrame!==event.sender.mainFrame||new URL(event.senderFrame.url).origin!==new URL(home).origin)throw Error('Unauthorized display request');}
 for(const [name,handler] of Object.entries({list:status,assign,enable:setEnabled,identify}))ipcMain.handle('hwp:screens:'+name,(event,...args)=>{authorize(event);return handler(...args);});
 for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,changed);
 return {status,identify,closeAll(){for(const id of windows.keys())close(id);enabled.audience=false;enabled.stage=false;},};
}
module.exports={createDisplayManager};
