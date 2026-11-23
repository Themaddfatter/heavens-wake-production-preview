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
