/* Manual update prompt. Only a confirmed change to published application bytes is an update. */
(() => {
 const output=new URLSearchParams(location.search).get('display');
 if(output==='audience'||output==='stage')return;
 if(!/^https?:$/.test(location.protocol))return;
 // This static release inventory is independent of the live DOM, service data,
 // resource timing entries, account state, ETags and Last-Modified headers.
 const files=['index.html','hwp-style.css','hwp-access.css','hwp-screen-system.js',
  'hwp-mobile-companion.css','hwp-update-notice.js','hwp-update-notice.css',
  'hwp.webmanifest','song-creator/editor.css','sync-staging/hwp-auth.mjs',
  'sync-staging/hwp-mobile-companion.mjs','sync-staging/sync-core.mjs',
  'sync-staging/hwp-firebase-media-remote.mjs'];
 let running=null,candidate=null,confirmations=0,checking=false,pending=false,notice=null,lastCheck=0;
 function language(){try{return document.querySelector('.hwp-mobile-companion')?.lang==='es'||document.documentElement.lang==='es'||localStorage.getItem('sion-lang')==='es'}catch{return false}}
 function show(){
  if(!pending){notice?.remove();return}
  if(!notice){
   notice=document.createElement('div');notice.className='hwp-update-notice';notice.setAttribute('role','status');
   const text=document.createElement('span'),button=document.createElement('button');
   button.type='button';button.addEventListener('click',()=>{button.disabled=true;location.reload()});
   notice.append(text,button);
  }
  const es=language();notice.firstChild.textContent=es?'Hay una actualización disponible.':'A website update is available.';
  notice.lastChild.textContent=es?'Actualizar ahora':'Refresh now';
  const parent=document.fullscreenElement||document.body;if(parent&&notice.parentNode!==parent)parent.append(notice);
 }
 async function fingerprint(body){
  if(globalThis.crypto?.subtle){
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
   return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  }
  return body;
 }
 async function releaseSnapshot(signal){
  // Compare the response body, not the server's cache metadata. A failed or
  // partial request is not evidence of a different release.
  const ids=await Promise.all(files.map(async file=>{
   const url=new URL('./'+file,location.href);
   const reply=await fetch(url,{cache:'no-store',signal});
   if(!reply.ok)throw Error('Incomplete HWP release');
   const body=await reply.text();
   if(!body.trim())throw Error('Empty HWP release file');
   if(file==='index.html'){
    if(!/<meta\b[^>]*\bname\s*=\s*["']hwp-release["']/i.test(body))throw Error('Not an HWP release');
   }else if(/^\s*(?:<!doctype\s+html|<html\b)/i.test(body)||/text\/html/i.test(reply.headers.get('content-type')||'')){
    throw Error('Unexpected HTML response for HWP release asset');
   }
   return fingerprint(body);
  }));
  return JSON.stringify(ids);
 }
 async function check(){
  if(checking||document.hidden||Date.now()-lastCheck<15000)return;
  checking=true;lastCheck=Date.now();
  const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),25000);
  try{
   const latest=await releaseSnapshot(controller.signal);
   if(running===null){running=latest;return}
   if(latest===running){candidate=null;confirmations=0;pending=false;show();return}
   if(latest===candidate)confirmations++;
   else{candidate=latest;confirmations=1}
   // Two successful observations of the same changed release avoid a transient
   // mixed snapshot during a Pages deployment.
   if(confirmations>=2){pending=true;show()}
  }catch{
   candidate=null;confirmations=0;
  }finally{
   window.clearTimeout(timeout);checking=false;
  }
 }
 document.addEventListener('fullscreenchange',show);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){show();void check()}});
 window.addEventListener('focus',()=>{show();void check()});
 window.addEventListener('online',()=>void check());
 window.setInterval(()=>void check(),120000);
 void check();
})();
