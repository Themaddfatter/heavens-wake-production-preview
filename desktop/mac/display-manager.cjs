'use strict';
const { BrowserWindow, screen, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const roles = new Set(['audience','stage']);
function createDisplayManager({app,home,securePrefs,getOperator}) {
 const file=path.join(app.getPath('userData'),'screen-assignments.json');
 let assignments={}; try{const stored=JSON.parse(fs.readFileSync(file,'utf8'));for(const [id,role] of Object.entries(stored))if(/^[-]?\d+$/.test(id)&&(roles.has(role)||role==='off'))assignments[id]=role;}catch{}
 const enabled={audience:false,stage:false},windows=new Map(),identifiers=new Set();let topologyTimer=null,localAudienceRequested=false;const failures={};
 function displays(){const op=getOperator(),primary=op&&!op.isDestroyed()?screen.getDisplayMatching(op.getBounds()).id:screen.getPrimaryDisplay().id;return screen.getAllDisplays().map(d=>({id:String(d.id),label:d.label||('Display '+d.id),width:d.size.width,height:d.size.height,scaleFactor:d.scaleFactor,bounds:d.bounds,primary:d.id===primary,internal:!!d.internal,role:roles.has(assignments[String(d.id)])?assignments[String(d.id)]:''}));}
 function status(){return {displays:displays(),assignments:{...assignments},enabled:{...enabled},outputs:Array.from(windows,([id,entry])=>({id,role:entry.role,ready:entry.ready})),failures:{...failures}};}
 function save(){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(assignments));fs.renameSync(file+'.tmp',file);}
 function close(id){const entry=windows.get(id);windows.delete(id);if(entry&&!entry.win.isDestroyed())entry.win.destroy();}
 function autoAssign(){let dirty=false;const connected=displays().filter(d=>!d.primary&&!d.internal),available=connected.filter(d=>!Object.hasOwn(assignments,d.id));for(const role of ['audience','stage']){if(!enabled[role]||connected.some(d=>assignments[d.id]===role)||!available.length)continue;assignments[available.shift().id]=role;dirty=true;}if(dirty)save();}
 function reconcile(){autoAssign();const current=displays(),wanted=new Map(current.filter(d=>d.role&&enabled[d.role]&&!d.primary&&!d.internal).map(d=>[d.id,d]));
  if(enabled.audience&&localAudienceRequested){if([...wanted.values()].some(d=>d.role==='audience'))localAudienceRequested=false;else{const local=current.find(d=>d.primary);if(local)wanted.set(local.id,{...local,role:'audience',local:true});}}
  for(const [id,entry] of windows)if(!wanted.has(id)||wanted.get(id).role!==entry.role)close(id);
  for(const [id,d] of wanted){const existing=windows.get(id);if(existing){if(JSON.stringify(existing.bounds)!==JSON.stringify(d.bounds)){existing.win.setBounds(d.bounds);existing.bounds=d.bounds;}continue;}
   const win=new BrowserWindow({...d.bounds,frame:false,show:false,backgroundColor:'#000000',skipTaskbar:true,focusable:d.role==='audience',fullscreenable:false,enableLargerThanScreen:d.role==='audience',roundedCorners:false,acceptFirstMouse:true,resizable:false,movable:false,minimizable:false,maximizable:false,hasShadow:false,webPreferences:d.role==='audience'?{...securePrefs,preload:path.join(__dirname,'audience-output.cjs')}:securePrefs});
   delete failures[id];windows.set(id,{win,role:d.role,bounds:d.bounds,ready:false});
   win.setAlwaysOnTop(true,'screen-saver');win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});win.setBounds(d.bounds);win.setMenuBarVisibility?.(false);
   win.once('ready-to-show',()=>{if(!win.isDestroyed()&&windows.get(id)?.win===win){const current=windows.get(id);win.setBounds(current.bounds);if(current.role==='audience'){// Use only a display-sized high-level window. macOS kiosk/simple fullscreen changes application-wide presentation options.
    win.webContents?.setZoomFactor?.(1);if(d.local)win.show();else win.showInactive();win.setBounds(current.bounds);win.setAlwaysOnTop(true,'screen-saver');}else win.showInactive();current.ready=true;notify();}});
   win.on('closed',()=>{if(windows.get(id)?.win===win){windows.delete(id);if(d.role==='audience'){enabled.audience=false;localAudienceRequested=false;reconcile();}notify();}});
   const url=new URL(home);url.searchParams.set('display',d.role);url.searchParams.set('nativeOutput','1');
   if(d.role==='audience'&&win.webContents){const guard=(event,target)=>{try{const next=new URL(target);if(next.origin===url.origin&&next.searchParams.get('display')==='audience')return}catch{}event.preventDefault()};win.webContents.on('will-navigate',guard);win.webContents.on('will-redirect',guard);win.webContents.on('context-menu',event=>event.preventDefault());win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='Escape'&&!windows.get(id)?.ready){event.preventDefault();setEnabled('audience',false);}});}
   win.loadURL(url.toString()).catch(error=>{if(windows.get(id)?.win!==win)return;failures[id]=String(error.message||error);console.error('HWP output:',error);close(id);notify();});
  }
 }
 function notify(){const op=getOperator();if(op&&!op.isDestroyed())op.webContents.send('hwp:screens:changed',status());}
 function changed(){reconcile();notify();}
 function assign(id,role){id=String(id);const display=displays().find(d=>d.id===id);if(role!==''&&!roles.has(role))throw Error('Invalid screen role');if(!display||display.primary||display.internal)throw Error('Select an external extended display.');if(role)assignments[id]=role;else assignments[id]='off';save();changed();return status();}
 function setEnabled(role,on){if(!roles.has(role)||typeof on!=='boolean')throw Error('Invalid output');if(role==='audience'&&!on)localAudienceRequested=false;if(enabled[role]!==on){enabled[role]=on;changed();}return status();}
 function activateAudience(){localAudienceRequested=true;enabled.audience=true;changed();return status();}
 function identify(){for(const w of identifiers)if(!w.isDestroyed())w.destroy();identifiers.clear();for(const [index,d] of displays().entries()){
  if(windows.get(d.id)?.role==='audience'||d.role==='audience'&&enabled.audience)continue;
  const win=new BrowserWindow({x:d.bounds.x+Math.max(0,Math.floor((d.width-260)/2)),y:d.bounds.y+Math.max(0,Math.floor((d.height-140)/2)),width:Math.min(260,d.width),height:Math.min(140,d.height),frame:false,show:false,focusable:false,skipTaskbar:true,backgroundColor:'#124c88',webPreferences:securePrefs});
  identifiers.add(win);win.setAlwaysOnTop(true,'screen-saver');win.once('ready-to-show',()=>{if(!win.isDestroyed())win.showInactive();});win.on('closed',()=>identifiers.delete(win));
  const content='<body style="margin:0;background:#124c88;color:white;display:grid;place-items:center;height:100vh;font:700 25px system-ui;text-align:center">Display '+(index+1)+'<br>'+d.width+' × '+d.height+'</body>';
  win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(content)).catch(()=>{if(!win.isDestroyed())win.destroy();});
  setTimeout(()=>{if(!win.isDestroyed())win.destroy();},2500).unref();
 }return status();}
 function authorize(event){const op=getOperator();if(!op||op.isDestroyed()||event.sender!==op.webContents||event.senderFrame!==event.sender.mainFrame||new URL(event.senderFrame.url).origin!==new URL(home).origin)throw Error('Unauthorized display request');}
 for(const [name,handler] of Object.entries({list:status,assign,enable:setEnabled,activateAudience,identify}))ipcMain.handle('hwp:screens:'+name,(event,...args)=>{authorize(event);return handler(...args);});
 ipcMain.handle('hwp:screens:closeAudience',(event)=>{const entry=[...windows.values()].find(e=>e.role==='audience'&&!e.win.isDestroyed()&&e.win.webContents===event.sender);if(!entry||event.senderFrame!==event.sender.mainFrame)throw Error('Unauthorized audience close');const url=new URL(event.senderFrame.url);if(url.origin!==new URL(home).origin||url.searchParams.get('display')!=='audience')throw Error('Unauthorized audience close');return setEnabled('audience',false);});
 function topologyChanged(){clearTimeout(topologyTimer);topologyTimer=setTimeout(()=>{topologyTimer=null;changed();},650);}
 for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,topologyChanged);
 return {status,identify,closeAll(){clearTimeout(topologyTimer);for(const id of windows.keys())close(id);enabled.audience=false;localAudienceRequested=false;enabled.stage=false;},};
}
module.exports={createDisplayManager};
