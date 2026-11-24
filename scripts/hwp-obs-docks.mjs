import fs from 'node:fs';
import vm from 'node:vm';
const file='index.html';
let html=fs.readFileSync(file,'utf8');
const marker='hwp-obs-docks-v1';
if(html.includes('name="hwp-livestream-layout" content="'+marker+'"')){console.log('Already integrated');process.exit(0)}
const hotkey='.hwp-slide-hotkey{position:absolute;right:5px;bottom:5px;z-index:4;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.82);color:#fff;';
if(!html.includes(hotkey))throw Error('Expected slide hotkey badge not found');
html=html.replace(hotkey,'.hwp-slide-hotkey{position:absolute;right:5px;bottom:5px;z-index:4;padding:2px 5px;border-radius:3px;background:#f7b500;color:#17130a;');
const start=html.indexOf('function Oi(){'),finish=html.indexOf('function ki(',start);
if(start<0||finish<0)throw Error('Livestream component missing');
const old=html.slice(start,finish);
const lower='(0,M.jsxs)(\x60div\x60,{className:\x60live-scenes\x60,children:[';
const canvas='(0,M.jsx)(\x60canvas\x60,{ref:me,className:\x60live-canvas\x60';
const a=old.indexOf(lower),b=old.indexOf(canvas,a);
if(a<0||b<a)throw Error('Livestream docks boundaries missing');
const replacement="(0,M.jsx)(HwpObsDocks,{state:e,dispatch:t,toast:n,settings:r,live:a,devices:u,preview:ge,previewView:pi,recordCanvas:me}),";
const component=String.raw`
function HwpObsDocks({state,dispatch,toast,settings,live,devices,preview,previewView,recordCanvas}){
 const h=M.jsx,j=M.jsxs,scenes=state.doc.scenes;
 const [selected,setSelected]=(0,l.useState)(''),[sourceId,setSourceId]=(0,l.useState)('');
 const scene=scenes.find(item=>item.id===selected)||scenes[0],source=scene?.sources.find(item=>item.id===sourceId)||scene?.sources[0];
 const button=(label,action,extra={})=>h('button',{type:'button',className:'btn',onClick:action,...extra,children:label});
 const settingsPatch=patch=>dispatch({type:'update-settings',patch:{...state.doc.settings,livestream:{...settings,...patch}}});
 const patchSource=(id,patch)=>{if(scene)dispatch({type:'patch-doc',patch:{scenes:scenes.map(s=>s.id!==scene.id?s:{...s,sources:s.sources.map(x=>x.id===id?{...x,...patch}:x)})}})};
 const makeSource=(kind,name,extra={})=>({id:w(),name,kind,x:0,y:0,width:1920,height:1080,opacity:1,volume:1,muted:false,gain:0,visible:true,brightness:0,contrast:0,saturation:0,chroma:false,chromaColor:'#00ff00',...extra});
 function chooseScene(item){setSelected(item.id);setSourceId('');const camera=item.sources.find(x=>x.kind==='camera'),media=item.sources.find(x=>x.kind==='media'||x.kind==='image');if(camera?.viewId){const view=state.doc.cameraViews.find(x=>x.id===camera.viewId);if(view){preview('camera:'+view.deviceId);previewView(view)}}else if(media?.mediaId)preview('media:'+media.mediaId);else if(item.sources.some(x=>x.kind==='slide'))preview('slide')}
 function addScene(){const item={id:w(),name:'Scene '+(scenes.length+1),sources:[makeSource('slide','Slide')]};dispatch({type:'patch-doc',history:'push',patch:{scenes:[...scenes,item]}});chooseScene(item)}
 function addLowerThird(){if(!scene)return;const item=makeSource('text','Lower third',{text:'Lower third',color:'#fffaf3',x:80,y:860,width:900,height:140,muted:true});dispatch({type:'patch-doc',history:'push',patch:{scenes:scenes.map(s=>s.id===scene.id?{...s,sources:[...s.sources,item]}:s)}});setSourceId(item.id)}
 const field=(label,control)=>j('label',{className:'hwp-obs-field',children:[h('span',{children:label}),control]});
 const num=(label,value,change)=>field(label,h('input',{type:'number',value:value??0,onChange:ev=>change(Number(ev.target.value))}));
 const range=(label,value,min,max,change)=>field(label,h('input',{type:'range',min,max,value:value??0,onChange:ev=>change(Number(ev.target.value))}));
 const check=(label,value,change)=>j('label',{className:'hwp-obs-check',children:[h('input',{type:'checkbox',checked:!!value,onChange:ev=>change(ev.target.checked)}),label]});
 const dock=(label,body,footer,extra='')=>j('section',{className:'hwp-obs-dock '+extra,children:[h('header',{className:'hwp-obs-dock-title',children:label}),h('div',{className:'hwp-obs-dock-body',children:body}),footer&&h('footer',{className:'hwp-obs-dock-footer',children:footer})]});
 const level=Math.max(0,Math.min(1,Math.max(...live.levels,0)));
 const meter=h('div',{className:'hwp-obs-level','aria-label':'Microphone input activity',role:'meter','aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':Math.round(level*100),children:h('span',{style:{width:100*level+'%'}})});
 const sceneRows=scenes.length?scenes.map(item=>j('button',{type:'button',className:'hwp-obs-list-row'+(scene?.id===item.id?' selected':''),onClick:()=>chooseScene(item),'aria-pressed':scene?.id===item.id,children:[h('span',{className:'hwp-obs-list-mark','aria-hidden':true,children:'▣'}),h('span',{children:item.name})]},item.id)):h('p',{className:'hwp-obs-empty',children:'No scenes yet'});
 const sourceRows=scene?.sources.length?scene.sources.map(item=>j('button',{type:'button',className:'hwp-obs-list-row'+(source?.id===item.id?' selected':''),onClick:()=>setSourceId(item.id),'aria-pressed':source?.id===item.id,children:[h('span',{className:'hwp-obs-list-mark','aria-hidden':true,children:item.kind==='camera'?'◉':item.kind==='text'?'T':'▣'}),h('span',{children:item.name}),h('small',{children:item.kind})]},item.id)):h('p',{className:'hwp-obs-empty',children:'Select a scene'});
 const sourceProperties=source&&j('details',{className:'hwp-obs-details',children:[h('summary',{children:'Transform & filters'}),j('div',{className:'hwp-obs-property-grid',children:[num('X',source.x,v=>patchSource(source.id,{x:v})),num('Y',source.y,v=>patchSource(source.id,{y:v})),num('Width',source.width,v=>patchSource(source.id,{width:v})),num('Height',source.height,v=>patchSource(source.id,{height:v}))]}),range('Brightness',source.brightness,-50,50,v=>patchSource(source.id,{brightness:v})),range('Contrast',source.contrast,-50,50,v=>patchSource(source.id,{contrast:v})),range('Saturation',source.saturation,-100,100,v=>patchSource(source.id,{saturation:v})),j('div',{className:'hwp-obs-inline',children:[check('Chroma key',source.chroma,v=>patchSource(source.id,{chroma:v})),h('input',{type:'color',value:source.chromaColor||'#00ff00','aria-label':'Chroma key color',onChange:ev=>patchSource(source.id,{chromaColor:ev.target.value})})]})]});
 const mixerRows=(scene?.sources||[]).map(item=>j('div',{className:'hwp-obs-mixer-row',children:[j('div',{className:'hwp-obs-inline hwp-obs-mixer-label',children:[h('span',{children:item.name}),h('small',{children:Math.round((item.volume??1)*100)+'%'})]}),j('div',{className:'hwp-obs-inline',children:[h('input',{type:'range',min:0,max:100,'aria-label':item.name+' volume',value:Math.round((item.volume??1)*100),onChange:ev=>patchSource(item.id,{volume:Number(ev.target.value)/100})}),button(item.muted?'Unmute':'Mute',()=>patchSource(item.id,{muted:!item.muted}),{className:'btn hwp-obs-mute'+(item.muted?' muted':''),'aria-pressed':!!item.muted})]}),h('details',{className:'hwp-obs-details',children:j(M.Fragment,{children:[h('summary',{children:'Gain'}),range((item.gain??0)+' dB',item.gain,-12,12,v=>patchSource(item.id,{gain:v}))]})})]},item.id));
 const controls=j('div',{className:'hwp-obs-control-stack',children:[
 button(live.status==='live'?'Update stream':'Start streaming',()=>void _i(settings).then(toast),{className:'btn primary'}),
 button('Stop streaming',vi,{disabled:live.status!=='live'}),
 button(live.recording?'Stop recording':'Start recording',()=>{if(live.recording){bi();return}const c=recordCanvas.current;if(c){c.width=settings.width;c.height=settings.height;yi(c,settings.fps,settings.bitrate,settings.muted,settings.audioDeviceId)}}),
 button('Start replay buffer',()=>{const c=recordCanvas.current;if(c){c.width=settings.width;c.height=settings.height;Ci(c,settings.fps)}}),
 button('Save replay',wi),
 j('details',{className:'hwp-obs-details',children:[h('summary',{children:'Slide overlay settings'}),check('Slide text over camera',settings.overlay,v=>settingsPatch({overlay:v})),j('div',{className:'hwp-obs-property-grid',children:[num('X',settings.overlayX,v=>settingsPatch({overlayX:v})),num('Y',settings.overlayY,v=>settingsPatch({overlayY:v})),num('Size',settings.overlaySize,v=>settingsPatch({overlaySize:v})),field('Color',h('input',{type:'color',value:settings.overlayColor,onChange:ev=>settingsPatch({overlayColor:ev.target.value})}))]})]})
 ]});
 return j('div',{className:'hwp-obs-lower',children:[
 dock('Scenes',h('div',{className:'hwp-obs-list',children:sceneRows}),button('+ Add scene',addScene)),
 dock('Sources',j(M.Fragment,{children:[h('div',{className:'hwp-obs-list',children:sourceRows}),sourceProperties]}),button('+ Lower third',addLowerThird,{disabled:!scene})),
 dock('Audio Mixer',j(M.Fragment,{children:[j('div',{className:'hwp-obs-mic',children:[j('div',{className:'hwp-obs-inline hwp-obs-mixer-label',children:[h('span',{children:'Mic / Audio input'}),button(settings.muted?'Unmute':'Mute',()=>settingsPatch({muted:!settings.muted}),{className:'btn hwp-obs-mute'+(settings.muted?' muted':''),'aria-pressed':!!settings.muted})]}),meter,field('Audio device',j('select',{value:settings.audioDeviceId,onChange:ev=>settingsPatch({audioDeviceId:ev.target.value}),children:[h('option',{value:'',children:'Default microphone'}),...devices.map(device=>h('option',{value:device.deviceId,children:device.label||'Microphone'},device.deviceId))]}))]}),...mixerRows]}),null,'hwp-obs-audio'),
 dock('Controls',controls,null,'hwp-obs-controls'),
 j('div',{className:'hwp-obs-status',children:[h('span',{className:'hwp-obs-status-dot'+(live.status==='live'?' on':'')}),h('span',{children:live.recording?'Recording':live.status==='live'?'Streaming':live.statusText||'Stopped'}),h('span',{className:'hwp-obs-output-format',children:settings.width+' × '+settings.height+' · '+settings.fps+' fps · '+Math.round(settings.bitrate/1000)+' kbps'})]})
 ]})
}
`;
const changed=old.slice(0,a)+replacement+old.slice(b);
if(changed.slice(0,a)!==old.slice(0,a))throw Error('Upper livestream UI was changed');
html=html.slice(0,start)+component+changed+html.slice(finish);
html=html.replace('</head>','<meta name="hwp-livestream-layout" content="'+marker+'"/><link rel="stylesheet" href="./hwp-livestream-docks.css?v=1"/></head>');
let checked=0;
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(match[1].trim()){new vm.Script(match[1]);checked++}}
if(checked<3)throw Error('Missing inline JavaScript');
fs.writeFileSync(file,html);
console.log('Updated hotkey badges and OBS docks; preserved upper controls, compiled '+checked+' scripts');
