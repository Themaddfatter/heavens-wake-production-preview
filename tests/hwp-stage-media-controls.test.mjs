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
