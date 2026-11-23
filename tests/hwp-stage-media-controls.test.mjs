import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../hwp-access.css',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../sync-staging/hwp-sync-client.mjs',import.meta.url),'utf8');
const firebase=readFileSync(new URL('../sync-staging/hwp-auth.mjs',import.meta.url),'utf8');
const local=readFileSync(new URL('../sync-staging/hwp-local-media-sync.mjs',import.meta.url),'utf8');
const includes=(part,label)=>assert.ok(html.includes(part),label);

test('Stage messages remain until explicitly removed, with stacked labeled actions',()=>{
 const composer=html.slice(html.indexOf('function HwpStageMessageComposer()'),html.indexOf('function Ni()'));
 assert.ok(composer.includes('type:"clear-stage-message"'));
 assert.ok(!composer.includes('expiresAt'));
 assert.ok(composer.includes('title:`Send to stage`'));
 assert.ok(composer.includes('title:`Take off stage`'));
 assert.ok(html.includes('e.stageMessage&&(0,M.jsx)(HwpStageFlash'));
 assert.ok(css.includes('.hwp-stage-message-actions'));
});

test('Clear All keeps the selected background and stage strips output backgrounds',()=>{
 includes('name:`clearall`','Clear All icon');
 includes('layer:`all`','Clear All reducer action');
 includes('r===`all`&&(n.logoOn=!1,n.stageMessage=null)','all foreground overlays removed');
 includes('function hwpStagePlain(snap)','stage-only background suppression');
 includes('background:null,mediaLayer:null','stage background removed');
});

test('Bible multiple translation labels preserve selected abbreviation order',()=>{
 includes('scriptureSets.map(block=>hwpBibleAbbreviation(block.translation)).join(" / ")','presentation abbreviations');
 includes('translation:selected.length>1?selected.join(" / "):selected[0]','selector order');
 assert.ok(!html.includes('translation:scriptureSets.length>1?`MUL`'));
});

test('Media browser supports folder drag/drop, context actions, and folder destinations',()=>{
 includes('application/x-hwp-media','drag transfer');
 includes('onDrop:event=>drop(event,f.id)','folder drop zone');
 for(const label of ['Copy','Paste','Duplicate','Delete','Send to ▸'])includes(label,'context action '+label);
 includes('case`move-media`','move media reducer');
 includes('case`create-media-folder`','new folder reducer');
 assert.ok(css.includes('.hwp-media-submenu'));
});

test('Background slides have photo and video labels and use ordinary slide creation',()=>{
 includes('Photo Background','photo section');
 includes('Video Background','video section');
 includes('name:t.presentationId===ge?','background label by type');
 includes('r.id===`pres_background`?(0,M.jsxs)(M.Fragment','background categories visible');
 includes('onClick:()=>setChooser(!0),children:`+ Slide`','create-slide button');
 assert.ok(!html.includes('className:`pres-name`,value:r.name'),'no inline presentation rename input');
});

test('Only Text objects can carry renderable text',()=>{
 includes('children:`Type`','Type property');
 includes('runs:[],richText:null,binding:null','clear existing content on type switch');
 includes('e.kind===`text`&&e.text&&(0,M.jsx)(Jn','nontext cannot render text');
 includes('i.every(object=>object.kind===`text`)','Text tab limited to text objects');
 includes('children:`Photo or Video`','media fill renamed');
 assert.ok(css.includes('.hwp-upload-media'));
});

test('Media and logo URLs reuse in-flight/cached resolutions',()=>{
 includes('const hwpFastMediaUrls=new Map()','cache');
 includes('function hwpFastResolve(src)','one resolver for logo/media');
 includes('found&&Date.now()-found.at<600000','shared promise cache lifetime');
});

test('Cloud status retries on errors while local playback remains available',()=>{
 includes('bootRetryId=window.setTimeout(bootCloud,15000)','cloud boot retry');
 includes('navigator.onLine?"error":"offline"','sync failure distinct from offline');
 assert.ok(firebase.includes("'sion-schedule-next'"));
 assert.ok(firebase.includes("'gs://sion-schedule-next.firebasestorage.app'"));
 assert.ok(cloud.includes('cloudMedia.local.localEntry(id)'),'local playback before remote');
 assert.ok(local.includes("navigator.storage.getDirectory()"),'local disk browser storage');
});

test('Background label definitions are persistent and motion backgrounds are classified as video',()=>{
 includes('["Photo Background",','new photo background label');
 includes('["Video Background",','new video background label');
 includes('case"hwp-prepare-background-labels":','explicit one-time preparation');
 includes('hwp-prepare-background-labels",history:"none"','prepare when background section is opened');
 includes('kind===`video`||kind===`motion`','animated backgrounds use Video Background');
});
test('Existing background labels normalize idempotently without replacing media or slides',()=>{
 const from=html.indexOf('case"hwp-prepare-background-labels":');
 const to=html.indexOf('case`set-slide-label`:',from);
 const viStart=html.indexOf('function Vi(e,t){'),viEnd=html.indexOf('function Hi(',viStart);
 assert.ok(from>0&&to>from&&viStart>0&&viEnd>viStart);
 const Vi=new Function(html.slice(viStart,viEnd)+';return Vi;')();
 const normalize=new Function('e','t','Vi','ge','switch(t.type){'+html.slice(from,to)+'default:return e}');
 const bg={id:'pres_background',groups:[{id:'photo',name:'Old Photo',color:'#444444'},{id:'mixed',name:'Old Mix',color:'#444444'}],
  slides:[{id:'s1',groupId:'photo',background:{type:'media',mediaId:'pic'}},
   {id:'s2',groupId:'mixed',background:{type:'media',mediaId:'pic'}},
   {id:'s3',groupId:'mixed',background:{type:'media',mediaId:'motion'}}],
  arrangements:[{id:'default',order:['photo','mixed']}]};
 const state={doc:{media:[{id:'pic',kind:'image'},{id:'motion',kind:'motion'}],labels:[],presentations:[bg]}};
 const next=normalize(state,{type:'hwp-prepare-background-labels'},Vi,'pres_background');
 assert.equal(next.doc.labels.length,2);
 assert.equal(next.doc.presentations[0].groups.find(x=>x.id==='photo').name,'Photo Background');
 assert.equal(next.doc.presentations[0].slides.find(x=>x.id==='s3').groupId,'mixed__hwp_video');
 assert.equal(next.doc.presentations[0].slides.map(x=>x.id).join(','),'s1,s2,s3');
 assert.equal(next.doc.presentations[0].slides.find(x=>x.id==='s3').background.mediaId,'motion');
 assert.equal(normalize(next,{type:'hwp-prepare-background-labels'},Vi,'pres_background'),next);
});

test('Sync issue opens diagnostic details and a working retry action',()=>{
 const start=html.indexOf('function HwpCloudIndicator()');
 const end=html.indexOf('function HwpCloudSettings()',start);
 const component=html.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.ok(component.includes('aria-label":"Shared storage status"'));
 assert.ok(component.includes('children:"Retry connection"')||component.includes(':"Retry connection"'));
 assert.ok(component.includes('onClick:retrySync'));
 assert.ok(component.includes('window.dispatchEvent(new Event("hwp-cloud-reload"))'));
 assert.ok(component.includes('hwp-cloud-panel-error'));
 assert.ok(component.includes('setError(detail)'));
 assert.ok(component.includes('onClick:()=>setOpen(true)'));
 assert.ok(html.includes('window.hwpCloudLastError=detail;'));
 assert.ok(html.includes('emit("syncing");if(!engine.current)bootCloud();else void load()'));
 assert.ok(css.includes('.hwp-cloud-panel-backdrop'));
 assert.ok(html.includes('name="hwp-release" content="hwp-cloud-sync-details-v1"'));
});
