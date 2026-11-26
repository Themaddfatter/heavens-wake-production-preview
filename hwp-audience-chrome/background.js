const ORIGIN='https://production.sioncdo.com';
const key=id=>'hwp-output-'+id;
const get=async id=>(await chrome.storage.session.get(key(id)))[key(id)];
const set=(id,data)=>chrome.storage.session.set({[key(id)]:data});
const remove=id=>chrome.storage.session.remove(key(id));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function route(sender){try{const u=new URL(sender.url);if(u.origin!==ORIGIN||sender.frameId!==0)return null;return u}catch{return null}}
async function findOutput(windowId){const all=await chrome.storage.session.get(null);return Object.entries(all).find(([k,v])=>k.startsWith('hwp-output-')&&v.windowId===windowId)}
async function closeFor(tabId){const old=await get(tabId);if(!old)return;await remove(tabId);try{await chrome.windows.remove(old.windowId)}catch{}}
const pending=new Set(),cancelled=new Set();
async function run(msg,sender){
 const u=route(sender);if(!u||!sender.tab?.id)throw Error('HWP origin required');
 const tabId=sender.tab.id,isOutput=u.searchParams.get('display')==='audience'&&u.searchParams.get('browserOutput')==='1';
 if(msg.action==='query-output'){if(!isOutput)return {fullscreen:false};const entry=await findOutput(sender.tab.windowId);if(!entry)return {fullscreen:false};const w=await chrome.windows.get(sender.tab.windowId);return {fullscreen:w.state==='fullscreen'}}
 if(msg.action==='close-output'){if(!isOutput)throw Error('Not an Audience output');const entry=await findOutput(sender.tab.windowId);if(entry)await closeFor(Number(entry[0].slice('hwp-output-'.length)));return {}}
 if(u.searchParams.has('display'))throw Error('Operator page required');
 if(msg.action==='ping')return {};
 if(msg.action==='close'){cancelled.add(tabId);await closeFor(tabId);return {}}
 if(msg.action!=='open')throw Error('Unknown action');
 if(pending.has(tabId))throw Error('Audience is already opening');pending.add(tabId);cancelled.delete(tabId);
 let w;
 try{
  const b=msg.bounds;if(!b||!['x','y','width','height'].every(k=>Number.isFinite(b[k]))||b.width<100||b.height<100||b.width>30000||b.height>30000)throw Error('Invalid Audience display bounds');
  await closeFor(tabId);
  w=await chrome.windows.create({url:ORIGIN+'/?display=audience&browserOutput=1',type:'popup',left:Math.round(b.x),top:Math.round(b.y),width:Math.round(b.width),height:Math.round(b.height),focused:true});
  if(w.id===sender.tab.windowId)throw Error('Refusing to fullscreen the operator window');
  if(cancelled.has(tabId))throw Error('Audience opening cancelled');
  await set(tabId,{windowId:w.id});
  await chrome.windows.update(w.id,{state:'fullscreen'});
  let actual;for(let i=0;i<30;i++){if(cancelled.has(tabId))throw Error('Audience opening cancelled');actual=await chrome.windows.get(w.id);if(actual.state==='fullscreen')break;await sleep(100)}
  if(actual?.state!=='fullscreen')throw Error('Chrome did not confirm fullscreen on the Audience window');
  return {fullscreen:true};
 }catch(e){if(w?.id!==undefined&&w.id!==sender.tab.windowId)try{await chrome.windows.remove(w.id)}catch{};await remove(tabId);throw e}finally{pending.delete(tabId);cancelled.delete(tabId)}
}
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{run(msg,sender).then(value=>sendResponse({ok:true,...value}),error=>sendResponse({ok:false,error:String(error.message||error)}));return true});
chrome.tabs.onRemoved.addListener(id=>{cancelled.add(id);void closeFor(id)});
chrome.windows.onRemoved.addListener(async id=>{const entry=await findOutput(id);if(!entry)return;await chrome.storage.session.remove(entry[0]);const tabId=Number(entry[0].slice('hwp-output-'.length));try{await chrome.tabs.sendMessage(tabId,{event:'output-closed'})}catch{}});
