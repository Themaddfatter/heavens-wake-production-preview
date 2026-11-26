(()=>{'use strict';
const params=new URLSearchParams(location.search);
if(params.get('display')==='audience')return;
// The operator companion is a UI for the original session, not a second operator.
if(params.has('hwpOperatorCompanion')){
 try{const owner=window.opener;if(owner&&owner.location.origin===location.origin&&owner.hwpOperatorCompanionToken===params.get('hwpOperatorCompanion')){window.hwpOperatorOwner=owner;window.hwpBrowserScreens=owner.hwpBrowserScreens;return}}catch{}
 return;
}
const roles=['audience','stage'],listeners=new Set(),outputs=new Map();let details=null,enabled={audience:false,stage:false},assignments={};
try{assignments=JSON.parse(localStorage.getItem('hwp-screen-assignments-v3')||'{}')}catch{}
const id=d=>[d.label,d.left,d.top,d.width,d.height].join('|');
const displays=()=>Array.from(details?.screens||[]).map(d=>({id:id(d),label:d.label||'Display',width:d.width,height:d.height,scaleFactor:d.devicePixelRatio||1,primary:!!d.isPrimary,internal:!!d.isInternal,bounds:{x:d.left,y:d.top,width:d.width,height:d.height},role:roles.includes(assignments[id(d)])?assignments[id(d)]:''}));
const status=()=>({displays:displays(),enabled:{...enabled},assignments:{...assignments},supported:typeof window.getScreenDetails==='function',permission:!!details});
function save(){try{localStorage.setItem('hwp-screen-assignments-v3',JSON.stringify(assignments))}catch{}}
function notify(){const value=status();listeners.forEach(fn=>fn(value));return value}
let localAudience=null,permissionNotice=null,companion=null,companionWatch=null,fullscreenTarget=null,opening=false;
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
   'Vuelve a HWP y activa Pantalla de audiencia. Si no entra en pantalla completa, utiliza HWP de escritorio. No cambies configuraciones que no aparecen en tu navegador.'
  ]:[
   'In HWP, open Settings → Screens and click Detect Displays, or use the button below.',
   'If the browser asks whether HWP may manage windows on your displays, choose Allow. If no prompt appears, the permission may already be granted, blocked or unavailable.',
   'If pop-ups are blocked, open Site settings using the icon to the left of '+location.hostname+' and allow Pop-ups and redirects for this site.',
   'Return to HWP and turn Audience on. If fullscreen is still denied, use the HWP desktop app. Do not look for settings that your browser does not offer.'
  ],addresses:[scheme+'://settings/content/siteDetails?site='+encodeURIComponent(site),scheme+'://settings/content/popups'],canDetect:true};

 }
 return {name,steps:es?['Este navegador no ofrece los permisos necesarios para controlar automáticamente una pantalla externa de forma fiable.','Abre HWP en Chrome o Edge de escritorio, o usa la aplicación HWP de escritorio.']:['This browser does not provide the permissions needed for reliable automatic fullscreen on a separate display.','Open HWP in desktop Chrome or Edge, or use the HWP desktop application.'],addresses:[]};
}
function audienceFailure(reason){
 enabled.audience=false;signalAudienceClosed();notify();clearAudienceNotice();
 console.error('HWP Audience output:',reason);
 const box=document.createElement('section');permissionNotice=box;box.setAttribute('role','alert');
 Object.assign(box.style,{position:'fixed',top:'70px',right:'16px',width:'min(460px,calc(100vw - 32px))',padding:'16px',borderRadius:'10px',background:'var(--bg-2,#222)',color:'var(--text,#fff)',border:'1px solid var(--line,#888)',zIndex:'2147483647',boxShadow:'0 4px 20px #0006'});
 const title=document.createElement('strong');title.textContent='Audience could not start';
 const detail=document.createElement('p');detail.textContent=String(reason);
 const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Dismiss';close.onclick=clearAudienceNotice;
 box.append(title,detail,close);document.body.append(box)
}
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
 add('p',es?'La pantalla completa automática sin interacción está restringida por Chrome a aplicaciones web aisladas y sitios autorizados mediante políticas administrativas. HWP es un sitio web normal. Para una salida automática fiable sin pulsar en la pantalla de audiencia, utiliza HWP de escritorio.':'Chrome restricts gesture-free Automatic fullscreen primarily to Isolated Web Apps and sites authorized by enterprise policy. HWP is a regular website. For reliable automatic output without clicking the Audience screen, use the HWP desktop app.');
 add('p',es?'No es necesario hacer clic en la pantalla de audiencia.':'No action is required on the Audience screen.');
 const dismiss=add('button',es?'Cerrar':'Dismiss');dismiss.type='button';Object.assign(dismiss.style,{padding:'6px 14px',borderRadius:'6px',border:'1px solid var(--line,#888)',background:'var(--amber,#3276b8)',color:'var(--hwp-accent-ink,#fff)',cursor:'pointer'});dismiss.onclick=()=>{box.remove();permissionNotice=null};document.body.append(box)
}
function clearAudienceNotice(){permissionNotice?.remove();permissionNotice=null}
function signalAudienceClosed(){try{const bus=new BroadcastChannel('vesper-show-v1');bus.postMessage({type:'hwp-audience-close'});bus.close()}catch{}}
function audienceUrl(){const url=new URL(location.href);url.searchParams.delete('hwpOperatorCompanion');url.searchParams.set('display','audience');url.searchParams.delete('nativeOutput');url.hash='';return url.href}
function makeAudienceLayer(){
 const layer=document.createElement('div'),frame=document.createElement('iframe');
 Object.assign(layer.style,{position:'fixed',inset:'0',width:'100%',height:'100%',margin:'0',padding:'0',border:'0',background:'#000',overflow:'hidden',zIndex:'2147483647'});
 frame.id='hwp-audience-local-frame';frame.title='Audience output';frame.allow='fullscreen';frame.allowFullscreen=true;frame.src=audienceUrl();
 Object.assign(frame.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',margin:'0',padding:'0',background:'#000'});
 layer.append(frame);document.body.append(layer);
 document.documentElement.dataset.hwpAudienceLocal='1';
 return {layer,frame};
}
function closeLocalAudience(user=false){
 const entry=localAudience;if(!entry)return;
 localAudience=null;fullscreenTarget=null;opening=false;clearInterval(companionWatch);companionWatch=null;
 const popup=companion;companion=null;delete window.hwpOperatorCompanionToken;
 if(popup&&!popup.closed)try{popup.close()}catch{}
 if(document.fullscreenElement===entry.layer||document.webkitFullscreenElement===entry.layer)try{Promise.resolve((document.exitFullscreen||document.webkitExitFullscreen).call(document)).catch(()=>{})}catch{}
 entry.layer.remove();delete document.documentElement.dataset.hwpAudienceLocal;
 if(user){enabled.audience=false;signalAudienceClosed();notify()}
 try{window.focus()}catch{}
}
function operatorUrl(token){const url=new URL(location.href);url.searchParams.delete('display');url.searchParams.delete('nativeOutput');url.searchParams.set('hwpOperatorCompanion',token);url.hash='';return url.href}
function operatorBounds(){const d=details?.currentScreen||window.screen;return {x:window.screenX??d.availLeft??d.left??0,y:window.screenY??d.availTop??d.top??0,width:Math.max(400,Math.min(window.outerWidth||d.availWidth,d.availWidth||d.width)),height:Math.max(300,Math.min(window.outerHeight||d.availHeight,d.availHeight||d.height))}}
async function openLocalAudience(targetScreen){
 if(opening||localAudience)return status();
 clearAudienceNotice();opening=true;
 const bounds=operatorBounds(),entry=makeAudienceLayer();localAudience=entry;fullscreenTarget=targetScreen?id(targetScreen):null;
 try{
  const options={navigationUI:'hide'};if(targetScreen)options.screen=targetScreen;
  // Fullscreen FIRST, in the original click. Chromium's fullscreen companion
  // window flow permits the following popup on a different screen.
  const request=entry.layer.requestFullscreen||entry.layer.webkitRequestFullscreen;
  if(!request)throw Error('Fullscreen API is unavailable');
  await request.call(entry.layer,options);
  if(localAudience!==entry)return status();
  if(document.fullscreenElement!==entry.layer&&document.webkitFullscreenElement!==entry.layer)throw Error('The fullscreen request did not enter fullscreen');
  if(targetScreen){
   const token=crypto.randomUUID();window.hwpOperatorCompanionToken=token;
   const features='popup=yes,left='+bounds.x+',top='+bounds.y+',width='+bounds.width+',height='+bounds.height;
   companion=window.open(operatorUrl(token),'hwp-operator-companion',features);
   if(!companion)throw Error('The operator companion could not open after fullscreen');
   try{companion.focus()}catch{}
   companionWatch=setInterval(()=>{if(companion?.closed)closeLocalAudience(true)},500);
  }
  opening=false;return notify()
 }catch(error){closeLocalAudience();audienceFailure((error?.name?error.name+': ':'')+(error?.message||String(error)));return status()}
}
document.addEventListener('fullscreenchange',()=>{if(localAudience&&!opening&&document.fullscreenElement!==localAudience.layer&&document.webkitFullscreenElement!==localAudience.layer)closeLocalAudience(true)});
document.addEventListener('webkitfullscreenchange',()=>{if(localAudience&&!opening&&document.fullscreenElement!==localAudience.layer&&document.webkitFullscreenElement!==localAudience.layer)closeLocalAudience(true)});
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===localAudience?.frame.contentWindow&&event.data?.type==='hwp-audience-close')closeLocalAudience(true)});
function openOutput(d){
 // Audience never opens a popup before requesting fullscreen. Stage is windowed.
 if(d.role==='audience')return null;
 const url=new URL(location.href);url.searchParams.set('display',d.role);url.searchParams.delete('nativeOutput');url.searchParams.delete('hwpOperatorCompanion');url.hash='';
 const b=d.bounds,win=window.open(url.href,'hwp-output-'+d.id.replace(/[^a-z0-9]/gi,'_'),'popup=yes,left='+b.x+',top='+b.y+',width='+b.width+',height='+b.height);
 if(win)try{win.moveTo(b.x,b.y);win.resizeTo(b.width,b.height)}catch{}return win;
}
function assignAvailable(){
 const free=displays().filter(d=>!d.primary&&!d.internal&&!Object.hasOwn(assignments,d.id));
 for(const role of roles)if(enabled[role]&&!displays().some(d=>!d.primary&&!d.internal&&d.role===role)&&free.length){assignments[free.shift().id]=role;save()}
}
function reconcile(){
 assignAvailable();
 const wanted=new Map(displays().filter(d=>d.role==='stage'&&enabled.stage&&!d.primary&&!d.internal).map(d=>[d.id,d]));
 for(const [key,entry] of outputs)if(!wanted.has(key)||entry.win.closed){try{entry.win.close()}catch{}outputs.delete(key)}
 for(const [key,d] of wanted)if(!outputs.has(key)){const win=openOutput(d);if(win)outputs.set(key,{win,role:d.role})}
 if(localAudience&&fullscreenTarget&&!displays().some(d=>d.id===fullscreenTarget&&d.role==='audience'))closeLocalAudience(true);
 return notify()
}
async function connect(){if(!window.getScreenDetails)throw Error('This browser does not support physical display detection.');if(!details){details=await window.getScreenDetails();let timer;details.addEventListener('screenschange',()=>{clearTimeout(timer);timer=setTimeout(reconcile,650)});details.addEventListener('currentscreenchange',notify)}return reconcile()}
window.hwpBrowserScreens={showAudienceHelp,list:async()=>status(),connect,assign:async(key,role)=>{if(role&&!roles.includes(role))throw Error('Invalid screen role');const d=displays().find(d=>d.id===key);if(!d||d.primary||d.internal)throw Error('Choose an external display');assignments[key]=role||'off';save();return reconcile()},activateAudience:async()=>{if(!details&&window.getScreenDetails&&window.screen?.isExtended){try{await connect()}catch(error){audienceFailure(error.message);return status()}}enabled.audience=true;return window.hwpBrowserScreens.openAudience()},openAudience:async()=>{enabled.audience=true;assignAvailable();const selected=displays().find(d=>!d.primary&&!d.internal&&d.role==='audience');const target=Array.from(details?.screens||[]).find(d=>id(d)===selected?.id);return openLocalAudience(target)},enable:async(role,on)=>{if(role==='audience'){if(on)return window.hwpBrowserScreens.activateAudience();enabled.audience=false;closeLocalAudience(true);clearAudienceNotice();return notify()}enabled[role]=!!on;return reconcile()},identify:async()=>{for(const d of displays()){const entry=outputs.get(d.id);if(d.role!=='audience'&&entry&&!entry.win.closed)try{const doc=entry.win.document,tag=doc.createElement('div');tag.textContent=d.label+' — '+d.width+' × '+d.height;Object.assign(tag.style,{position:'fixed',inset:'35% 10%',zIndex:2147483647,background:'#124c88',color:'white',display:'grid',placeItems:'center',font:'bold 32px system-ui'});doc.body.append(tag);setTimeout(()=>tag.remove(),2500)}catch{}}return status()},onChanged:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
if(window.getScreenDetails&&navigator.permissions)navigator.permissions.query({name:'window-management'}).then(p=>{if(p.state==='granted')connect().catch(()=>{});p.onchange=()=>{if(p.state==='granted')connect().catch(()=>{})}}).catch(()=>{});
window.addEventListener('pagehide',()=>{closeLocalAudience();for(const entry of outputs.values())try{entry.win.close()}catch{}});
const selector='.toolbar [data-tip], .toolbar [title], .hwp-mobile-head [data-tip], .hwp-mobile-head [title]';let target=null,tip=null;
function hide(){target=null;if(tip)tip.hidden=true}
function show(el){const value=el.getAttribute('data-tip')||el.getAttribute('title');if(!value)return;target=el;if(!tip){tip=document.createElement('div');tip.className='hwp-floating-header-tip';tip.setAttribute('role','tooltip');document.body.append(tip)}tip.textContent=value;tip.hidden=false;const rect=el.getBoundingClientRect(),bar=el.closest('.toolbar,.hwp-mobile-head');const styles=getComputedStyle(bar||el);tip.style.background=styles.getPropertyValue('--amber').trim()||'#2873b8';tip.style.color=styles.getPropertyValue('--hwp-accent-ink').trim()||'#fff';tip.style.left=Math.max(6,Math.min(innerWidth-tip.offsetWidth-6,rect.left+(rect.width-tip.offsetWidth)/2))+'px';tip.style.top=(rect.bottom+7)+'px'}
document.addEventListener('pointerover',e=>{const el=e.target.closest?.(selector);if(el&&target!==el)show(el)});document.addEventListener('pointerout',e=>{if(target&&!target.contains(e.relatedTarget))hide()});document.addEventListener('focusin',e=>{const el=e.target.closest?.(selector);if(el)show(el)});document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide);window.addEventListener('resize',hide);document.addEventListener('scroll',hide,true);
})();