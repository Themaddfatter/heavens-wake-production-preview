import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../hwp-access.css",import.meta.url),"utf8");
const start=html.indexOf("function hwpServiceZone(item){");
const end=html.indexOf("function qt(e,t){",start);
assert.ok(start>=0&&end>start,"service helper section exists");
let counter=0;
const ctx=createContext({w:()=> "generated-"+ ++counter,Map,Set,Math,String,Array});
runInContext(html.slice(start,end),ctx);
const presentations=[
 {id:"song-a",name:"Amazing Grace",category:"song"},
 {id:"song-b",name:"How Great",category:"song"},
 {id:"song-c",name:"Holy Is He",category:"song"},
 {id:"scripture",name:"Acts 2:8",category:"scripture"},
 {id:"other",name:"Announcements",category:"other"}
];
function get(row,p){return p.items.find(item=>item.presentationId===row)}
function byKey(p,key){return p.items.find(item=>item.permanentHeaderKey===key)}
function fixture(){
 let p=ctx.hwpEnsureServiceHeaders({id:"service",items:[]});
 for(const v of presentations)p=ctx.hwpServiceAppendPresentation(p,v.id,v.category);
 return p
}

test("new normal presentations are placed after Service End and never under boundary",()=>{
 const p=fixture(),a=get("other",p),song=get("song-a",p),reading=get("scripture",p);
 assert.equal(ctx.hwpServiceZone(a),"after");
 assert.equal(a.groupHeaderId,null);
 assert.equal(a.medleyParentId,null);
 assert.equal(song.groupHeaderId,byKey(p,"praise-songs").id);
 assert.equal(reading.groupHeaderId,byKey(p,"sermon").id);
 assert.equal(ctx.hwpServiceZone(song),"inside");
 assert.equal(ctx.hwpServiceZone(reading),"inside");
 assert.ok(!p.items.some(row=>row.header==="Service Start"||row.header==="Service End"),
  "boundaries are not ordinary linkable headers");
});
test("presentation position inside a real header determines its ownership",()=>{
 let p=fixture(),other=get("other",p),sermon=byKey(p,"sermon");
 p=ctx.hwpServiceMove(p,other.id,sermon.id,true);
 let moved=get("other",p);
 assert.equal(moved.groupHeaderId,sermon.id);
 assert.equal(ctx.hwpServiceZone(moved),"inside");
 p=ctx.hwpServiceMoveOutside(p,moved.id,"after");
 assert.equal(get("other",p).groupHeaderId,null);
 assert.equal(ctx.hwpServiceZone(get("other",p)),"after");
});
test("medley uses the first song name and indents members without renaming the library title",()=>{
 let p=fixture(),root=get("song-a",p),child=get("song-b",p),third=get("song-c",p);
 assert.equal(ctx.hwpServiceCanMedley(p,child.id,root.id,presentations),true);
 p=ctx.hwpServiceCreateMedley(p,child.id,root.id,presentations);
 p=ctx.hwpServiceCreateMedley(p,third.id,root.id,presentations);
 const items=p.items,parent=get("song-a",p);
 assert.equal(get("song-b",p).medleyParentId,parent.id);
 assert.equal(get("song-c",p).medleyParentId,parent.id);
 assert.equal(ctx.hwpServiceMedleyTitle(parent,presentations[0],items),"Amazing Grace Medley");
 assert.equal(presentations[0].name,"Amazing Grace");
 const at=items.findIndex(r=>r.id===parent.id);
 assert.deepEqual(Array.from(items.slice(at,at+3),row=>row.presentationId),["song-a","song-b","song-c"]);
});
test("medleys cannot contain themselves or presentations that are not songs",()=>{
 let p=fixture(),root=get("song-a",p),reading=get("scripture",p),other=get("other",p);
 assert.equal(ctx.hwpServiceCanMedley(p,root.id,root.id,presentations),false);
 assert.equal(ctx.hwpServiceCanMedley(p,reading.id,root.id,presentations),false);
 assert.equal(ctx.hwpServiceCanMedley(p,other.id,root.id,presentations),false);
 assert.equal(ctx.hwpServiceCanMedley(p,root.id,reading.id,presentations),false);
});
test("nested medleys and medley-parent cycles are blocked",()=>{
 let p=fixture(),a=get("song-a",p),b=get("song-b",p),c=get("song-c",p);
 p=ctx.hwpServiceCreateMedley(p,b.id,a.id,presentations);
 assert.equal(ctx.hwpServiceCanMedley(p,c.id,b.id,presentations),false);
 assert.equal(ctx.hwpServiceCanMedley(p,a.id,b.id,presentations),false);
 p=ctx.hwpServiceCreateMedley(p,c.id,b.id,presentations);
 assert.equal(get("song-c",p).medleyParentId,null);
});
test("moving a medley root into another header carries linked songs",()=>{
 let p=fixture(),a=get("song-a",p),b=get("song-b",p),sermon=byKey(p,"sermon");
 p=ctx.hwpServiceCreateMedley(p,b.id,a.id,presentations);
 p=ctx.hwpServiceMove(p,a.id,sermon.id,true);
 assert.equal(get("song-a",p).groupHeaderId,sermon.id);
 assert.equal(get("song-b",p).groupHeaderId,sermon.id);
 assert.equal(get("song-b",p).medleyParentId,a.id);
});
test("moving a medley member away unlinks it cleanly",()=>{
 let p=fixture(),a=get("song-a",p),b=get("song-b",p);
 p=ctx.hwpServiceCreateMedley(p,b.id,a.id,presentations);
 p=ctx.hwpServiceMoveOutside(p,b.id,"after");
 assert.equal(get("song-b",p).medleyParentId,null);
 assert.equal(get("song-b",p).groupHeaderId,null);
 assert.equal(ctx.hwpServiceZone(get("song-b",p)),"after");
 assert.equal(ctx.hwpServiceMedleyTitle(get("song-a",p),presentations[0],p.items),"Amazing Grace");
});
test("unlink a medley member without deleting or renaming its song",()=>{
 let p=fixture(),a=get("song-a",p),b=get("song-b",p);
 p=ctx.hwpServiceCreateMedley(p,b.id,a.id,presentations);
 p=ctx.hwpServiceRemoveFromMedley(p,b.id);
 assert.equal(get("song-b",p).medleyParentId,null);
 assert.equal(ctx.hwpServiceZone(get("song-b",p)),"inside");
 assert.equal(get("song-b",p).groupHeaderId,byKey(p,"praise-songs").id);
});
test("center shows all service zones in order without medley indentation",()=>{
 assert.ok(html.includes("hwpServiceMedleyTitle(item,presentation,pl?.items)"));
 assert.ok(html.includes("item.medleyParentId&&" + String.fromCharCode(96) + "service-medley-child" + String.fromCharCode(96)));
 assert.ok(html.includes('filter(item=>hwpServiceZone(item)===' + String.fromCharCode(96) + 'after' + String.fromCharCode(96) + ')'));
 assert.ok(html.includes('"create-service-medley"'));
 assert.ok(html.includes('"remove-service-medley"'));
 assert.ok(css.includes(".service-presentation.service-medley-child"));
 assert.ok(css.includes(".all-service-presentation.service-medley-child > h3.all-pres-bar"));
 assert.ok(!html.includes("groupHeaderId&&pl?.items.some(row=>row.id===item.groupHeaderId"));
});
test("Bible instructions and alternate translation popup button are not displayed",()=>{
 for(const text of [
  "Click a verse, then shift-click to extend the range.",
  "More translation choices",
  "Choose up to four translations. Each will be grouped on separate slides with its own heading and abbreviation tag."
 ])assert.equal(html.includes(text),false,text);
});


test("selected songs are grouped under the first song in service order",()=>{
 let p=fixture();
 const selected=[get("song-a",p).id,get("song-b",p).id,get("song-c",p).id];
 p=selected.slice(1).reduce((current,id)=>ctx.hwpServiceCreateMedley(current,id,selected[0],presentations),p);
 const members=p.items.filter(row=>row.medleyParentId===selected[0]);
 assert.deepEqual(Array.from(members,row=>row.presentationId),["song-b","song-c"]);
 assert.ok(html.includes('Create medley from selected songs'));
 assert.ok(html.includes('create-service-medley-from-selection'));
});


const upcomingStart=html.indexOf("function hwpTodayServiceDay(");
const upcomingEnd=html.indexOf("function Nr(){",upcomingStart);
assert.ok(upcomingStart>=0&&upcomingEnd>upcomingStart,"upcoming published service filter is present");
const upcoming=createContext({Intl,Date,String,Array,Number});
runInContext(html.slice(upcomingStart,upcomingEnd),upcoming);

test("only today's and future published Ministry Connect schedules are shown in HWP",()=>{
 const today="2026-11-23";
 const entries=[
  {id:"old",name:"Sunday — Nov 22, 2026",hwpScheduleId:"s1",hwpScheduleDay:"2026-11-22",hwpSchedulePublished:true},
  {id:"today",name:"Monday — Nov 23, 2026",hwpScheduleId:"s2",hwpScheduleDay:today,hwpSchedulePublished:true},
  {id:"future",name:"Wednesday — Nov 25, 2026",hwpScheduleId:"s3",hwpScheduleDay:"2026-11-25",hwpSchedulePublished:true},
  {id:"draft",hwpScheduleId:"s4",hwpScheduleDay:"2026-11-24",hwpSchedulePublished:false},
  {id:"legacy-old",hwpScheduleId:"s5",name:"Saturday — Nov 21, 2026"},
  {id:"legacy-next",hwpScheduleId:"s6",name:"Friday — Nov 27, 2026"},
  {id:"unknown-date",hwpScheduleId:"s7",name:"Published but undated"},
  {id:"manual",name:"Manual service"}
 ];
 const visible=upcoming.hwpVisibleServices(entries,today);
 assert.deepEqual(Array.from(visible,x=>x.id),["today","future","legacy-next","manual"]);
 assert.equal(upcoming.hwpActiveService(entries,"old",today).id,"today");
 assert.equal(upcoming.hwpActiveService(entries,"future",today).id,"future");
 assert.equal(entries.length,8,"past services remain stored");
});
test("HWP service dates use America/Los_Angeles and do not expire during their day",()=>{
 assert.equal(upcoming.hwpTodayServiceDay(new Date("2026-11-24T07:59:00Z")),"2026-11-23");
 assert.equal(upcoming.hwpTodayServiceDay(new Date("2026-11-24T08:01:00Z")),"2026-11-24");
 const current={id:"today",hwpScheduleId:"s2",hwpScheduleDay:"2026-11-23",hwpSchedulePublished:true};
 assert.equal(upcoming.hwpVisibleServices([current],"2026-11-23").length,1);
 assert.equal(upcoming.hwpVisibleServices([current],"2026-11-24").length,0);
});

test("service picker is one compact native selector with service inside it",()=>{
 assert.ok(html.includes('className:`panel-head hwp-service-picker-head`'));
 assert.ok(html.includes('className:`hwp-service-dropdown`'));
 assert.ok(html.includes('children:serviceOptions.length?serviceOptions.map'));
 assert.ok(html.includes('children:e.name'));
 assert.ok(html.includes('title:i?.name||`No upcoming published services`'));
 assert.ok(html.includes('"aria-label":`Service`'));
 assert.ok(!html.includes('className:`hwp-service-dropdown-label`'));
 assert.ok(!html.includes('children:[(0,M.jsx)(`span`,{children:`Service`})'));
 assert.ok(css.includes('--left:232px!important'));
 assert.ok(css.includes('select.hwp-service-dropdown'));
 assert.ok(css.includes('height:32px'));
 assert.ok(css.includes('width:100%'));
});

test("Ministry Connect service types select the correct independent HWP theme",()=>{
 assert.equal(ctx.hwpServiceThemeType({hwpScheduleServiceType:"sunday-spanish",name:"Unknown"}),"sunday-spanish");
 assert.equal(ctx.hwpServiceThemeType({name:"Sunday English — Nov 29, 2026"}),"sunday-english");
 assert.equal(ctx.hwpServiceThemeType({hwpScheduleServiceType:"wednesday"}),"wednesday");
 assert.equal(ctx.hwpServiceThemeType({hwpScheduleServiceType:"tuesday"}),"consecration");
 assert.equal(ctx.hwpServiceThemeType({hwpScheduleServiceType:"thursday"}),"consecration");
 assert.equal(ctx.hwpServiceThemeType({name:"Unrecognized Special Service"}),null);
});
test("saved service theme preserves sermon and song ownership and applies header and boundary colors",()=>{
 const base={...fixture(),hwpScheduleId:"ministry_service",hwpScheduleServiceType:"sunday-spanish"};
 const themed={headers:[
  {key:"sermon",name:"Sermon",bgColor:"#244466",fontColor:"#ffffff"},
  {key:"praise-songs",name:"Praise Songs",bgColor:"#552266",fontColor:"#eeeeee"},
  {key:"custom-welcome",name:"Welcome",bgColor:"#227744",fontColor:"#ffffff"}
 ],boundaryStyles:{start:{bgColor:"#333333",fontColor:"#ffffff"},end:{bgColor:"#111111",fontColor:"#eeeeee"}}};
 const updated=ctx.hwpApplyServiceThemeToPlaylist(base,themed);
 assert.equal(updated.items.filter(x=>x.header)[0].header,"Sermon");
 assert.equal(updated.items.filter(x=>x.header)[1].header,"Praise Songs");
 assert.equal(updated.items.filter(x=>x.header)[2].header,"Welcome");
 assert.equal(byKey(updated,"praise-songs").bgColor,"#552266");
 assert.equal(byKey(updated,"sermon").bgColor,"#244466");
 assert.equal(get("song-a",updated).groupHeaderId,byKey(updated,"praise-songs").id);
 assert.equal(get("scripture",updated).groupHeaderId,byKey(updated,"sermon").id);
 assert.equal(updated.boundaryStyles.start.bgColor,"#333333");
 assert.equal(updated.boundaryStyles.end.bgColor,"#111111");
 assert.equal(ctx.hwpApplyServiceThemeToPlaylist(updated,themed),updated,"theme application is stable");
 assert.equal(ctx.hwpApplyServiceThemeToPlaylist(fixture(),themed).hwpScheduleId,undefined,"manual services are not overwritten");
});
test("service theme editor includes template selection, reorder, colors and save",()=>{
 assert.ok(html.includes('function HwpServiceThemeSettings()'));
 assert.ok(html.includes('i===`Service Themes`'));
 assert.ok(html.includes('Save Service Theme'));
 assert.ok(html.includes('Use current service layout'));
 assert.ok(html.includes('type:"save-service-theme"'));
 assert.ok(html.includes('case"save-service-theme"'));
 assert.ok(css.includes('.hwp-service-theme-editor .hwp-theme-header-row'));
});
test("expanded right preview removes clear buttons and transport and includes stage messages",()=>{
 const start=html.indexOf("function Ni("),end=html.indexOf("function Pi(){",start);
 assert.ok(start>0&&end>start);
 const preview=html.slice(start,end);
 assert.ok(preview.includes('className:`preview hwp-preview-redesign`'));
 assert.ok(preview.includes('className:`hwp-preview-meta-actions`'));
 assert.ok(preview.includes('HwpStageMessageComposer'));
 assert.ok(!preview.includes('className:`clears`'));
 assert.ok(!preview.includes('(0,M.jsx)(Pi,{})'));
 assert.ok(html.includes('function HwpStageFlash({message})'));
 assert.ok(html.includes('stageMessage:n.stageMessage??null'));
 assert.ok(html.includes('className:`hwp-stage-flash`'));
 assert.ok(css.includes('.preview.hwp-preview-redesign .program-frame'));
 assert.ok(css.includes('.stage-layout .hwp-stage-flash'));
 const audience=html.slice(html.indexOf('function tr({snap:e'),html.indexOf('function nr(',html.indexOf('function tr({snap:e')));
 assert.ok(!audience.includes('HwpStageFlash'),"audience must not show stage-only flashes");
});


test("left drag detaches only after intentional horizontal movement, not normal vertical reorder",()=>{
 const gesture={member:true,x:90,y:100};
 assert.equal(ctx.hwpMedleyDragDetach(gesture,65,104),true);
 assert.equal(ctx.hwpMedleyDragDetach(gesture,80,100),false);
 assert.equal(ctx.hwpMedleyDragDetach(gesture,65,155),false);
 assert.equal(ctx.hwpMedleyDragDetach(gesture,120,100),false);
 assert.equal(ctx.hwpMedleyDragDetach({...gesture,member:false},30,100),false);
 assert.equal(ctx.hwpMedleyDragDetach({member:true,x:15,y:100},3,100),true);
 assert.ok(html.includes("onDropCapture:event=>medleyDragCapture(event,true)"));
 assert.ok(html.includes('event.key==="ArrowLeft"'));
});
test("detaching root promotes next medley song without removing presentations",()=>{
 let p=fixture(),a=get("song-a",p),b=get("song-b",p),c=get("song-c",p);
 p=ctx.hwpServiceCreateMedley(p,b.id,a.id,presentations);
 p=ctx.hwpServiceCreateMedley(p,c.id,a.id,presentations);
 p=ctx.hwpServiceRemoveFromMedley(p,a.id);
 assert.equal(get("song-a",p).medleyParentId,null);
 assert.equal(get("song-b",p).medleyParentId,null);
 assert.equal(get("song-c",p).medleyParentId,b.id);
 assert.equal(get("song-a",p).groupHeaderId,byKey(p,"praise-songs").id);
 assert.equal(ctx.hwpServiceMedleyTitle(get("song-b",p),presentations[1],p.items),"How Great Medley");
 assert.equal(p.items.filter(row=>row.presentationId).length,5);
});
test("medley glow has persisted appearance setting and applies to both views",()=>{
 assert.equal(ctx.hwpMedleyGlow(undefined),"#29ff70");
 assert.equal(ctx.hwpMedleyGlow("invalid"),"#29ff70");
 assert.equal(ctx.hwpMedleyGlowStyle("#b624ff")["--hwp-medley-glow"],"#b624ff");
 assert.equal(ctx.hwpMedleyGlowStyle("#b624ff")["--hwp-medley-glow-soft"],"#b624ff99");
 assert.equal(html.split("style:hwpMedleyGlowStyle(e.doc.settings.appearance.medleyGlow)").length-1,2);
 assert.ok(html.includes("Medley glow color"));
 assert.ok(html.includes("medleyGlow:e.target.value"));
 assert.ok(css.includes("border:4px solid var(--hwp-medley-glow,#29ff70)"));
 assert.ok(css.includes(".all-service-presentation.service-medley-child > h3.all-pres-bar{margin-left:0!important;width:100%!important"));
});

test("normal reorder before or after a medley never joins it",()=>{let p=fixture();const a=get("song-a",p),b=get("song-b",p),c=get("song-c",p);p=ctx.hwpServiceCreateMedley(p,b.id,a.id,presentations);p=ctx.hwpServiceMove(p,c.id,a.id,true);assert.equal(get("song-c",p).medleyParentId,null);assert.deepEqual(Array.from(p.items.filter(x=>x.presentationId?.startsWith("song-")),x=>x.presentationId),["song-a","song-b","song-c"]);p=ctx.hwpServiceMove(p,c.id,b.id,false);assert.deepEqual(Array.from(p.items.filter(x=>x.presentationId?.startsWith("song-")),x=>x.presentationId),["song-c","song-a","song-b"]);assert.equal(get("song-c",p).medleyParentId,null);assert.ok(html.includes("hwp-medley-join-target"));assert.ok(!html.includes("},t.id),medleyDrop(item)]"));});

test("moving a child between siblings preserves its medley; standalone moves never join it",()=>{let p=fixture(),a=get("song-a",p),b=get("song-b",p),c=get("song-c",p);p=ctx.hwpServiceCreateMedley(p,b.id,a.id,presentations);p=ctx.hwpServiceCreateMedley(p,c.id,a.id,presentations);p=ctx.hwpServiceMove(p,c.id,b.id,false);assert.deepEqual(Array.from(p.items.filter(x=>x.presentationId?.startsWith("song-")),x=>x.presentationId),["song-a","song-c","song-b"]);assert.equal(get("song-c",p).medleyParentId,a.id);p=ctx.hwpServiceRemoveFromMedley(p,c.id);assert.equal(get("song-c",p).medleyParentId,null);});


test("Presenter Sound Mixer companion shares selected mix, channel levels, master and gain",()=>{
 const start=html.indexOf("function HwpCompanionSwitch("),end=html.indexOf("function hwpVisualFrame",start);
 const faderStart=html.indexOf("function hwpMixerDbPosition("),faderEnd=html.indexOf("function HwpSoundMixer(",faderStart);
 assert.ok(start>=0&&end>start&&faderStart>=0&&faderEnd>faderStart);
 const h=(tag,props,...children)=>({tag,props,children});
 let slots=[],cursor=0;
 const hooks={useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],x=>{slots[i]=typeof x==="function"?x(slots[i]):x}]},useRef:v=>({current:v}),useEffect:()=>{},useLayoutEffect:()=>{}};
 const scope=createContext({M:{jsx:(tag,props)=>({tag,props,children:props.children})},l:hooks,F:(...args)=>args.filter(Boolean).join(" "),hwpMixerNode:h,hwpMixerCategories:["Unassigned"],hwpAccentInk:()=>"#fff"});
 runInContext(html.slice(start,end)+html.slice(faderStart,faderEnd),scope);
 let data={buses:[{id:0,name:"Main",enabled:true,level:-80,on:false,color:"#123456"},{id:1,name:"Mix 01",enabled:true,level:-40,on:true,color:"#123456"}],channels:Array.from({length:4},(_,id)=>({id,name:id?"Input "+id:"Vocal",category:"Unassigned",color:"#123456",levels:[-80,-10],on:[false,true],ag:0,dg:0}))},mix=1;
 const render=()=>{cursor=0;return scope.HwpMixerCompanion({data,setData:fn=>{data=fn(data)},mix,setMix:v=>{mix=v}})};
 function flat(n,includeInactive=false){return !n||typeof n!=="object"||(!includeInactive&&n.props?.inert)?[]:[n,...(Array.isArray(n.children)?n.children:[n.children]).flatMap(child=>flat(child,includeInactive))]}
 let view=render();
 const find=label=>flat(view).find(n=>n.props?.["aria-label"]===label);
 assert.ok(find("Vocal fader"));assert.ok(find("Input 2 fader"));assert.equal(find("Input 3 fader"),undefined);
 assert.equal(find("Open full Sound Mixer"),undefined);
 const bankPositions=()=>flat(view,true).filter(n=>n.props?.["data-bank-index"]!==undefined).map(n=>[n.props["data-bank-index"],n.props.inert]);
 assert.deepEqual(bankPositions(),[[0,false],[1,true]]);
 find("Vocal fader").props.onChange({target:{value:String(scope.hwpMixerFaderInterpolate(-5.5,0,1))}});
 find("Mute Vocal").props.onClick();
 find("Master fader").props.onClick();view=render();
 assert.equal(find("Master fader").props["aria-pressed"],true);
 find("Mix 01 Master fader").props.onChange({target:{value:String(scope.hwpMixerFaderInterpolate(0,0,1))}});
 find("Master fader").props.onClick();view=render();assert.equal(find("Master fader").props["aria-pressed"],false);
 find("Gain: Vocal").props.onClick();view=render();assert.equal(find("Gain: Vocal").props["aria-pressed"],true);
 find("Vocal A.GAIN").props.onChange({target:{value:"12"}});
 find("Vocal D.GAIN").props.onChange({target:{value:"-6"}});
 find("Close gain").props.onClick();view=render();assert.equal(find("Gain: Vocal").props["aria-pressed"],false);
 find("EQ: Vocal").props.onClick();view=render();
 assert.equal(find("EQ: Vocal").props["aria-pressed"],true);
 const eqPanel=flat(view).find(n=>n.tag===scope.HwpMixerEqPanel);
 assert.ok(eqPanel);
 const eq=scope.hwpMixerEqDefault();eq.bands[2].gain=6;
 eqPanel.props.onChange(eq);
 assert.equal(data.channels[0].eq.bands[2].gain,6);
 assert.ok(Math.abs(scope.hwpMixerEqResponse(eq,2000)-6)<.00001);
 eq.enabled=false;assert.equal(scope.hwpMixerEqResponse(eq,2000),0);
 find("Close channel popup").props.onClick();view=render();
 find("Edit Vocal").props.onClick();view=render();
 const editPanel=flat(view).find(n=>n.tag===scope.HwpMixerCompanionChannelEdit);
 assert.ok(editPanel);editPanel.props.onChange({name:"Lead Vocal"});
 assert.equal(data.channels[0].name,"Lead Vocal");
 editPanel.props.onChange({name:"Vocal"});
 find("Close channel popup").props.onClick();view=render();
 assert.ok(html.includes("channelTool('EQ',name"));
 assert.ok(!html.includes("channelTool('Edit',name"));

 const nav=flat(view).find(n=>n.tag===scope.HwpFaderPageNav);
 const navView=scope.HwpFaderPageNav(nav.props);
 flat(navView).find(n=>n.props?.["aria-label"]==="Next fader bank").props.onClick();view=render();
 assert.equal(find("Vocal fader"),undefined);assert.ok(find("Input 3 fader"));
 assert.deepEqual(bankPositions(),[[0,true],[1,false]]);
 const nav2=flat(view).find(n=>n.tag===scope.HwpFaderPageNav);
 flat(scope.HwpFaderPageNav(nav2.props)).find(n=>n.props?.["aria-label"]==="Previous fader bank").props.onClick();view=render();
 assert.deepEqual(bankPositions(),[[0,false],[1,true]]);
 find("Mixer output").props.onChange({target:{value:"0"}});
 assert.equal(data.channels[0].levels[0],-80);
 assert.equal(data.channels[0].levels[1],-5.5);
 assert.equal(data.channels[0].on[1],false);
 assert.equal(data.channels[0].ag,12);assert.equal(data.channels[0].dg,-6);
 assert.equal(data.buses[1].level,0);
 assert.equal(data.buses[0].level,-80);
 assert.equal(mix,0);
 assert.equal(scope.hwpMixerPageSize(285,91,6),3);
 assert.equal(scope.hwpMixerPageSize(284,91,6),2);
 const tabs=scope.HwpCompanionSwitch({active:"mixer",onChange:()=>{}}).props.children;
 assert.equal(tabs.length,3);assert.equal(tabs.filter(tab=>tab.props["aria-pressed"]).length,1);
 assert.equal(tabs[2].props["aria-label"],"Sound Mixer Companion");
 assert.ok(html.includes("Ni,{mixerData,setMixerData,mixerMix,setMixerMix}"));
 assert.ok(!html.includes("className:`service-num`,children:`BG`"));
 assert.ok(html.includes("width:calc(100% + 24px)"));
 assert.ok(html.includes("hwpUseFaderPages(channels.length,category,null,width)"));
 assert.ok(html.includes("scroll-snap-type:y mandatory"));
 assert.ok(html.includes("scroll-snap-stop:normal"));
 assert.ok(html.includes("touch-action:pan-y"));
 assert.ok(html.includes("el.scrollTop=drag.top-dy"));
 assert.equal(scope.hwpMixerNearestPage(0,300,4),0);
 assert.equal(scope.hwpMixerNearestPage(780,300,4),3);
 assert.equal(scope.hwpMixerNearestPage(3000,300,4),4);
 assert.ok(html.includes("hwpFaderBank(pages,channels,strip,current.name+' channel faders',false"));
});

test("Mixer EQ confirms copy, paste and reset without changing the layout",()=>{
 const start=html.indexOf("const hwpMixerEqIcon"),end=html.indexOf("function HwpMixerCompanionChannelEdit",start);
 assert.ok(start>=0&&end>start);
 const h=(tag,props,...children)=>({tag,props,children});
 let slots=[],cursor=0,timers=new Map(),timerId=0;
 const hooks={useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],x=>{slots[i]=typeof x==="function"?x(slots[i]):x}]},useRef:v=>{const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i]},useEffect:()=>{}};
 const scope=createContext({l:hooks,hwpMixerNode:h,setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id)});
 runInContext(html.slice(start,end),scope);
 let channel={name:"Vocal",eq:scope.hwpMixerEqDefault()};channel.eq.bands[0].gain=4;
 const render=()=>{cursor=0;return scope.HwpMixerEqPanel({channel,onChange:eq=>{channel={...channel,eq}}})};
 function flat(n){return !n||typeof n!=="object"?[]:[n,...(Array.isArray(n.children)?n.children:[n.children]).flatMap(flat)]}
 let view=render();
 const button=label=>flat(view).find(n=>n.tag==="button"&&n.children[0]===label);
 const status=()=>flat(view).find(n=>n.props?.role==="status");
 assert.ok(button("Paste").props.disabled);
 button("Copy").props.onClick();view=render();
 assert.ok(!button("Paste").props.disabled);assert.ok(button("Copy").props.className.includes("hwp-eq-confirmed"));assert.equal(status().children[0].children[0],"✓ EQ copied");
 button("Reset").props.onClick();view=render();
 assert.equal(channel.eq.bands[0].gain,0);assert.equal(status().children[0].children[0],"✓ EQ reset");
 button("Paste").props.onClick();view=render();
 assert.equal(channel.eq.bands[0].gain,4);assert.equal(status().children[0].children[0],"✓ EQ pasted");
 for(const fn of timers.values())fn();view=render();assert.ok(!button("Paste").props.className.includes("hwp-eq-confirmed"));
 assert.ok(html.includes('id="hwp-matte-metal-fader-v1"'));
 assert.ok(!html.includes("Yamaha QL1 · Offline demo"));
});

test("Volume faders reserve thirty percent of travel above unity and keep gain linear",()=>{
 const start=html.indexOf("function hwpMixerDbPosition("),end=html.indexOf("function HwpSoundMixer(",start);
 const h=(tag,props,...children)=>({tag,props,children});
 const scope=createContext({hwpMixerNode:h});
 runInContext(html.slice(start,end),scope);
 for(let v=-80;v<=10;v+=.5)assert.ok(Math.abs(scope.hwpMixerFaderInterpolate(scope.hwpMixerFaderInterpolate(v,0,1),1,0)-v)<1e-8);
 assert.equal(scope.hwpMixerDbPosition(10,-80,10,true),0);
 assert.equal(scope.hwpMixerDbPosition(5,-80,10,true),15);
 assert.equal(scope.hwpMixerDbPosition(0,-80,10,true),30);
 assert.equal(scope.hwpMixerDbPosition(-80,-80,10,true),100);
 assert.equal(scope.hwpMixerDbPosition(0,-10,10),50);
 let level=0;
 const tree=scope.hwpMixerCalibratedFader({min:-80,max:10,step:.5,value:0,volumeScale:true,ticks:[10,5,0,-5,-10,-20,-40,-60,-80],label:"Volume",valueText:"0 dB",onChange:v=>level=v,formatTick:String});
 function flat(n){return !n||typeof n!=="object"?[]:[n,...(Array.isArray(n.children)?n.children:[n.children]).flatMap(flat)]}
 const nodes=flat(tree),input=nodes.find(n=>n.tag==="input"),cap=nodes.find(n=>n.props?.className==="hwp-mixer-calibrated-thumb"),tick=nodes.find(n=>n.tag==="span"&&n.children[0]==="0");
 assert.equal(input.props.value,700);assert.equal(cap.props.style.top,"30%");assert.equal(tick.props.style.top,"30%");
 input.props.onChange({target:{value:"850"}});assert.equal(level,5);
 input.props.onKeyDown({key:"ArrowUp",preventDefault:()=>{}});assert.equal(level,.5);
 input.props.onKeyDown({key:"End",preventDefault:()=>{}});assert.equal(level,10);
 input.props.onDoubleClick();assert.equal(level,0);
});

test('presentation selection and on-output status are distinct and stable for repeated items',()=>{
 const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const start=source.indexOf('function hwpPresentationRowId('),end=source.indexOf('function HwpPresentationLiveBadge(',start);
 const select=Function(source.slice(start,end)+';return hwpServiceSelection')();
 const playlist={hwpScheduleId:'service-a',items:[{id:'one',presentationId:'song'},{id:'two',presentationId:'song'},{id:'three',presentationId:'other'}]};
 const state={session:{activePresentationId:'song',serviceNavId:'two'},live:{slideId:'s',presentationId:'song',hwpScheduleId:'service-a',hwpServiceItemId:'one'}};
 assert.deepEqual(select(state,playlist),{selected:'two',onOutput:'one'});
 assert.deepEqual(select({...state,live:{...state.live,slideId:null}},playlist),{selected:'two',onOutput:null});
 assert.deepEqual(select({...state,live:{...state.live,hwpScheduleId:'service-b'}},playlist),{selected:'two',onOutput:null});
 assert.deepEqual(select({...state,session:{...state.session,serviceHeader:'header'}},playlist),{selected:null,onOutput:'one'});
 assert.match(source,/HwpPresentationLiveBadge,\{live:hwpIsLive\}/);
 assert.match(source,/selection\.selected===item\.id&&`hwp-presentation-selected`/);
 const css=readFileSync(new URL('../hwp-access.css',import.meta.url),'utf8');
 assert.match(css,/\.hwp-presentation-live-slot\s*\{[\s\S]*?flex:0 0 36px/);
 assert.match(css,/\.hwp-presentation-selected[\s\S]*?inset 0 0 0 2px var\(--amber\)/);
});
