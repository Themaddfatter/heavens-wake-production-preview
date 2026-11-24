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
 assert.ok(agent.includes('if(currentKey!==signature.current)'));
 assert.ok(agent.includes('else emit("syncing");'));
 assert.ok(html.includes('name="hwp-release" content="hwp-media-deletion-safety-v1"'));
});

test('production dynamically loads versioned media-safety modules',()=>{
 for(const name of ['hwp-sync-client','hwp-sync-controller','hwp-firebase-media-remote'])
  assert.ok(html.includes("import('./sync-staging/"+name+".mjs?v=hwp-media-deletion-safety-v1')"),name);
});

test("Operator workflow changes are present",()=>{for(const part of ["+ Create Template","Create and edit","hwpPresentationView","Type a message first.","hwpMergeServiceScriptures","hwpNormalizeMediaFolders","Choose existing media","Create a medley with the first selected song"])assert.ok(html.includes(part),part);assert.ok(!html.slice(html.indexOf("function HwpStageMessageComposer()"),html.indexOf("function Ni()")).includes("disabled:"));});

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
test("Bible editions are loaded on request without blocking sign-in",()=>{assert.ok(html.includes("function hwpLoadBibleFile(name)"));assert.ok(html.includes("HWP_BIBLE_FILES.has(m[1])"));assert.ok(!html.includes('<script src="./hwp-bibles/kjv.js">'));assert.ok(html.includes("action:'access'"));});

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
 const {hwpLayoutSlide,hwpLayoutLayer}=new Function(html.slice(start,end)+';return {hwpLayoutSlide,hwpLayoutLayer}')();
 const slide={background:{type:'color'},objects:[{kind:'rect'},{kind:'text',text:'Song',textStyle:{color:'#000'}}]};
 assert.equal(hwpLayoutSlide(slide,{mode:'off'}),null);
 assert.equal(hwpLayoutSlide(slide,{mode:'full'}).objects.length,2);
 const textSlide=hwpLayoutSlide(slide,{mode:'text',customText:true,textColor:'#fff'});
 assert.equal(textSlide.objects.length,1);
 assert.equal(textSlide.objects[0].textStyle.color,'#fff');
 assert.equal(hwpLayoutLayer({cameraX:0,cameraY:0,cameraW:100,cameraH:100,slideBehind:true},'camera').zIndex,2);
 assert.equal(slide.objects[1].textStyle.color,'#000');
});
