(()=>{'use strict';
if(new URLSearchParams(location.search).get('display')==='audience')return;
const roles=['audience','stage'],listeners=new Set(),outputs=new Map();let details=null,enabled={audience:false,stage:false},assignments={};
try{assignments=JSON.parse(localStorage.getItem('hwp-screen-assignments-v3')||'{}')}catch{}
const id=d=>[d.label,d.left,d.top,d.width,d.height].join('|');
const displays=()=>Array.from(details?.screens||[]).map(d=>({id:id(d),label:d.label||'Display',width:d.width,height:d.height,scaleFactor:d.devicePixelRatio||1,primary:!!d.isPrimary,internal:!!d.isInternal,bounds:{x:d.left,y:d.top,width:d.width,height:d.height},role:roles.includes(assignments[id(d)])?assignments[id(d)]:''}));
const status=()=>({displays:displays(),enabled:{...enabled},assignments:{...assignments},supported:typeof window.getScreenDetails==='function',permission:!!details,browserHelperReady,browserHelperOutput});
function save(){try{localStorage.setItem('hwp-screen-assignments-v3',JSON.stringify(assignments))}catch{}}
function notify(){const value=status();listeners.forEach(fn=>fn(value));return value}
let localAudience=null,permissionNotice=null;const audienceControllers=new Map();
let browserHelperReady=false,browserHelperOutput=false,browserHelperTarget=null,browserHelperSequence=0;
const browserHelperPending=new Map();
function helperSend(action,payload={},timeout=3000){
 const requestId='hwp-'+(++browserHelperSequence)+'-'+Date.now();
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{browserHelperPending.delete(requestId);reject(Error('Browser fullscreen helper did not respond'))},timeout);browserHelperPending.set(requestId,{resolve,reject,timer});window.postMessage({source:'hwp-web',requestId,action,...payload},location.origin)});
}
window.addEventListener('message',event=>{if(event.source!==window||event.origin!==location.origin||event.data?.source!=='hwp-browser-fullscreen')return;const data=event.data;
 if(data.event==='output-closed'){browserHelperOutput=false;browserHelperTarget=null;enabled.audience=false;signalAudienceClosed();notify();return}
 const pending=browserHelperPending.get(data.requestId);if(!pending)return;clearTimeout(pending.timer);browserHelperPending.delete(data.requestId);if(data.ok)pending.resolve(data);else pending.reject(Error(data.error||'Browser fullscreen helper failed'));
});
function detectHelper(){return helperSend('ping').then(()=>{browserHelperReady=true;notify();return true},()=>false)}
void detectHelper();window.addEventListener('focus',()=>{if(!browserHelperReady)void detectHelper()});
async function startHelperOutput(d){
 try{clearAudienceNotice();const result=await helperSend('open',{bounds:d.bounds},12000);if(!result.fullscreen)throw Error('Browser window did not enter fullscreen');browserHelperOutput=true;browserHelperTarget=d.id;return notify()}
 catch(error){enabled.audience=false;signalAudienceClosed();notify();showAudienceHelp(error.message);return status()}
}

function audienceBrowserHelp(ua,es=false){
 const edge=/Edg\//i.test(ua),opera=/OPR\//i.test(ua),brave=!!navigator.brave,vivaldi=/Vivaldi\//i.test(ua),chrome=/Chrome\//i.test(ua),firefox=/Firefox\//i.test(ua),safari=/Safari\//i.test(ua)&&!chrome;
 const mobile=/Android|iPhone|iPad/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const name=edge?'Microsoft Edge':opera?'Opera':brave?'Brave':vivaldi?'Vivaldi':chrome?'Google Chrome':firefox?'Firefox':safari?'Safari':es?'tu navegador':'your browser';
 const scheme=edge?'edge':opera?'opera':brave?'brave':vivaldi?'vivaldi':'chrome';
 if(!mobile&&(chrome||edge||opera||brave||vivaldi)){
  const site=location.origin;
  return {name,steps:es?[
   'En HWP, abre Configuración → Pantallas y pulsa Detect Displays (Detectar pantallas), o el botón de abajo.',
   'Si el navegador pregunta si HWP puede administrar ventanas en tus pantallas, selecciona Permitir. Si no aparece una pregunta, puede que el permiso ya esté concedido, bloqueado o no disponible.',
   'Si se bloquean las ventanas emergentes, abre Configuración de sitios desde el icono a la izquierda de '+location.hostname+' y permite las ventanas emergentes para este sitio.',
   'Vuelve a HWP y activa Pantalla de audiencia. Si no entra en pantalla completa, utiliza la extensión HWP de Chrome. No cambies configuraciones que no aparecen en tu navegador.'
  ]:[
   'In HWP, open Settings → Screens and click Detect Displays, or use the button below.',
   'If the browser asks whether HWP may manage windows on your displays, choose Allow. If no prompt appears, the permission may already be granted, blocked or unavailable.',
   'If pop-ups are blocked, open Site settings using the icon to the left of '+location.hostname+' and allow Pop-ups and redirects for this site.',
   'Return to HWP and turn Audience on. If fullscreen is still denied, use the HWP Chrome extension below. Do not look for settings that your browser does not offer.'
  ],addresses:[scheme+'://settings/content/siteDetails?site='+encodeURIComponent(site),scheme+'://settings/content/popups'],canDetect:true};

 }
 return {name,steps:es?['Este navegador no ofrece los permisos necesarios para controlar automáticamente una pantalla externa de forma fiable.','Abre HWP en Chrome o Edge de escritorio, o usa la aplicación HWP de escritorio.']:['This browser does not provide the permissions needed for reliable automatic fullscreen on a separate display.','Open HWP in desktop Chrome or Edge, or use the HWP desktop application.'],addresses:[]};
}
function audienceFailure(reason){enabled.audience=false;signalAudienceClosed();notify();showAudienceHelp(reason)}
function showAudienceHelp(reason='Configure the browser permissions before turning Audience on.'){
 if(permissionNotice)permissionNotice.remove();
 const es=document.documentElement.lang==='es',help=audienceBrowserHelp(navigator.userAgent,es),box=document.createElement('section');permissionNotice=box;box.setAttribute('role','alert');
 Object.assign(box.style,{position:'fixed',top:'70px',right:'16px',width:'min(480px,calc(100vw - 32px))',maxHeight:'calc(100vh - 90px)',overflow:'auto',boxSizing:'border-box',zIndex:'2147483647',padding:'18px',borderRadius:'12px',background:'var(--bg-2,#222)',color:'var(--text,#fff)',border:'1px solid var(--line,#888)',boxShadow:'0 4px 20px #0006',fontSize:'14px',lineHeight:'1.5'});
 const add=(tag,value,parent=box)=>{const el=document.createElement(tag);el.textContent=value;parent.append(el);return el};
 const title=add('strong',es?'Configurar pantalla de audiencia en '+help.name:'Set up Audience fullscreen in '+help.name);title.style.fontSize='17px';
 add('p',es?'No se pudo abrir la pantalla de audiencia automáticamente.':reason.replace(/^Chrome /,help.name+' '));
 const steps=add('ol','');steps.style.paddingLeft='22px';help.steps.forEach(step=>{const li=add('li',step,steps);li.style.marginBottom='7px'});
 if(help.addresses.length){for(const address of [...help.addresses,help.alternate].filter(Boolean)){const row=add('div','');Object.assign(row.style,{display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'});const field=document.createElement('input');field.readOnly=true;field.value=address;field.setAttribute('aria-label',es?'Dirección de configuración':'Settings address');Object.assign(field.style,{minWidth:'0',flex:'1',padding:'6px',color:'inherit',background:'var(--bg-3,#333)',border:'1px solid var(--line,#888)'});field.onclick=()=>field.select();row.append(field);const copy=add('button',es?'Copiar':'Copy',row);copy.type='button';copy.onclick=async()=>{field.select();try{await navigator.clipboard.writeText(address);copy.textContent=es?'Copiado':'Copied'}catch{try{if(document.execCommand('copy'))copy.textContent=es?'Copiado':'Copied'}catch{}}};}}
 if(help.canDetect&&typeof window.getScreenDetails==='function'){const detect=add('button',es?'Detectar pantallas':'Detect Displays');detect.type='button';detect.onclick=async()=>{try{await connect();detect.textContent=es?'Pantallas detectadas':'Displays detected'}catch(e){detect.textContent=es?'Permiso no disponible':'Display permission unavailable';detect.title=e.message}};}
 add('p',es?'La extensión de Chrome de HWP puede poner solo la ventana de audiencia en pantalla completa. No abre la aplicación de escritorio.':'The optional HWP Chrome extension can fullscreen only the separate Audience browser window. It does not launch the desktop app or move your operator window.');const download=add('a',es?'Descargar extensión de Chrome':'Download Chrome fullscreen extension');download.href='./hwp-audience-chrome.zip';download.style.display='block';add('p',es?'Descomprime el ZIP. Abre chrome://extensions, activa el modo de desarrollador y selecciona Cargar descomprimida. Elige la carpeta de la extensión y recarga HWP.':'Unzip the download. Open chrome://extensions, enable Developer mode, choose Load unpacked, select the extension folder, and reload HWP.');
 add('p',es?'No es necesario hacer clic en la pantalla de audiencia.':'No action is required on the Audience screen.');
 const dismiss=add('button',es?'Cerrar':'Dismiss');dismiss.type='button';Object.assign(dismiss.style,{padding:'6px 14px',borderRadius:'6px',border:'1px solid var(--line,#888)',background:'var(--amber,#3276b8)',color:'var(--hwp-accent-ink,#fff)',cursor:'pointer'});dismiss.onclick=()=>{box.remove();permissionNotice=null};document.body.append(box)
}
function showFullscreenRetry(activate){
 if(permissionNotice)permissionNotice.remove();
 const es=document.documentElement.lang==='es',box=document.createElement('section');permissionNotice=box;box.setAttribute('role','alert');
 Object.assign(box.style,{position:'fixed',top:'70px',right:'16px',width:'min(420px,calc(100vw - 32px))',padding:'16px',borderRadius:'10px',background:'var(--bg-2,#222)',color:'var(--text,#fff)',border:'1px solid var(--line,#888)',zIndex:'2147483647',boxShadow:'0 4px 20px #0006'});
 const text=document.createElement('p');text.textContent=es?'La pantalla ya está detectada. Chrome consumió el permiso del clic al abrir la ventana. Activa la pantalla completa desde este controlador. No pulses nada en el proyector.':'Your display is already detected. The browser did not carry the first click into its new output window. Complete fullscreen from this operator screen; do not click the Audience display.';
 const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=es?'Activar pantalla completa':'Activate Audience fullscreen';button.onclick=activate;
 const link=document.createElement('a');link.href='./hwp-audience-chrome.zip';link.textContent=es?'Obtener extensión de Chrome para HWP':'Get HWP Chrome fullscreen extension';link.style.display='block';link.style.marginTop='10px';box.append(text,button,link);document.body.append(box);try{window.focus()}catch{}
}
function clearAudienceNotice(){permissionNotice?.remove();permissionNotice=null}
function signalAudienceClosed(){try{const bus=new BroadcastChannel('vesper-show-v1');bus.postMessage({type:'hwp-audience-close'});bus.close()}catch{}}
function audienceUrl(){const url=new URL(location.href);url.searchParams.set('display','audience');url.searchParams.delete('nativeOutput');url.hash='';return url.href}
// Keep the fullscreen document stable: navigating a popup after requesting fullscreen
// exits fullscreen. The isolated audience iframe is the only visual output.
function mountAudience(host,url,onClose,targetScreen,onFailure){
 const doc=host.document,root=doc.documentElement,layer=doc.createElement('div'),frame=doc.createElement('iframe');
 Object.assign(layer.style,{position:'fixed',inset:'0',width:'100%',height:'100%',margin:'0',padding:'0',border:'0',background:'#000',overflow:'hidden',zIndex:'2147483647',display:'grid',placeItems:'center'});
 frame.id='hwp-audience-local-frame';frame.title='Audience output';frame.allow='fullscreen';frame.allowFullscreen=true;frame.src=url;
 Object.assign(frame.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',margin:'0',padding:'0',background:'#000',display:'none'});
 layer.append(frame);doc.body.append(layer);
 let closed=false,wasFull=false,requesting=false,delegating=false,visible=true;
 const isFull=()=>{const active=doc.fullscreenElement||doc.webkitFullscreenElement;return active===layer||active===root};
 function sync(){
  if(closed)return;
  if(isFull()){wasFull=true;frame.style.display=visible?'block':'none';clearAudienceNotice();return}
  frame.style.display='none';
  if(wasFull)close(true);
 }
 function fail(){if(closed||isFull())return;if(onFailure){onFailure();return}close(false);audienceFailure('Browser rejected the Audience fullscreen request.')}
 function enter(){
  if(closed||requesting||isFull())return;
  const request=layer.requestFullscreen||layer.webkitRequestFullscreen;
  if(!request){fail();return}
  requesting=true;
  const options={navigationUI:'hide'};if(targetScreen)options.screen=targetScreen;
  const done=()=>{requesting=false;if(closed)return;sync();if(!isFull())fail()};
  try{Promise.resolve(request.call(layer,options)).then(done,done)}catch{done()}
 }
 function message(event){
  if(event.origin!==location.origin)return;
  if(event.source===frame.contentWindow&&event.data?.type==='hwp-audience-close'){close(true);return}
  if(host!==window&&event.source===window&&event.data?.type==='hwp-audience-fullscreen-delegated'){delegating=false;enter()}
 }
 function delegate(){
  if(closed||isFull()||requesting||delegating)return;
  if(host===window){enter();return}
  delegating=true;
  // Chrome 104+: pass the operator's real click to the existing output window.
  // The fullscreen request runs in the receiving window's message handler.
  try{host.postMessage({type:'hwp-audience-fullscreen-delegated'},{targetOrigin:location.origin,delegate:'fullscreen'})}
  catch{delegating=false;fail()}
 }
 function setVisible(on){visible=!!on;sync()}
 function key(event){if(event.key==='Escape'){close(true);return}if(event.key==='f'||event.key==='F'){event.preventDefault();enter()}}
 function close(user=false){
  if(closed)return;closed=true;
  doc.removeEventListener('fullscreenchange',sync);doc.removeEventListener('webkitfullscreenchange',sync);
  host.removeEventListener('message',message);host.removeEventListener('keydown',key);
  if(isFull())try{Promise.resolve((doc.exitFullscreen||doc.webkitExitFullscreen)?.call(doc)).catch(()=>{})}catch{}
  layer.remove();onClose(user);
 }
 doc.addEventListener('fullscreenchange',sync);doc.addEventListener('webkitfullscreenchange',sync);
 host.addEventListener('message',message);host.addEventListener('keydown',key);
 // Request immediately while a click's transient activation is still available.
 // An existing output window can receive fullscreen capability from the operator.
 // A newly created window may require one fresh operator-side gesture.
 return {enter,delegate,close,frame,setVisible,isFull};
}
function closeLocalAudience(){const entry=localAudience;if(!entry)return;localAudience=null;entry.close()}
function openLocalAudience(){
 if(localAudience){localAudience.enter();return}
 document.documentElement.dataset.hwpAudienceLocal='1';
 localAudience=mountAudience(window,audienceUrl(),user=>{localAudience=null;delete document.documentElement.dataset.hwpAudienceLocal;if(user){enabled.audience=false;signalAudienceClosed();notify()}});
 localAudience.enter();
}
function openOutput(d){
 const url=new URL(location.href);url.searchParams.set('display',d.role);url.searchParams.delete('nativeOutput');url.hash='';
 const b=d.bounds,initial=b,features='popup=yes,left='+initial.x+',top='+initial.y+',width='+initial.width+',height='+initial.height;
 const win=window.open(d.role==='audience'?'about:blank':url.href,'hwp-output-'+d.id.replace(/[^a-z0-9]/gi,'_'),features);
 if(!win){if(d.role==='audience')audienceFailure('The browser blocked the Audience popup.');return null;}
 try{win.moveTo(initial.x,initial.y);win.resizeTo(initial.width,initial.height)}catch{}
 if(d.role==='audience'){
  try{
   const doc=win.document;doc.title='Audience';
   Object.assign(doc.documentElement.style,{margin:'0',padding:'0',width:'100%',height:'100%',background:'#000',overflow:'hidden'});
   Object.assign(doc.body.style,{margin:'0',padding:'0',width:'100%',height:'100%',background:'#000',overflow:'hidden'});
   const audience=mountAudience(win,url.href,user=>{audienceControllers.delete(d.id);outputs.delete(d.id);clearAudienceNotice();if(user){enabled.audience=false;signalAudienceClosed();notify()}try{win.close()}catch{}},Array.from(details?.screens||[]).find(screen=>id(screen)===d.id),()=>showFullscreenRetry(()=>audience.delegate()));
   audienceControllers.set(d.id,audience);
   // The newly created popup may have consumed activation. Use delegation if
   // available; otherwise prepare it on the operator display for a fresh click.
   if(navigator.userActivation?.isActive)audience.delegate();else audience.enter();
  }catch{try{win.close()}catch{}audienceFailure('Could not initialize the Audience output.');return null}
 }
 return win;
}
function reconcile(){
 const free=displays().filter(d=>!d.primary&&!d.internal&&!Object.hasOwn(assignments,d.id));
 for(const role of roles)if(enabled[role]&&!displays().some(d=>!d.primary&&!d.internal&&d.role===role)&&free.length){assignments[free.shift().id]=role;save()}
 const assigned=displays().filter(d=>d.role&&!d.primary&&!d.internal),wanted=new Map(assigned.filter(d=>enabled[d.role]&&!(d.role==='audience'&&browserHelperReady)).map(d=>[d.id,d]));if(browserHelperTarget&&!assigned.some(d=>d.id===browserHelperTarget&&d.role==='audience')){browserHelperOutput=false;browserHelperTarget=null;enabled.audience=false;void helperSend('close').catch(()=>{});signalAudienceClosed()}
 if(localAudience&&[...wanted.values()].some(d=>d.role==='audience'))closeLocalAudience();
 for(const [key,entry] of outputs){
  const controller=audienceControllers.get(key),stillAssigned=assigned.some(d=>d.id===key&&d.role===entry.role);
  // Audience off blanks the already fullscreen output. Keep the browser window
  // ready so the next Audience click does not consume activation opening it again.
  if(entry.role==='audience'&&stillAssigned&&!entry.win.closed&&controller?.isFull()){controller.setVisible(enabled.audience);continue}
  if(!wanted.has(key)||wanted.get(key).role!==entry.role||entry.win.closed){controller?.close();try{entry.win.close()}catch{}outputs.delete(key);audienceControllers.delete(key)}
 }
 for(const [key,d] of wanted)if(!outputs.has(key)){const win=openOutput(d);if(win)outputs.set(key,{win,role:d.role})}
 return notify()
}
async function connect(){if(!window.getScreenDetails)throw Error('This browser does not support physical display detection. Use the desktop app or a compatible desktop browser.');if(!details){details=await window.getScreenDetails();let timer;details.addEventListener('screenschange',()=>{clearTimeout(timer);timer=setTimeout(reconcile,650)});details.addEventListener('currentscreenchange',notify)}return reconcile()}
window.hwpBrowserScreens={showAudienceHelp,list:async()=>status(),connect,assign:async(key,role)=>{if(role&&!roles.includes(role))throw Error('Invalid screen role');const d=displays().find(d=>d.id===key);if(!d||d.primary||d.internal)throw Error('Choose an external display');assignments[key]=role||'off';save();return reconcile()},activateAudience:async()=>{if(!details&&window.getScreenDetails&&window.screen?.isExtended){try{await connect()}catch{audienceFailure('Chrome denied access to the extended display.');return status()}}enabled.audience=true;return window.hwpBrowserScreens.openAudience()},openAudience:async()=>{enabled.audience=true;const external=displays().some(d=>!d.primary&&!d.internal&&(d.role==='audience'||!Object.hasOwn(assignments,d.id)));if(external){if(browserHelperReady){const free=displays().find(d=>!d.primary&&!d.internal&&!Object.hasOwn(assignments,d.id));if(!displays().some(d=>d.role==='audience'&&!d.primary&&!d.internal)&&free){assignments[free.id]='audience';save()}const selected=displays().find(d=>d.role==='audience'&&!d.primary&&!d.internal);if(selected)return startHelperOutput(selected)}const result=reconcile();for(const [key,controller] of audienceControllers){if(controller.isFull())controller.setVisible(true);else if(navigator.userActivation?.isActive)controller.delegate()}return result}openLocalAudience();return notify()},enable:async(role,on)=>{enabled[role]=!!on;if(role==='audience'&&!on){closeLocalAudience();clearAudienceNotice();if(browserHelperReady){browserHelperOutput=false;browserHelperTarget=null;void helperSend('close').catch(()=>{})}}return reconcile()},identify:async()=>{for(const d of displays()){const entry=outputs.get(d.id);if(d.role!=='audience'&&entry&&!entry.win.closed)try{const doc=entry.win.document,tag=doc.createElement('div');tag.textContent=d.label+' — '+d.width+' × '+d.height;Object.assign(tag.style,{position:'fixed',inset:'35% 10%',zIndex:2147483647,background:'#124c88',color:'white',display:'grid',placeItems:'center',font:'bold 32px system-ui'});doc.body.append(tag);setTimeout(()=>tag.remove(),2500)}catch{}}return status()},onChanged:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
if(window.getScreenDetails&&navigator.permissions)navigator.permissions.query({name:'window-management'}).then(p=>{if(p.state==='granted')connect().catch(()=>{});p.onchange=()=>{if(p.state==='granted')connect().catch(()=>{})}}).catch(()=>{});
window.addEventListener('pagehide',()=>{for(const controller of audienceControllers.values())controller.close();for(const entry of outputs.values())try{entry.win.close()}catch{}});
const selector='.toolbar [data-tip], .toolbar [title], .hwp-mobile-head [data-tip], .hwp-mobile-head [title]';let target=null,tip=null;
function hide(){target=null;if(tip)tip.hidden=true}
function show(el){const value=el.getAttribute('data-tip')||el.getAttribute('title');if(!value)return;target=el;if(!tip){tip=document.createElement('div');tip.className='hwp-floating-header-tip';tip.setAttribute('role','tooltip');document.body.append(tip)}tip.textContent=value;tip.hidden=false;const rect=el.getBoundingClientRect(),bar=el.closest('.toolbar,.hwp-mobile-head');const styles=getComputedStyle(bar||el);tip.style.background=styles.getPropertyValue('--amber').trim()||'#2873b8';tip.style.color=styles.getPropertyValue('--hwp-accent-ink').trim()||'#fff';tip.style.left=Math.max(6,Math.min(innerWidth-tip.offsetWidth-6,rect.left+(rect.width-tip.offsetWidth)/2))+'px';tip.style.top=(rect.bottom+7)+'px'}
document.addEventListener('pointerover',e=>{const el=e.target.closest?.(selector);if(el&&target!==el)show(el)});document.addEventListener('pointerout',e=>{if(target&&!target.contains(e.relatedTarget))hide()});document.addEventListener('focusin',e=>{const el=e.target.closest?.(selector);if(el)show(el)});document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide);window.addEventListener('resize',hide);document.addEventListener('scroll',hide,true);
})();