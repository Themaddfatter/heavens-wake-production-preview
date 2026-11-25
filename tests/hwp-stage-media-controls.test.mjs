import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../hwp-access.css',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../sync-staging/hwp-sync-client.mjs',import.meta.url),'utf8');
const firebase=readFileSync(new URL('../sync-staging/hwp-auth.mjs',import.meta.url),'utf8');
const local=readFileSync(new URL('../sync-staging/hwp-local-media-sync.mjs',import.meta.url),'utf8');
const screenHelpers=html.slice(html.indexOf('const HWP_TEXT_OUTPUTS='),html.indexOf('const hwpSystemFonts='));
const includes=(part,label)=>assert.ok(html.includes(part),label);

test('Stage messages remain until explicitly removed, with stacked labeled actions',()=>{
 const composer=html.slice(html.indexOf('function HwpStageMessageComposer()'),html.indexOf('function Ni('));
 assert.ok(composer.includes('type:"clear-stage-message"'));
 assert.ok(!composer.includes('expiresAt'));
 assert.ok(composer.includes('title:`SM ON`'));
 assert.ok(composer.includes('title:`SM OFF`'));
 assert.ok(html.includes('render:model=>(0,M.jsx)(HwpStageFlash,{message:model.message})'));
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
 includes('hwpRegisteredLabel(e.doc,null,t.item.kind,t.presentationId===ge)','background label by type');
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
 assert.ok(html.includes('name="hwp-release" content="hwp-media-deletion-safety-v1"'));
});

test('deleted media stays deleted and stale backups cannot auto-resurrect images',()=>{
 const from=html.indexOf('function HwpCloudAgent(');
 const to=html.indexOf('function HwpCloudIndicator()',from);
 const agent=html.slice(from,to);
 assert.ok(agent.includes('currentDoc=getLatest().doc'));
 assert.ok(agent.includes('engine.current.recoverMedia(remote.workspace,[currentDoc],remote.revision)'));
 assert.ok(!agent.includes('previousLocalBackup?.doc'));
 assert.ok(agent.includes('localRevision!==remote.revision'));
 assert.ok(html.includes('deletedMediaIds:[...new Set([...(e.doc.deletedMediaIds||[]),t.id])].slice(-5000)'));
 assert.ok(agent.includes('if(previous&&JSON.stringify(current.doc)!==JSON.stringify(previous))'));
 assert.ok(agent.includes('hwpMergeScheduleWorkspace(previous,current.doc,remoteDoc)'));
 assert.ok(agent.includes('if(!merged)'));
 assert.ok(agent.includes('else emit("syncing");'));
 assert.ok(html.includes('name="hwp-release" content="hwp-media-deletion-safety-v1"'));
});

test('production dynamically loads versioned media-safety modules',()=>{
 for(const [name,version] of [['hwp-sync-client','mobile-preview-v1'],['hwp-sync-controller','hwp-media-deletion-safety-v1'],['hwp-firebase-media-remote','mobile-preview-v1']])
  assert.ok(html.includes("import('./sync-staging/"+name+".mjs?v="+version+"')"),name);
 assert.ok(html.includes('if(companion||!auth.firebaseAuth.currentUser||!navigator.onLine)return;'));
});

test("Operator workflow changes are present",()=>{for(const part of ["+ Create Template","Create and edit","hwpPresentationView","Type a message first.","hwpMergeServiceScriptures","hwpNormalizeMediaFolders","Choose existing media","Create a medley with the first selected song"])assert.ok(html.includes(part),part);assert.ok(!html.slice(html.indexOf("function HwpStageMessageComposer()"),html.indexOf("function Ni(")).includes("disabled:"));});

test("Folder helpers preserve media and presentation contents while moving, copying and deleting folders",()=>{
 const start=html.indexOf("function hwpReorderFolderBlock("),end=html.indexOf("function hwpNormalizeMediaFolders(",start),library=html.indexOf("function hwpLibraryFolders(doc)"),libraryEnd=html.indexOf("let hwpLibraryClipboard=",library);
 assert.ok(start>0&&end>start&&libraryEnd>library);
 const tools=new Function(html.slice(start,end)+html.slice(library,libraryEnd)+';let serial=0;function w(){return "new-"+(++serial)};function Ut(slide){return {...structuredClone(slide),id:w(),objects:[]}};return {hwpMediaFolderEdit,hwpLibraryFolderEdit,hwpLibraryFolders,hwpFolderContains};')();
 const doc={mediaFolders:[{id:"folder_stills",name:"Photos"},{id:"folder_motion",name:"Videos"},{id:"folder_audio",name:"Audio"},{id:"f",name:"Folder"}],media:[{id:"m",kind:"image",folderId:"f",src:"idb:m"}]};
 const removed=tools.hwpMediaFolderEdit(doc,{kind:"remove",ids:["f","folder_stills"]});assert.equal(removed.media[0].folderId,"folder_stills");assert.ok(removed.mediaFolders.some(f=>f.id==="folder_stills"));assert.equal(doc.media[0].folderId,"f");
 const copied=tools.hwpMediaFolderEdit(doc,{kind:"paste",folders:[{name:"Folder",items:doc.media}],items:[]});assert.equal(copied.media.length,2);assert.equal(copied.media[1].src,"idb:m");assert.notEqual(copied.media[1].id,"m");
 const p={id:"p",name:"Song",category:"song",slides:[{id:"slide",objects:[]}],groups:[]},lib={presentations:[p],media:[],hwpFolders:[{id:"custom",name:"Custom"}]};
 const moved=tools.hwpLibraryFolderEdit(lib,{kind:"move",ids:["p"],target:"custom"});assert.ok(tools.hwpFolderContains(moved,{id:"custom"},p));assert.ok(!tools.hwpFolderContains(moved,{id:"songs",auto:"song"},p));
 const deleted=tools.hwpLibraryFolderEdit(moved,{kind:"remove",ids:["custom"]});assert.equal(deleted.presentations.length,1);assert.equal(deleted.hwpFolderPlacement.p,"unassigned");
});
test("Bible editions are loaded on request without blocking sign-in",()=>{assert.ok(html.includes("function hwpLoadBibleFile(name)"));assert.ok(html.includes("HWP_BIBLE_FILES.has(m[1])"));assert.ok(!html.includes('<script src="./hwp-bibles/kjv.js">'));assert.ok(html.includes("await sys.verifyAccess(current)"));assert.ok(firebase.includes("action:'access'"));});

test("Scripture is service-only and merges can be reversed without losing source rows",()=>{for(const marker of ["presentations=state.doc.presentations.filter(hwpIsLibraryPresentation)","if(!hwpIsLibraryPresentation(pres))return false","hwpRemoveServiceScriptures","hwpUnmergeServiceScriptures","Unmerge Scriptures","hwpScriptureMerge:{version:1,sources:snapshots}"])assert.ok(html.includes(marker),marker);});
test("Registered media labels and continuous medley frame",()=>{for(const marker of ["function hwpRegisteredLabel","function hwpRepairPresentationLabels","hwpLabelFields(defaultLabel)","function hwpRenderMedleyGroups"])assert.ok(html.includes(marker),marker);assert.ok(css.includes(".hwp-medley-frame"));assert.ok(css.includes("4px solid var(--hwp-medley-glow,#29ff70)"));});

test("HWW remote control only triggers verified song cues for the current published HWP service",()=>{const from=html.indexOf("function hwpWorshipManifest("),to=html.indexOf("function HwpWorshipControlAgent(",from);assert.ok(from>0&&to>from);const helpers=new Function(html.slice(from,to)+';function Ce(p){return p.slides.map((slide,index)=>({slide,index,group:p.groups[0]}))}function pe(s){return s.text}function hwpServiceMedleyTitle(r,p){return p.name}return {hwpWorshipManifest,hwpWorshipTarget,hwpWorshipActive};')();const p={id:"p",category:"song",name:"Song",groups:[{name:"Verse 1"}],slides:[{id:"s",enabled:true,text:"Lyrics"},{id:"disabled",enabled:false}]},scripture={id:"r",category:"scripture",groups:[{name:"Scripture"}],slides:[{id:"r1",enabled:true}]},service={hwpScheduleId:"service",hwpSchedulePublished:true,items:[{id:"row",presentationId:"p"},{id:"rrow",presentationId:"r"}]},state={doc:{presentations:[p,scripture]},session:{serviceNavId:"row"},live:{presentationId:"p",slideId:"s",cueIndex:0}},target={itemId:"row",presentationId:"p",slideId:"s",cueIndex:0};assert.equal(helpers.hwpWorshipManifest(state,service).length,1);assert.deepEqual(helpers.hwpWorshipTarget(state,service,target),target);assert.equal(helpers.hwpWorshipTarget(state,service,{...target,slideId:"disabled",cueIndex:1}),null);assert.equal(helpers.hwpWorshipTarget(state,{...service,hwpSchedulePublished:false},target),null);assert.equal(helpers.hwpWorshipTarget(state,service,{itemId:"rrow",presentationId:"r",slideId:"r1",cueIndex:0}),null);assert.deepEqual(helpers.hwpWorshipActive(state,service),target);assert.ok(html.includes("worshipControlAck"));assert.ok(html.includes('type:"hwp-worship-trigger",target'));});

test("presentation notes are shared presentation fields and closing preserves the text",()=>{const start=html.indexOf("function hwpPresentationNotePatch("),end=html.indexOf("function hwpMedleyGlow(",start),patch=new Function(html.slice(start,end)+";return hwpPresentationNotePatch")();let p=patch({id:"song"},{open:true});p=patch(p,{text:"Start quietly"});assert.equal(p.hwpPresentationNoteOpen,true);assert.equal(p.hwpPresentationNote,"Start quietly");assert.equal(patch(p,{open:false}).hwpPresentationNote,"Start quietly");assert.ok(html.includes("hwp-presentation-note-toggle"));assert.ok(css.includes("grid-template-rows 180ms"));assert.ok(html.includes('label:`Edit slide`,onClick:()=>editLibrarySlide'));});
test("all audience visual layers use configured dissolve, including logo and media",()=>{const start=html.indexOf("function tr({snap:e"),end=html.indexOf("function nr(",start),source=html.slice(start,end);assert.ok(source.includes("hwp-logo:"));assert.ok(!source.includes("outMs:e.logoOn?0:c"));assert.ok(source.includes("model:e.background,outMs:c,inMs:l"));assert.ok(source.includes("model:e.mediaLayer&&!e.background?"));assert.ok(source.includes("props:"));assert.ok(source.includes("message:"));assert.ok(html.includes("function hwpWorshipReceiverService"));assert.ok(html.includes("watchWorshipSignal"));});

test("stage output is snapshot driven and remote receiver identity survives reload",()=>{const start=html.indexOf("function Hr({snap:e"),end=html.indexOf("function Ur(",start);assert.ok(start>0&&end>start);const stage=html.slice(start,end);assert.ok(!stage.includes("=N()"));assert.ok(stage.includes("e.showClockOnStage!==false"));assert.ok(stage.includes("stage-message:"));assert.ok(html.includes("sessionStorage.getItem(key)"));assert.ok(html.includes("takeover=true;wake(true)"));});


test("remote worship slide changes preserve the operator session and use the commanded service",()=>{
 const start=html.indexOf('case"hwp-worship-trigger":'),end=html.indexOf('case`advance`:',start);
 assert.ok(start>=0&&end>start);
 const reducer=new Function('e','t','hwpWorshipReceiverService','hwpWorshipTarget','Wt','switch(t.type){'+html.slice(start,end)+'}');
 const session={playlistId:'operator-service',activePresentationId:'operator-song',serviceNavId:'operator-row',serviceNavSeq:42,mode:'edit',selectedSlideIds:['editing-slide']};
 const state={session,live:{audienceOn:true,slideId:'old'}};
 const target={itemId:'remote-row',presentationId:'remote-song',slideId:'remote-slide',cueIndex:2};
 const next=reducer(state,{type:'hwp-worship-trigger',serviceId:'remote-service',target},(e,id)=>({hwpScheduleId:id}),(_,p,t)=>p.hwpScheduleId==='remote-service'?t:null,(e,p,c)=>({...e,session:{activePresentationId:p},live:{...e.live,presentationId:p,slideId:target.slideId,cueIndex:c}}));
 assert.equal(next.session,session);
 assert.equal(next.live.hwpScheduleId,'remote-service');
 assert.equal(next.live.slideId,'remote-slide');
 assert.equal(next.live.hwpServiceItemId,'remote-row');
 assert.equal(next.live.audienceOn,true);
 assert.ok(html.includes('hwpWorshipReceiverServices(state).map(service=>M.jsx(HwpWorshipServiceAgent'));
});

test("single presentation view keeps the entire selected medley and excludes other songs",()=>{
 const start=html.indexOf('function hwpSingleMedleyRows('),end=html.indexOf('function hwpMedleyEdge(',start);
 const rows=new Function(html.slice(start,end)+';return hwpSingleMedleyRows;')();
 const root={id:'root'},child={id:'child',medleyParentId:'root'},child2={id:'child2',medleyParentId:'root'},standalone={id:'standalone'},playlist={items:[root,child,child2,standalone]};
 assert.deepEqual(rows(playlist,root),[root,child,child2]);
 assert.deepEqual(rows(playlist,child2),[root,child,child2]);
 assert.deepEqual(rows(playlist,standalone),[]);
 assert.ok(html.includes('children:hwpRenderMedleyGroups(!all?singleMedley:'));
});

test("accent foreground chooses black or white for readable contrast",()=>{
 const start=html.indexOf('function hwpAccentInk('),end=html.indexOf('function Zi()',start);
 const ink=new Function(html.slice(start,end)+';return hwpAccentInk;')();
 assert.equal(ink('#ffffff'),'#000000');
 assert.equal(ink('#000000'),'#ffffff');
 assert.equal(ink('#ffff00'),'#000000');
 assert.equal(ink('#142248'),'#ffffff');
 assert.equal(ink('#e2a04a'),'#000000');
 assert.ok(html.includes('--hwp-accent-ink'));
});

test('Livestream companion and Cameras share the Program composition',()=>{
 for(const marker of ['function HwpLiveCompanion','function HwpCompanionSwitch','function HwpCameraEditor','function HwpCameraComposite','function HwpLayoutEditorPreview','hwp-companion-camera-release'])includes(marker,marker);
 includes("['control','grid','cameras']", 'header camera editor');
 includes("preview:true",'selected camera composition');
 includes("liveActive&&(0,M.jsx)",'preserve recording controller across workspace changes');
});
test('Camera framing supports independent virtual views and fits',()=>{
 const start=html.indexOf('function hwpLiveViewStyle('),end=html.indexOf('function hwpLiveLayoutFor(',start);
 const style=new Function(html.slice(start,end)+';return hwpLiveViewStyle')();
 assert.equal(style({zoom:2,flipX:true,rotation:90,fit:'contain'}).transform,'rotate(90deg) scale(-2,2)');
 assert.equal(style({fit:'contain'}).objectFit,'contain');
 assert.equal(style({cropX:.8,cropW:1}).clipPath,'inset(0% 0% 0% 80%)');
});
test('Layout selection prioritizes exact category and camera, then category and global defaults',()=>{
 const start=html.indexOf('function hwpLiveLayoutFor('),end=html.indexOf('function HwpLiveMonitor(',start);
 const find=new Function(html.slice(start,end)+';return hwpLiveLayoutFor')();
 const state={doc:{presentations:[{id:'song-1',category:'song'}],settings:{livestream:{layouts:[{category:'*',viewId:'*',mode:'off'},{category:'song',viewId:'*',mode:'full'},{category:'song',viewId:'close',mode:'text'}]}}},live:{presentationId:'song-1'}};
 assert.equal(find(state,{id:'close'}).mode,'text');
 assert.equal(find(state,{id:'wide'}).mode,'full');
 state.live.presentationId='missing';
 assert.equal(find(state,{id:'wide'}).mode,'off');
});
test('Layout composition respects text-only, full-slide and camera-only settings',()=>{
 const start=html.indexOf('function hwpLayoutSlide('),end=html.indexOf('function HwpCameraComposite(',start);
 const {hwpLayoutSlide,hwpLayoutLayer}=new Function(screenHelpers+html.slice(start,end)+';return {hwpLayoutSlide,hwpLayoutLayer}')();
 const slide={background:{type:'color'},objects:[{kind:'rect'},{kind:'text',text:'Song',textStyle:{color:'#000'}}]};
 assert.equal(hwpLayoutSlide(slide,{mode:'off'}),null);
 assert.equal(hwpLayoutSlide(slide,{mode:'full'}).objects.length,2);
 const textSlide=hwpLayoutSlide(slide,{mode:'text',customText:true,textColor:'#fff'});
 assert.equal(textSlide.objects.length,1);
 assert.equal(textSlide.objects[0].textStyle.color,'#fff');
 assert.equal(hwpLayoutLayer({cameraX:0,cameraY:0,cameraW:100,cameraH:100,slideBehind:true},'camera').zIndex,2);
 assert.equal(slide.objects[1].textStyle.color,'#000');
});

test('Independent livestream text boxes preserve original audience and stage slides',()=>{
 const start=html.indexOf('function hwpStreamTextRoles('),end=html.indexOf('function hwpStreamEditorSlide(',start);
 const {hwpStreamTextRoles,hwpStreamTextObjects,hwpStreamBoxBounds}=new Function(screenHelpers+html.slice(start,end)+';return {hwpStreamTextRoles,hwpStreamTextObjects,hwpStreamBoxBounds}')();
 const slide={width:1920,height:1080,objects:[{id:'lyrics-1',kind:'text',binding:'lyrics',name:'Lyrics',text:'First song',x:100,y:100,width:1700,height:700,textStyle:{fontSize:90,color:'#ffffff'},runs:[{text:'First song',fontSize:90}]},{id:'copyright-1',kind:'text',binding:'copyright',text:'Copyright',x:100,y:1000,width:250,height:50,textStyle:{fontSize:18}},{id:'graphic',kind:'rect'}]};
 const original=JSON.stringify(slide),layout={slideX:0,slideY:65,slideW:100,slideH:35,textBoxes:[{key:'lyrics#1',x:5,y:72,w:90,h:23,fontSize:52,color:'#ffff00',autoFit:true},{key:'copyright#1',hidden:true}]};
 assert.equal(hwpStreamTextRoles(slide).length,2);
 const output=hwpStreamTextObjects(slide,layout);
 assert.equal(output.length,1);
 assert.equal(output[0].x,96);
 assert.equal(output[0].width,1728);
 assert.equal(output[0].textStyle.fontSize,52);
 assert.equal(output[0].textStyle.color,'#ffff00');
 assert.equal(output[0].runs[0].fontSize,undefined);
 assert.equal(JSON.stringify(slide),original);
 const nextSlide={...slide,objects:[{...slide.objects[0],id:'lyrics-2',text:'Next song',runs:[]}]};
 assert.equal(hwpStreamTextObjects(nextSlide,layout)[0].text,'Next song');
 assert.equal(hwpStreamTextObjects(nextSlide,layout)[0].x,96);
 assert.equal(hwpStreamBoxBounds({x:90,y:95,w:50,h:20}).x,50);
 assert.equal(hwpStreamBoxBounds({x:90,y:95,w:50,h:20}).y,80);
});
test('Text box controls are wired to the livestream camera preview only',()=>{
 for(const marker of ['hwp-stream-text-box-release','function HwpStreamTextHandles','function HwpStreamTextProperties','Edit independent livestream text boxes','onPointerDown:ev=>start(ev,role,true)','textBoxes:[...(old.textBoxes||[])','resolved.independentTextBoxes&&resolved.mode===','exampleSlide=l.useMemo'])includes(marker,marker);
 const output=html.slice(html.indexOf('function HwpCameraComposite('),html.indexOf('function HwpLayoutEditorPreview('));
 assert.ok(output.includes('HwpStreamTextOverlay'));
 const audience=html.slice(html.indexOf('function tr({snap:e'),html.indexOf('function nr(',html.indexOf('function tr({snap:e')));
 assert.ok(!audience.includes('HwpStreamTextOverlay'));
});

test('Visual camera editor supports source resizing, cropping, and independent source transforms',()=>{
 const start=html.indexOf('function hwpVisualFrame('),end=html.indexOf('function HwpVisualHandles(',start);
 const {hwpVisualFrame,hwpVisualResize,hwpVisualCrop}=new Function(html.slice(start,end)+';return {hwpVisualFrame,hwpVisualResize,hwpVisualCrop}')();
 const startFrame={x:10,y:10,w:30,h:30};
 const resized=hwpVisualResize(startFrame,'nw',5,5);
 assert.equal(resized.x,15);assert.equal(resized.w,25);
 assert.equal(startFrame.x,10);
 const crop=hwpVisualCrop({zoom:1},'w',25,0);
 assert.equal(crop.cropX,.25);assert.equal(crop.cropW,.75);
 assert.equal(hwpVisualFrame({zoom:2}).w,200);
 const source={sourceFrame:{x:-25,y:-25,w:150,h:150}};
 const from=html.indexOf('function hwpLiveViewStyle('),to=html.indexOf('function hwpLiveLayoutFor(',from);
 const style=new Function(html.slice(from,to)+';return hwpLiveViewStyle')();
 assert.equal(style(source).left,'-25%');assert.equal(style(source).width,'150%');
});
test('Visual workspace uses shared live composition and independent object inspector',()=>{
 for(const marker of ['hwp-visual-editor-release','function HwpVisualCameraCanvas','function HwpVisualHandles','function HwpVisualLayoutHandles','function HwpVisualInspector','function HwpVisualCustomOverlay','hwp-visual-columns','onLayerChange:patchLayout','+ Text','+ Shape','+ Media'])includes(marker,marker);
 assert.ok(html.includes('M.jsx(HwpFullscreenButton,{}),!productionOnly&&M.jsx(\x60button\x60,{className:F(\x60iconbtn hwp-template-icon\x60'));
 assert.ok(html.includes('document.fullscreenElement)await document.exitFullscreen()'));
 assert.ok(html.includes('HwpFullscreenButton,{}),(0,M.jsx)(\x60button\x60,{onClick:()=>x().postMessage'));
});

test('Presenter layer list is top-first and drag ordering preserves bottom-first rendering',()=>{
 const start=html.indexOf('function hwpLayerDropOrder('),end=html.indexOf('function HwpPresenterLayers(',start);
 const order=new Function(html.slice(start,end)+';return hwpLayerDropOrder')();
 const objects=[{id:'back'},{id:'middle'},{id:'front'}];
 assert.equal(order(objects,'back','front',false).join(','),'middle,front,back');
 assert.equal(order(objects,'front','back',true).join(','),'front,back,middle');
 assert.equal(order(objects,'middle','middle',false).join(','),'back,middle,front');
 assert.equal(order(objects,'front','background',true).join(','),'back,middle,front');
 assert.equal(objects.map(o=>o.id).join(','),'back,middle,front');
 for(const marker of ['HwpPresenterLayers','application/x-hwp-layer','hwp-layer-background','hwp-layer-drop-before',"label:'Delete'","label:'Duplicate'","label:'Rename'"])includes(marker,marker);
});
test('Quick Edit updates only selected text content and preserves layout, other objects and existing text styles',()=>{
 const start=html.indexOf('function hwpQuickTextPatch('),end=html.indexOf('function HwpQuickCanvasText(',start);
 const {hwpQuickTextPatch,hwpQuickApplySlideText}=new Function(screenHelpers+html.slice(html.indexOf('function fe(e,t){'),html.indexOf('function pe(e){',html.indexOf('function fe(e,t){')))+html.slice(start,end)+';return {hwpQuickTextPatch,hwpQuickApplySlideText}')();
 const slide={id:'slide',background:{type:'color',color:'#000000'},objects:[{id:'lyrics',kind:'text',text:'one two',x:24,width:200,textStyle:{fontSize:50},runs:[{text:'one ',bold:true},{text:'two',italic:true}]},{id:'shape',kind:'rect'},{id:'copy',kind:'text',binding:'copyright',text:'Copyright'}]};
 const original=JSON.stringify(slide),edited=hwpQuickApplySlideText(slide,[{id:'lyrics',text:'one three'},{id:'shape',text:'ignored'},{id:'copy',text:'New copyright'}]);
 assert.equal(edited.objects[0].text,'one three');
 assert.equal(edited.objects[0].runs[0].bold,true);
 assert.equal(edited.objects[0].runs.map(r=>r.text).join(''),'one three');
 assert.equal(edited.objects[0].x,24);
 assert.equal(edited.objects[0].textStyle,slide.objects[0].textStyle);
 assert.equal(edited.objects[1],slide.objects[1]);
 assert.equal(edited.objects[2].hwpTextOverride,true);
 assert.equal(edited.background,slide.background);
 assert.equal(JSON.stringify(slide),original);
 assert.equal(hwpQuickTextPatch(slide.objects[0],'one two'),null);
 assert.equal(hwpQuickApplySlideText(slide,[]),slide);
 for(const marker of ['hwp-presenter-text-release','HwpQuickSlideEdit',"label:'Quick Edit'","type:'hwp-quick-slide-text'","t.presentationId);",'Font & style','Text alignment & spacing','Text effects'])includes(marker,marker);
});

test('Presenter selection is automatic and formatting and object arrangement stay in their own inspector sections',()=>{
 const editor=html.slice(html.indexOf('function gr()'),html.indexOf('function Er()'));
 const toolbar=editor.slice(editor.indexOf('className:`editor-tools`'),editor.indexOf('className:`viewport`'));
 assert.ok(toolbar.includes('title:`Shapes`'));
 assert.ok(toolbar.includes('"aria-label":`Shapes`'));
 assert.ok(!toolbar.includes('children:`Shapes`'));
 assert.ok(!toolbar.includes('title:`Select`'));
 assert.ok(!toolbar.includes('align-objects'));
 assert.ok(!editor.includes('a(e.id)'));
 assert.ok(editor.includes('onClick:()=>{ve(e.id),v(!1)}'));
 const shape=html.slice(html.indexOf('function kr({objects:'),html.indexOf('function Ar({objects:'));
 const text=html.slice(html.indexOf('function Ar({objects:'),html.indexOf('function jr({objects:'));
 assert.ok(shape.includes('Object alignment'));
 assert.ok(shape.includes("type:'align-objects'"));
 assert.ok(text.includes('Text alignment & spacing'));
 assert.ok(text.includes('Align text'));
 assert.ok(!text.includes('align-objects'));
});

test('Text outputs inherit audience until unlinked and preserve independent formatting, position and words',()=>{
 const start=html.indexOf('function fe(e,t){'),end=html.indexOf('function pe(e){',start);
 const {hwpScreenObject,hwpScreenEditPatch,hwpScreenLinkPatch,hwpScreenSnap}=new Function(screenHelpers+html.slice(start,end)+';return {hwpScreenObject,hwpScreenEditPatch,hwpScreenLinkPatch,hwpScreenSnap}')();
 const base={id:'lyrics',kind:'text',text:'Shared lyrics',x:80,y:100,width:800,height:300,scaleToFit:true,textStyle:{fontFamily:'Georgia',fontSize:64,color:'#ffffff',shadow:{enabled:true,color:'#000000'},stroke:{enabled:false,width:2}}};
 let o=hwpScreenEditPatch(base,{textStyle:{fontSize:80}},'audience');
 assert.equal(hwpScreenObject(o,'stage').textStyle.fontSize,80);
 o=hwpScreenEditPatch(o,hwpScreenLinkPatch(o,'stage',false),'audience');
 o=hwpScreenEditPatch(o,{x:400,textStyle:{fontSize:100,colorGradient:{from:'#ffffff',to:'#d7aa50',angle:90}}},'stage');
 assert.equal(hwpScreenObject(o,'stage').x,400);
 assert.equal(hwpScreenObject(o,'stage').textStyle.fontSize,100);
 assert.equal(hwpScreenObject(o,'audience').textStyle.fontSize,80);
 o=hwpScreenEditPatch(o,{textStyle:{fontSize:72},text:'Changed words'},'audience');
 assert.equal(hwpScreenObject(o,'stage').text,'Shared lyrics');
 assert.equal(hwpScreenObject(o,'livestream').text,'Changed words');
 assert.equal(hwpScreenObject(o,'stage').textStyle.fontSize,100);
 assert.equal(hwpScreenObject(o,'livestream').textStyle.fontSize,72);
 o=hwpScreenEditPatch(o,{textStyle:{fontSize:48},text:'Stream words',runs:[{text:'Stream words',italic:true}]},'livestream');
 assert.equal(o.text,'Changed words');
 assert.equal(hwpScreenObject(o,'stage').text,'Shared lyrics');
 assert.equal(hwpScreenObject(o,'livestream').text,'Stream words');
 assert.equal(hwpScreenObject(o,'livestream').textStyle.fontSize,48);
 assert.equal(hwpScreenObject(o,'stage').textStyle.fontSize,100);
 o=hwpScreenEditPatch(o,hwpScreenLinkPatch(o,'stage',true),'audience');
 assert.equal(hwpScreenObject(o,'stage').textStyle.fontSize,72);
 assert.equal(hwpScreenObject(o,'stage').text,'Changed words');
 assert.equal(hwpScreenObject(o,'livestream').text,'Stream words');
 assert.equal(hwpScreenObject(o,'livestream').textStyle.fontSize,48);
 assert.equal(hwpScreenSnap({slide:{objects:[o]}},'livestream').slide.objects[0].textStyle.fontSize,48);
});
test('Text inspector uses icon controls and gradients, with words edited directly on canvas',()=>{
 const text=html.slice(html.indexOf('function Ar({objects:'),html.indexOf('function jr({objects:'));
 assert.ok(!text.includes('textarea'));
 for(const marker of ['HwpFontPicker','HwpTextStyleActions','alignJustify','HwpTextColorControl','colorGradient','Shadow color','Outline color'])assert.ok(text.includes(marker),marker);
 for(const marker of ['api.fontsource.org/v1/fonts','hwpEnsureFont','hwpGradientImage','HwpTextEffectDefs','feMorphology','feGaussianBlur','WebkitBackgroundClip','hwpScreenSnap','editorTextOutput'])includes(marker,marker);
});
test('Bundled font catalog contains over a thousand unique real font families',()=>{const catalog=JSON.parse(readFileSync(new URL('../hwp-font-catalog.json',import.meta.url),'utf8'));assert.ok(catalog.fonts.length>=1000);assert.equal(new Set(catalog.fonts.map(font=>font.family)).size,catalog.fonts.length);assert.ok(catalog.fonts.every(font=>font.id&&font.family&&Array.isArray(font.weights)&&font.weights.length));assert.ok(catalog.fonts.some(font=>font.family==='Montserrat'));assert.ok(catalog.fonts.some(font=>font.family==='Libre Baskerville'));includes('hwp-font-catalog.json','bundled font data');});

test('Independent output variants and rich text survive audience content updates',()=>{
 const start=html.indexOf('function fe(e,t){'),end=html.indexOf('function pe(e){',start),quickStart=html.indexOf('function hwpQuickTextPatch('),quickEnd=html.indexOf('function hwpQuickApplySlideText(',quickStart);
 const {hwpScreenObject,hwpScreenEditPatch,hwpScreenLinkPatch}=new Function(screenHelpers+html.slice(start,end)+html.slice(quickStart,quickEnd)+';return {hwpScreenObject,hwpScreenEditPatch,hwpScreenLinkPatch}')();
 const base={kind:'text',text:'Hello world',runs:[{text:'Hello ',bold:true},{text:'world'}],textStyle:{fontSize:64,shadow:{},stroke:{}}};
 let o=hwpScreenEditPatch(base,hwpScreenLinkPatch(base,'stage',false),'audience');
 o=hwpScreenEditPatch(o,{text:'Hello church',runs:[{text:'Hello church',italic:true}]},'audience');
 const stage=hwpScreenObject(o,'stage');assert.equal(stage.runs.map(r=>r.text).join(''),'Hello world');assert.equal(stage.runs[0].bold,true);assert.equal(stage.runs[0].italic,undefined);
 o=hwpScreenEditPatch(o,{textStyle:{fontSize:120}},'stage');
 assert.equal(hwpScreenObject(o,'stage').textStyle.fontSize,120);assert.equal(hwpScreenObject(o,'stage').runs[0].bold,true);assert.equal(o.runs[0].italic,true);
 o=hwpScreenEditPatch(o,{text:'Stage only',runs:[{text:'Stage only',underline:true}]},'stage');
 assert.equal(o.text,'Hello church');assert.equal(hwpScreenObject(o,'livestream').text,'Hello church');assert.equal(hwpScreenObject(o,'stage').text,'Stage only');
 for(const marker of ['HwpStageTextSlot','hwpRecordingModel','hwpCanvasGradient','hwpCanvasText','hwp-output-text-styles-v5'])includes(marker,marker);
});

test('Template defaults apply separate screen formatting without copying template sample lyrics or overwriting edited slide words',()=>{
 const start=html.indexOf('function fe(e,t){'),end=html.indexOf('function pe(e){',start),quickStart=html.indexOf('function hwpQuickTextPatch('),quickEnd=html.indexOf('function HwpQuickCanvasText(',quickStart);
 const {hwpScreenObject,hwpScreenEditPatch,hwpScreenLinkPatch,hwpTemplateScreenDefaults,hwpQuickApplySlideText}=new Function(screenHelpers+html.slice(start,end)+html.slice(quickStart,quickEnd)+';return {hwpScreenObject,hwpScreenEditPatch,hwpScreenLinkPatch,hwpTemplateScreenDefaults,hwpQuickApplySlideText}')();
 const base={id:'lyrics',kind:'text',binding:'lyrics',text:'Real song',x:30,textStyle:{fontSize:64,shadow:{},stroke:{}}};
 let template={...base,text:'Template example'};
 template=hwpScreenEditPatch(template,{text:'Stage example',textStyle:{fontSize:100},x:42},'stage');
 template=hwpScreenEditPatch(template,{text:'Stream example',textStyle:{fontSize:32}},'livestream');
 let slide=hwpTemplateScreenDefaults(base,template,null);
 assert.equal(hwpScreenObject(slide,'stage').text,'Real song');
 assert.equal(hwpScreenObject(slide,'stage').textStyle.fontSize,100);
 assert.equal(hwpScreenObject(slide,'livestream').textStyle.fontSize,32);
 slide=hwpScreenEditPatch(slide,{text:'Audience update'},'audience');
 assert.equal(hwpScreenObject(slide,'stage').text,'Real song');
 slide=hwpScreenEditPatch(slide,{text:'Stage edit',runs:[{text:'Stage edit',italic:true}]},'stage');
 const updated=hwpTemplateScreenDefaults({...base,text:'Audience update'},template,slide);
 assert.equal(hwpScreenObject(updated,'stage').text,'Stage edit');
 assert.equal(hwpScreenObject(updated,'livestream').text,'Real song');
 const quick=hwpQuickApplySlideText({objects:[updated]},[{id:'lyrics',text:'Quick audience'}]).objects[0];
 assert.equal(quick.text,'Quick audience');
 assert.equal(hwpScreenObject(quick,'stage').text,'Stage edit');
 assert.equal(hwpScreenObject(quick,'livestream').text,'Real song');
 const legacy={...base,hwpTextLinks:{stage:false},hwpTextScreens:{stage:{savedText:'Old',savedRuns:[],textStyle:base.textStyle}}};
 const frozen=hwpQuickApplySlideText({objects:[legacy]},[{id:'lyrics',text:'Quick change'}]).objects[0];
 assert.equal(hwpScreenObject(frozen,'stage').text,'Real song');
 assert.equal(frozen.text,'Quick change');
});
test('Screen switches display icons and audience match options, not independent status copy',()=>{
 const controls=html.slice(html.indexOf('function HwpEditorOutputControls('),html.indexOf('function fe(e,t){'));
 for(const marker of ['Audience screen','Stage screen','Livestream','Match ','checkbox'])assert.ok(controls.includes(marker),marker);
 for(const marker of ['Linked to Audience','Independent ','style makes this screen independent'])assert.ok(!controls.includes(marker),marker);
 assert.ok(html.includes('editorTextOutput:`audience`,selectedObjectIds'));
 assert.ok(html.includes('hasEditor=!!n||template'));
});


test('Template preview is independent of active song, live media and existing presentations',()=>{
 const start=html.indexOf('function Ht(e,t,n){'),end=html.indexOf('function Ut(',start);
 const Ht=new Function('ye','_e',html.slice(start,end)+';return Ht')(theme=>({objects:theme.canvasObjects}), (slide,name,id,category)=>({name,id,category,canvasObjects:slide.objects}));
 const song={id:'hww_removed',hwwLibraryId:'removed',slides:[{id:'real',themeId:'theme',objects:[{text:'Real lyrics'}]}]};
 const state={doc:{themes:[{id:'theme',name:'Song',category:'song',canvasObjects:[{text:'Example'}]}],presentations:[song]},session:{editingTemplateId:'theme',activePresentationId:song.id},live:{presentationId:song.id,mediaId:'live-media'}};
 const edited=Ht(state,slide=>({...slide,objects:[{text:'Changed preview'}]}));
 assert.equal(edited.doc.presentations,state.doc.presentations);
 assert.equal(edited.doc.presentations[0],song);
 assert.equal(edited.doc.themes[0].canvasObjects[0].text,'Changed preview');
 assert.equal(edited.live,state.live);
 assert.equal(edited.doc.themes[0].hwpStandalonePreview,true);
 const templateStart=html.indexOf('function hwpTemplatePreviewObjects('),templateEnd=html.indexOf('function ye(',templateStart);
 const preview=new Function(html.slice(templateStart,templateEnd)+';return hwpTemplatePreviewObjects')()([{kind:'text',binding:'lyrics',text:'Real lyrics',textStyle:{fontSize:80},hwpTextLinks:{stage:false},hwpTextScreens:{stage:{text:'Real stage',textStyle:{fontSize:100},contentEdited:true}}}],'song')[0];
 assert.ok(!preview.text.includes('Real'));
 assert.equal(preview.hwpTextScreens.stage.text,preview.text);
 assert.equal(preview.hwpTextScreens.stage.textStyle.fontSize,100);
 assert.equal(preview.textStyle.fontSize,80);
 const card=html.slice(html.indexOf('function Ri({title:'),html.indexOf('function HwpPresentationViewToggle'));
 assert.ok(card.includes('onClick:()=>i(e),children:(0,M.jsx)(Mn'));
 assert.ok(card.includes('onClick:()=>r(e),children:`Apply`'));
 assert.ok(html.includes('Se=!T&&e.doc.media.find'));
 assert.ok(html.includes('case`apply-theme`:{if(e.session.editingTemplateId)return e;'));
 assert.ok(html.includes('standalone-template-preview-v1'));
});

test('Full stage layout migrates previously hardcoded elements into editable layers without modifying source',()=>{
 const a=html.indexOf('function hwpStageFullLayout('),b=html.indexOf('function hwpStageEditorSnapshot(',a);
 const full=new Function(html.slice(a,b)+';return hwpStageFullLayout')();
 const old={id:'stage',objects:[{id:'cur',kind:'current',x:40,y:80,width:1180,height:664},{id:'clock',kind:'clock',x:1500,y:20,width:380,height:48}]};
 const migrated=full(old);
 assert.equal(old.objects.length,2);
 assert.equal(migrated.objects.filter(o=>o.kind==='clock').length,1);
 for(const kind of ['current','stageTitle','presentation','clock','operatorNotes','stageMessage'])assert.ok(migrated.objects.some(o=>o.kind===kind),kind);
 assert.equal(full(migrated),migrated);
 const removed={...migrated,objects:migrated.objects.filter(o=>o.kind!=='stageMessage')};
 assert.equal(full(removed).objects.some(o=>o.kind==='stageMessage'),false);
 const stage=html.slice(html.indexOf('function Fr({snap:'),html.indexOf('function Ir('));
 assert.ok(stage.includes('hwpStageFullLayout(e.stageLayout)'));
 assert.ok(stage.includes('editorPreview&&previewMessage'));
 assert.ok(stage.includes('render:model=>render(model.message)'));
 assert.ok(stage.includes('message?.text'));
 assert.ok(html.includes('gridTemplateRows:`minmax(0,1fr)`,padding:0,gap:0'));
 const editorStart=html.indexOf('function Lr({selectedSlide=true})');
 const editor=html.slice(editorStart,html.indexOf('function Rr(',editorStart));
 assert.ok(editor.includes('editorPreview:true,previewMessage'));
 assert.ok(editor.includes('hwpStageEditorSnapshot(state,selectedSlide)'));
 assert.ok(html.includes('editorTextOutput:key,stageSlideContent:false,selectedObjectIds:[]'));
 assert.ok(html.includes('hwpTextOutput(e)===`stage`&&!i.stageSlideContent?M.jsx(Lr,{selectedSlide:true})'));
 assert.ok(html.includes('!e.stageLayout&&(0,M.jsxs)(`header`'));
});


test('Unified stage view keeps layout layers and stage-only slide content in one editor',()=>{
 const start=html.indexOf('function Lr({selectedSlide=true})');
 const editor=html.slice(start,html.indexOf('function Rr(',start));
 assert.ok(editor.includes('hwp-stage-integrated'));
 assert.ok(editor.includes('HwpEditorOutputControls'));
 assert.ok(editor.includes('stageSlideContent:true'));
 assert.ok(editor.includes('Pe([target],base.filter'));
 assert.ok(editor.includes('hwp-stage-snap-guide'));
 assert.ok(editor.includes('Preview slide'));
 assert.ok(!editor.includes('modal-back'));
 assert.ok(!html.includes('onClick:()=>g(!0),children:`Stage`'));
});
test('Stage message accents and companion preview bounds match actual output state',()=>{
 assert.ok(html.includes('.hwp-stage-message-actions button:not(.active){background:var(--bg-2)!important'));
 assert.ok(html.includes('.hwp-stage-message-actions button.active{background:var(--amber)!important'));
 assert.ok(!html.includes('.preview.hwp-preview-redesign .hwp-stage-send,'));
 assert.ok(html.includes('style:{aspectRatio:programRatio}'));
 assert.ok(html.includes('hwp-live-monitor-box>.scaled-host{position:absolute;inset:0;width:100%;height:100%;aspect-ratio:auto}'));
 assert.ok(html.includes('hwp-template-icon'));
});

test('Template mode is entered only explicitly and normal editor navigation clears stale template selection',()=>{
 const start=html.indexOf('case`session`:{const p=t.patch'),end=html.indexOf('case`select-objects`:',start);
 assert.ok(start>=0&&end>start);
 const reduce=new Function('e','t','switch(t.type){'+html.slice(start,end)+'default:return e}');
 const base={doc:{presentations:[{id:'real',slides:[{id:'slide'}]}]},session:{mode:'edit',activePresentationId:'real',selectedSlideIds:['slide'],selectedObjectIds:['template-layer'],editingTemplateId:'scripture',inspectorTab:'text',stageSlideContent:true}};
 assert.equal(reduce(base,{type:'session',patch:{zoom:0.5}}).session.editingTemplateId,'scripture');
 const open=reduce(base,{type:'session',patch:{mode:'edit',editingTemplateId:'song',selectedObjectIds:['lyrics']}});
 assert.equal(open.session.editingTemplateId,'song');
 assert.equal(open.session.stageSlideContent,false);
 for(const patch of [{mode:'show'},{mode:'edit'},{activePresentationId:'real'},{selectedSlideIds:['slide']}]) {
  const next=reduce(base,{type:'session',patch});
  assert.equal(next.session.editingTemplateId,null);
  assert.deepEqual(next.session.selectedObjectIds,[]);
  assert.equal(next.session.stageSlideContent,false);
 }
 assert.equal(reduce(base,{type:'select-slides',ids:['slide']}).session.editingTemplateId,null);
 assert.equal(reduce(base,{type:'select-presentation',id:'real'}).session.editingTemplateId,null);
 assert.ok(html.includes('!i.editingTemplateId&&hwpTextOutput(e)===`stage`'));
});
test('Stage uses the same editor chrome and places layout controls in the normal right inspector',()=>{
 const start=html.indexOf('function Lr({selectedSlide=true})'),end=html.indexOf('function Rr(',start);
 const stage=html.slice(start,end);
 for(const marker of ['className:`film`','className:`film-slides`','className:`editor-main`','className:`editor-tools`','className:`viewport hwp-stage-shared-viewport`','className:`inspector hwp-stage-inspector hwp-stage-shared-inspector`','className:`hwp-stage-panel-controls`','className:`tabs`','className:`inspector-body`','title:`Text box`','title:`Media box`','title:`Shapes`','title:`Duplicate`','title:`Delete`','title:`Bring forward`','title:`Send backward`','Math.round(scale*100)','Preview stage message','Slide content'])assert.ok(stage.includes(marker),marker);
 assert.ok(!stage.includes('className:`hwp-stage-toolbar`'));
 assert.ok(!stage.includes('className:`hwp-stage-workspace`'));
 assert.ok(!html.includes('.app[data-mode="edit"]>.hwp-stage-integrated{grid-column:1/-1'));
 assert.ok(html.includes('unified-stage-editor-v4'));
});

test('HWP header keeps permanent slots across workspace and status changes',()=>{
 const fixed=css.slice(css.indexOf('/* Stable HWP header slots'));
 assert.ok(fixed.includes('grid-template-columns:100px 42px 74px 164px'));
 for(const [selector,col] of [['.brand',1],['[aria-label="Search library"]',2],['.hwp-production-modes',4],['[aria-label="Audience screen"]',8],['[aria-label="Stage screen"]',9],['.hwp-cloud-indicator',10],['.hwp-fullscreen-toggle',11],['.hwp-template-icon',12],['.settings-gear',13]]) {
  assert.ok(fixed.includes(selector+' {grid-column:'+col),selector);
 }
 assert.ok(fixed.includes('grid-column:3;width:74px'));
 assert.ok(fixed.includes('grid-column:6;position:relative'));
 assert.ok(fixed.includes('repeat(4,minmax(0,1fr))'));
 assert.ok(fixed.includes('visibility:hidden;pointer-events:none'));
 assert.ok(html.includes('hwp-access.css?v=hwp-fixed-header-v1'));
});

test('authentication recovers transient access errors without overriding denial',async()=>{const {verifyHwpAccess,validHwpConfig}=await import('../sync-staging/hwp-auth.mjs');let calls=0,refresh=0;const user={getIdToken:async force=>{assert.equal(force,true);refresh++}};const system={auth:{workspace:async data=>{assert.equal(data.action,'access');if(++calls===1)throw Object.assign(Error(),{code:'functions/unavailable'});return {ok:true}}}};assert.deepEqual(await verifyHwpAccess(system,user),{ok:true});assert.equal(calls,2);assert.equal(refresh,1);calls=0;await assert.rejects(verifyHwpAccess({auth:{workspace:async()=>{calls++;throw Object.assign(Error(),{code:'functions/permission-denied'})}}},user),{code:'functions/permission-denied'});assert.equal(calls,1);assert.equal(refresh,1);assert.equal(validHwpConfig({projectId:'wrong',apiKey:'x',appId:'x',authDomain:'x'}),false);});

test('Editor deletion selects the next visible slide, then the previous one, without leaving edit mode',()=>{
 const start=html.indexOf('function hwpEditorOrderedSlides('),end=html.indexOf('function HwpEditorSlideContextMenu(',start);
 assert.ok(start>=0&&end>start);
 const select=new Function(html.slice(start,end)+';return hwpEditorDeleteSelection;')();
 const p={groups:[{id:'a'},{id:'b'}],slides:[{id:'1',groupId:'a'},{id:'3',groupId:'b'},{id:'2',groupId:'a'},{id:'4',groupId:'b'}]};
 const session={mode:'edit',activePresentationId:'p',selectedSlideIds:['2'],selectedObjectIds:['old-object'],inspectorTab:'text'};
 const next=select(p,session,['2']);assert.deepEqual(next.selectedSlideIds,['3']);assert.deepEqual(next.selectedObjectIds,[]);assert.equal(next.inspectorTab,'slide');assert.equal(next.mode,'edit');assert.equal(next.activePresentationId,'p');
 assert.deepEqual(select(p,{...session,selectedSlideIds:['4']},['4']).selectedSlideIds,['3']);
 assert.deepEqual(select(p,session,['2','3']).selectedSlideIds,['4']);
 assert.deepEqual(select(p,session,['2','3','4']).selectedSlideIds,['1']);
 assert.deepEqual(select(p,session,['1','2','3','4']).selectedSlideIds,[]);
 assert.deepEqual(select(p,session,['3']).selectedSlideIds,['2']);
 assert.deepEqual(select(p,session,['3']).selectedObjectIds,['old-object']);
 assert.ok(html.includes('session:e.session.mode===`edit`?hwpEditorDeleteSelection(ke(e),e.session,t.ids)'));
});

test('Changing a filmstrip label preserves slide order even when labels repeat',()=>{
 const start=html.indexOf('function hwpEditorOrderedSlides('),end=html.indexOf('function HwpEditorSlideContextMenu(',start);
 const {order,runs,select}=new Function(html.slice(start,end)+';return {order:hwpEditorOrderedSlides,runs:hwpEditorSlideRuns,select:hwpEditorDeleteSelection};')();
 const p={groups:[{id:'verse',name:'Verse'},{id:'chorus',name:'Chorus'}],slides:[{id:'1',groupId:'verse'},{id:'2',groupId:'verse'},{id:'3',groupId:'verse'},{id:'4',groupId:'chorus'}]};
 const from=html.indexOf('case`set-slide-label`:'),to=html.indexOf('case`set-slide-tags`:',from);
 const change=new Function('e','t','j','hwpRegisteredLabel','hwpLabelFields','w','Ce','hwpEditorOrderedSlides','switch(t.type){'+html.slice(from,to)+'default:return e}');
 const state={doc:{},session:{mode:'edit'}};
 const apply=(p,slideId,name)=>change(state,{type:'set-slide-label',slideId,name,preserveEditorOrder:true},(_e,fn)=>fn(p),(_doc,name)=>({name,color:'#123456'}),o=>o,()=> 'new-label',()=>{throw Error('Editor should not use Show order')},order);
 const changed=apply(p,'2','Chorus');
 assert.deepEqual(changed.slides.map(s=>s.id),['1','2','3','4']);
 assert.deepEqual(runs(changed).map(r=>[r.group.name,r.slides.map(s=>s.id)]),[['Verse',['1']],['Chorus',['2']],['Verse',['3']],['Chorus',['4']]]);
 const custom=apply(changed,'3','Bridge');
 assert.deepEqual(runs(custom).flatMap(r=>r.slides.map(s=>s.id)),['1','2','3','4']);
 assert.equal(custom.slides[2].groupId,'new-label');
 assert.deepEqual(select(changed,{selectedSlideIds:['2'],selectedObjectIds:[]},['2']).selectedSlideIds,['3']);
 assert.equal((html.match(/children:hwpEditorSlideRuns\(n\)/g)||[]).length,2);
 assert.ok(html.includes('preserveEditorOrder:true,history:"push"'));
});
