/* Manual update prompt: no auto-reload, and never render on audience/stage output. */
(() => {
 const output=new URLSearchParams(location.search).get('display');
 if(output==='audience'||output==='stage')return;
 const selector='head>meta[name^="hwp-"][content],head>link[rel="stylesheet"],head>link[rel="manifest"],head>script,body>script,head>style[id^="hwp-"]';
 const signature=doc=>Array.from(doc.querySelectorAll(selector)).filter(node=>node.tagName!=='LINK'||(node.getAttribute('href')||'').startsWith('./')).map(node=>[node.tagName,node.getAttribute('name')||'',node.getAttribute('content')||'',node.getAttribute('src')||'',node.getAttribute('href')||'',node.tagName==='SCRIPT'||node.tagName==='STYLE'?node.textContent:''].join('\u0000')).join('\u0001');
 // Capture the actual document the user opened before React modifies the DOM.
 const running=signature(document), baseline=new Map();
 let checking=false,pending=false,notice=null;
 function language(){try{return document.querySelector('.hwp-mobile-companion')?.lang==='es'||document.documentElement.lang==='es'||localStorage.getItem('sion-lang')==='es'}catch{return false}}
 function show(){
  if(!pending)return;
  if(!notice){
   notice=document.createElement('div');notice.className='hwp-update-notice';notice.setAttribute('role','status');
   const text=document.createElement('span'),button=document.createElement('button');
   button.type='button';button.addEventListener('click',()=>{button.disabled=true;location.reload()});
   notice.append(text,button);
  }
  const es=language();notice.firstChild.textContent=es?'Hay una actualización disponible.':'A website update is available.';
  notice.lastChild.textContent=es?'Actualizar ahora':'Refresh now';
  const parent=document.fullscreenElement||document.body;if(notice.parentNode!==parent)parent.append(notice);
 }
 async function check(){
  if(checking||document.hidden||pending)return;checking=true;
  try{
   const response=await fetch(new URL('./index.html',location.href),{cache:'no-store'});
   if(response.ok){
    const latest=new DOMParser().parseFromString(await response.text(),'text/html');
    // Ignore error documents, captive portals and non-HWP pages.
    if(latest.querySelector('meta[name="hwp-release"]')&&signature(latest)!==running){pending=true;show();return}
   }
   // Detect stylesheet/module-only changes as well as HTML updates.
   const paths=new Set([...document.querySelectorAll('link[rel="stylesheet"],script[src]')].map(n=>n.href||n.src));
   for(const item of performance.getEntriesByType('resource'))if(/\.(?:m?js|css)(?:\?|$)/i.test(item.name))paths.add(item.name);
   const urls=[...paths].filter(path=>{try{return new URL(path,location.href).origin===location.origin}catch{return false}}).slice(0,40);
   await Promise.all(urls.map(async url=>{try{
    const reply=await fetch(url,{method:'HEAD',cache:'no-store'});if(!reply.ok)return;
    const version=reply.headers.get('etag')||reply.headers.get('last-modified');if(!version)return;
    if(baseline.has(url)&&baseline.get(url)!==version){pending=true;show()}else baseline.set(url,version);
   }catch{}}));
  }catch{}finally{checking=false}
 }
 document.addEventListener('fullscreenchange',show);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){show();void check()}});
 window.addEventListener('focus',()=>{show();void check()});window.addEventListener('online',()=>void check());
 window.setInterval(()=>void check(),120000);
 void check();
})();
