import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('camera dissolve retains old feed until first frame and duration have elapsed',async()=>{
 const start=html.indexOf('function hwpClearCameraTransition'),end=html.indexOf('function pi(view)',start);
 let pending=[],released=[];
 const make=new Function('schedule','cancel','release','notify','acquire',`let hwpPreviousCamera=null,hwpPreviousTimer=0,hwpCameraTransitionToken=0,qr=null,hwpProgramView=null,Jr='slide',Xr=null;const setTimeout=schedule,clearTimeout=cancel,hwpReleaseCamera=release,si=notify,hwpCameraAcquire=acquire;${html.slice(start,end)};return {fi,hwpStartCameraTransition,get:()=>({qr,hwpPreviousCamera}),setView:v=>Xr=v};`);
 const a={},b={};
 const api=make((fn,ms)=>{pending.push({fn,ms});return pending.length},()=>{},x=>released.push(x),()=>{},async id=>id==='a'?a:b);
 api.setView({id:'a'});await api.fi('a',600);
 api.setView({id:'b'});await api.fi('b',600);
 assert.equal(api.get().hwpPreviousCamera.stream,a);
 assert.equal(pending.length,0);
 const token=api.get().hwpPreviousCamera.token;
 api.hwpStartCameraTransition(token+1);assert.equal(pending.length,0);
 api.hwpStartCameraTransition(token);api.hwpStartCameraTransition(token);
 assert.equal(pending.length,1);assert.equal(pending[0].ms,1100);
 pending[0].fn();assert.equal(api.get().hwpPreviousCamera,null);assert.ok(released.includes(a));
});
test('program camera layer identities survive switching between feeds and virtual views',()=>{
 const start=html.indexOf('const hwpCameraLayerIds'),end=html.indexOf('function HwpLayoutEditorPreview',start);
 const key=new Function(html.slice(start,end)+';return hwpCameraLayerKey')();
 const a={},b={};
 assert.equal(key(a,{id:'a'}),key(a,{id:'a'}));
 assert.notEqual(key(a,{id:'a'}),key(b,{id:'a'}));
 assert.notEqual(key(a,{id:'a'}),key(a,{id:'b'}));
 assert.match(html.slice(start,end),/layer\.outgoing&&readyKey===currentKey/);
 assert.match(html.slice(start,end),/},layer\.key\)/);
});
test('center header hover labels render in a fixed layer outside the scrolling toolbar',()=>{
 assert.ok(html.includes('document.body.append(tip)'));
 assert.ok(html.includes('.hwp-header-hover-tip{position:fixed;z-index:16000'));
 assert.ok(html.includes('.app > .toolbar > .modes > button[data-tip]::after'));
 assert.ok(html.includes("document.addEventListener('scroll',hide,true)"));
});
