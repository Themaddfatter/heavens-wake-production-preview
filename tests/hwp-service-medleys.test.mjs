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
test("center shows all service zones in order and only medleys are indented",()=>{
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

test("service picker shows complete selected name in a native accessible select",()=>{
 assert.ok(html.includes('className:`panel-head hwp-service-picker-head`'));
 assert.ok(html.includes('className:`hwp-service-dropdown`'));
 assert.ok(html.includes('children:serviceOptions.length?serviceOptions.map'));
 assert.ok(html.includes('children:e.name'));
 assert.ok(html.includes('title:i?.name||`No upcoming published services`'));
 assert.ok(html.includes('"aria-label":`Service`'));
 assert.ok(!html.includes('children:[(0,M.jsx)(`span`,{children:`Service`})'));
 assert.ok(css.includes('.library .panel-head.hwp-service-picker-head .hwp-service-dropdown select'));
 assert.ok(css.includes('white-space:normal'));
 assert.ok(css.includes('overflow-wrap:anywhere'));
 assert.ok(css.includes('max-width:none;'));
});
