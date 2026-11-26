(()=>{'use strict';
if(new URLSearchParams(location.search).get('display')==='audience')return;
const roles=['audience','stage'],listeners=new Set(),outputs=new Map();let details=null,enabled={audience:false,stage:false},assignments={};
try{assignments=JSON.parse(localStorage.getItem('hwp-screen-assignments-v3')||'{}')}catch{}
const id=d=>[d.label,d.left,d.top,d.width,d.height].join('|');
const displays=()=>Array.from(details?.screens||[]).map(d=>({id:id(d),label:d.label||'Display',width:d.width,height:d.height,scaleFactor:d.devicePixelRatio||1,primary:!!d.isPrimary,internal:!!d.isInternal,bounds:{x:d.left,y:d.top,width:d.width,height:d.height},role:roles.includes(assignments[id(d)])?assignments[id(d)]:''}));
const status=()=>({displays:displays(),enabled:{...enabled},assignments:{...assignments},supported:typeof window.getScreenDetails==='function',permission:!!details});
function save(){try{localStorage.setItem('hwp-screen-assignments-v3',JSON.stringify(assignments))}catch{}}
function notify(){const value=status();listeners.forEach(fn=>fn(value));return value}
let localAudience=null;
function signalAudienceClosed(){try{const bus=new BroadcastChannel('vesper-show-v1');bus.postMessage({type:'hwp-audience-close'});bus.close()}catch{}}
function audienceUrl(){const url=new URL(location.href);url.searchParams.set('display','audience');url.searchParams.delete('nativeOutput');url.hash='';return url.href}
// Keep the fullscreen document stable: navigating a popup after requesting fullscreen
// exits fullscreen. The isolated audience iframe is the only visual output.
function mountAudience(host,url,onClose){
 const doc=host.document,root=doc.documentElement,layer=doc.createElement('div'),frame=doc.createElement('iframe'),button=doc.createElement('button');
 Object.assign(layer.style,{position:'fixed',inset:'0',width:'100%',height:'100%',margin:'0',padding:'0',border:'0',background:'#000',overflow:'hidden',zIndex:'2147483647',display:'grid',placeItems:'center'});
 frame.id='hwp-audience-local-frame';frame.title='Audience output';frame.allow='fullscreen';frame.allowFullscreen=true;frame.src=url;
 Object.assign(frame.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',margin:'0',padding:'0',background:'#000',display:'none'});
 button.type='button';button.textContent='Enter Audience Fullscreen';button.setAttribute('aria-label','Enter Audience Fullscreen');
 Object.assign(button.style,{position:'relative',zIndex:'1',padding:'14px 24px',font:'600 16px system-ui',background:'#222',color:'#fff',border:'1px solid #888',borderRadius:'8px',cursor:'pointer'});
 layer.append(frame,button);doc.body.append(layer);
 let closed=false,wasFull=false,requesting=false;
 const isFull=()=>{const active=doc.fullscreenElement||doc.webkitFullscreenElement;return active===layer||active===root};
 function sync(){
  if(closed)return;
  if(isFull()){wasFull=true;frame.style.display='block';button.style.display='none';return}
  frame.style.display='none';button.style.display='block';
  if(wasFull)close(true);
 }
 function enter(){
  if(closed||requesting||isFull())return;
  const request=layer.requestFullscreen||layer.webkitRequestFullscreen;
  if(!request)return;
  requesting=true;
  try{Promise.resolve(request.call(layer,{navigationUI:'hide'})).then(sync,()=>{}).finally(()=>{requesting=false;sync()})}
  catch{requesting=false;sync()}
 }
 function message(event){if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='hwp-audience-close')close(true)}
 function key(event){if(event.key==='Escape'){close(true);return}if(event.key==='f'||event.key==='F'){event.preventDefault();enter()}}
 function close(user=false){
  if(closed)return;closed=true;
  doc.removeEventListener('fullscreenchange',sync);doc.removeEventListener('webkitfullscreenchange',sync);
  host.removeEventListener('message',message);host.removeEventListener('keydown',key);
  if(isFull())try{Promise.resolve((doc.exitFullscreen||doc.webkitExitFullscreen)?.call(doc)).catch(()=>{})}catch{}
  layer.remove();onClose(user);
 }
 button.addEventListener('click',enter);doc.addEventListener('fullscreenchange',sync);doc.addEventListener('webkitfullscreenchange',sync);
 host.addEventListener('message',message);host.addEventListener('keydown',key);
 // Request immediately while a click's transient activation is still available.
 // When browser policy rejects it, the audience stays black until the operator
 // clicks the fullscreen button. No slide is ever shown inside browser chrome.
 return {enter,close,frame};
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
 const b=d.bounds,features='popup=yes,left='+b.x+',top='+b.y+',width='+b.width+',height='+b.height;
 const win=window.open(d.role==='audience'?'about:blank':url.href,'hwp-output-'+d.id.replace(/[^a-z0-9]/gi,'_'),features);
 if(!win)return null;
 try{win.moveTo(b.x,b.y);win.resizeTo(b.width,b.height)}catch{}
 if(d.role==='audience'){
  try{
   const doc=win.document;doc.title='Audience';
   Object.assign(doc.documentElement.style,{margin:'0',padding:'0',width:'100%',height:'100%',background:'#000',overflow:'hidden'});
   Object.assign(doc.body.style,{margin:'0',padding:'0',width:'100%',height:'100%',background:'#000',overflow:'hidden'});
   const audience=mountAudience(win,url.href,user=>{if(user){enabled.audience=false;signalAudienceClosed();notify()}try{win.close()}catch{}});
   win.focus();audience.enter();
  }catch{try{win.close()}catch{}return null}
 }
 return win;
}
function reconcile(){const free=displays().filter(d=>!d.primary&&!d.internal&&!Object.hasOwn(assignments,d.id));for(const role of roles)if(enabled[role]&&!displays().some(d=>!d.primary&&!d.internal&&d.role===role)&&free.length){assignments[free.shift().id]=role;save()}const wanted=new Map(displays().filter(d=>d.role&&enabled[d.role]&&!d.primary&&!d.internal).map(d=>[d.id,d]));if(localAudience&&[...wanted.values()].some(d=>d.role==='audience'))closeLocalAudience();for(const [key,entry] of outputs)if(!wanted.has(key)||wanted.get(key).role!==entry.role||entry.win.closed){try{entry.win.close()}catch{}outputs.delete(key)}for(const [key,d] of wanted)if(!outputs.has(key)){const win=openOutput(d);if(win)outputs.set(key,{win,role:d.role})}return notify()}
async function connect(){if(!window.getScreenDetails)throw Error('This browser does not support physical display detection. Use the desktop app or a compatible desktop browser.');if(!details){details=await window.getScreenDetails();let timer;details.addEventListener('screenschange',()=>{clearTimeout(timer);timer=setTimeout(reconcile,650)});details.addEventListener('currentscreenchange',notify)}return reconcile()}
window.hwpBrowserScreens={list:async()=>status(),connect,assign:async(key,role)=>{if(role&&!roles.includes(role))throw Error('Invalid screen role');const d=displays().find(d=>d.id===key);if(!d||d.primary||d.internal)throw Error('Choose an external display');assignments[key]=role||'off';save();return reconcile()},activateAudience:async()=>{enabled.audience=true;return window.hwpBrowserScreens.openAudience()},openAudience:async()=>{enabled.audience=true;const external=displays().some(d=>!d.primary&&!d.internal&&(d.role==='audience'||!Object.hasOwn(assignments,d.id)));if(external)return reconcile();openLocalAudience();return notify()},enable:async(role,on)=>{enabled[role]=!!on;if(role==='audience'&&!on)closeLocalAudience();return reconcile()},identify:async()=>{for(const d of displays()){const entry=outputs.get(d.id);if(d.role!=='audience'&&entry&&!entry.win.closed)try{const doc=entry.win.document,tag=doc.createElement('div');tag.textContent=d.label+' — '+d.width+' × '+d.height;Object.assign(tag.style,{position:'fixed',inset:'35% 10%',zIndex:2147483647,background:'#124c88',color:'white',display:'grid',placeItems:'center',font:'bold 32px system-ui'});doc.body.append(tag);setTimeout(()=>tag.remove(),2500)}catch{}}return status()},onChanged:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
if(window.getScreenDetails&&navigator.permissions)navigator.permissions.query({name:'window-management'}).then(p=>{if(p.state==='granted')connect().catch(()=>{});p.onchange=()=>{if(p.state==='granted')connect().catch(()=>{})}}).catch(()=>{});
const selector='.toolbar [data-tip], .toolbar [title], .hwp-mobile-head [data-tip], .hwp-mobile-head [title]';let target=null,tip=null;
function hide(){target=null;if(tip)tip.hidden=true}
function show(el){const value=el.getAttribute('data-tip')||el.getAttribute('title');if(!value)return;target=el;if(!tip){tip=document.createElement('div');tip.className='hwp-floating-header-tip';tip.setAttribute('role','tooltip');document.body.append(tip)}tip.textContent=value;tip.hidden=false;const rect=el.getBoundingClientRect(),bar=el.closest('.toolbar,.hwp-mobile-head');const styles=getComputedStyle(bar||el);tip.style.background=styles.getPropertyValue('--amber').trim()||'#2873b8';tip.style.color=styles.getPropertyValue('--hwp-accent-ink').trim()||'#fff';tip.style.left=Math.max(6,Math.min(innerWidth-tip.offsetWidth-6,rect.left+(rect.width-tip.offsetWidth)/2))+'px';tip.style.top=(rect.bottom+7)+'px'}
document.addEventListener('pointerover',e=>{const el=e.target.closest?.(selector);if(el&&target!==el)show(el)});document.addEventListener('pointerout',e=>{if(target&&!target.contains(e.relatedTarget))hide()});document.addEventListener('focusin',e=>{const el=e.target.closest?.(selector);if(el)show(el)});document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide);window.addEventListener('resize',hide);document.addEventListener('scroll',hide,true);
})();