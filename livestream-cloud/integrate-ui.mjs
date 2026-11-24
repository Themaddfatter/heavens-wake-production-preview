import fs from 'node:fs';
const path='index.html';
let html=fs.readFileSync(path,'utf8');
const wrapper=`function HwpHostedRelay(){
 const {state}=N(),[Controls,setControls]=(0,l.useState)(null),[error,setError]=(0,l.useState)('');
 (0,l.useEffect)(()=>{let active=true;import('./livestream-cloud/controls.mjs').then(module=>{if(active)setControls(()=>module.createHostedRelayControls({jsx:M.jsx,jsxs:M.jsxs,useState:l.useState,useEffect:l.useEffect,useRef:l.useRef,boot:hwpCloudBoot}))}).catch(()=>{if(active)setError('Hosted streaming module unavailable.')});return()=>{active=false}},[]);
 return Controls?(0,M.jsx)(Controls,{settings:state.doc.settings.livestream}):(0,M.jsx)('p',{role:'status',children:error||'Loading streaming controls…'})
}`;
if(!html.includes('function HwpHostedRelay(){')){
 const start=html.indexOf('function HwpLocalRelay(){');
 if(start>=0){
  const end=html.indexOf('\nfunction Oi(){',start);
  if(end<0||end-start>5000)throw Error('Unexpected local relay implementation');
  html=html.slice(0,start)+wrapper+html.slice(end);
  if(!html.includes('(0,M.jsx)(HwpLocalRelay,{})'))throw Error('Local relay control not found');
  html=html.replace('(0,M.jsx)(HwpLocalRelay,{})','(0,M.jsx)(HwpHostedRelay,{})');
 }else{
  const anchor='function Oi(){';
  if(html.split(anchor).length!==2)throw Error('Livestream component not found');
  html=html.replace(anchor,wrapper+'\n'+anchor);
  const controls='(0,M.jsxs)(`div`,{className:`live-controls`,children:[';
  if(html.split(controls).length!==2)throw Error('Livestream controls not found');
  html=html.replace(controls,'(0,M.jsx)(HwpHostedRelay,{}),'+controls);
 }
}
const legacy='(0,M.jsx)(`button`,{className:`btn primary`,onClick:()=>void _i(r).then(e=>n(e)),children:a.status===`live`?`Update live`:`Go Live`}),(0,M.jsx)(`button`,{className:`btn`,onClick:vi,children:`Stop`}),';
if(html.includes(legacy))html=html.replace(legacy,'');
if(html.includes('function HwpLocalRelay(){')||html.includes('(HwpLocalRelay,{})'))throw Error('Local relay controls still present');
if(!html.includes('(0,M.jsx)(HwpHostedRelay,{})'))throw Error('Hosted relay controls missing');
fs.writeFileSync(path,html);
console.log('Hosted relay UI integrated without changing the rest of HWP.');
