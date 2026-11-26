const ORIGIN='https://production.sioncdo.com';
function publish(data){window.postMessage({source:'hwp-browser-fullscreen',...data},ORIGIN)}
const u=new URL(location.href),output=u.searchParams.get('display')==='audience'&&u.searchParams.get('browserOutput')==='1';
async function send(action,payload={}){return chrome.runtime.sendMessage({action,...payload})}
window.addEventListener('message',async event=>{
 if(event.source!==window||event.origin!==ORIGIN||event.data?.source!=='hwp-web')return;
 const m=event.data;if(!['ping','open','close','query-output','close-output'].includes(m.action))return;
 if(output&&!['query-output','close-output'].includes(m.action))return;
 if(!output&&['query-output','close-output'].includes(m.action))return;
 try{const result=await send(m.action,{bounds:m.bounds});if(m.action==='query-output')publish({event:'fullscreen-state',fullscreen:result?.ok&&result.fullscreen===true});else publish({requestId:m.requestId,...result})}catch(e){publish({requestId:m.requestId,ok:false,error:String(e.message||e)})}
});
chrome.runtime.onMessage.addListener(msg=>{if(msg.event==='output-closed')publish(msg)});
if(output){let wasFull=false;const poll=async()=>{try{const r=await send('query-output');const full=r?.ok&&r.fullscreen===true;publish({event:'fullscreen-state',fullscreen:full});if(wasFull&&!full)await send('close-output');wasFull=full}catch{}};void poll();setInterval(poll,500)}
