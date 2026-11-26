import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script, createContext, runInContext} from "node:vm";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match=>match[1]).filter(Boolean);

test("all inline JavaScript compiles before publishing",()=>{
 assert.ok(scripts.length>=3);
 for(const js of scripts)new Script(js);
});
test("account and library startup remain unchanged",()=>{
 const normalizer=html.slice(html.indexOf("function Kt(e){"),html.indexOf("function Kt(e){")+4000);
 assert.ok(normalizer.includes("t.presentations.map"),"existing normalizer still available");
 assert.ok(!normalizer.includes("hwpDecorateBibleSlide"),"do not modify saved slides during startup");
 assert.ok(html.includes("function HwpAccessGate({mode})"));
 assert.ok(html.includes("hwpCloudBoot().then(sys=>"));
});
const head=html.indexOf("function hwpBibleAbbreviation(value)");
const tail=html.indexOf("function de(e,t=24,n=24)",head);
assert.ok(head>0&&tail>head,"Scripture helpers must follow existing design functions");
const source=html.slice(head,tail);
const vm=createContext({D:obj=>obj,E:obj=>obj,Set,Array,Number,String,Math});
runInContext(source,vm);
const {hwpBibleAbbreviation:abbr,hwpBibleTranslationTagId:tagId,
       hwpDecorateBibleSlide:decorate,hwpDefineBibleTranslationTags:defineTags}=vm;
const slide=(translation,id="verse-1")=>({id,
 scripture:{book:"John",chapter:3,verses:[16],translation},
 tags:["custom-tag"],objects:[{id:"lyrics",binding:"lyrics",text:"For God so loved..."}]});
const defaults={translationBadgeVisible:true,translationBadgeSize:42,translationBadgePosition:"top-right"};

test("every translation has its own abbreviation tag, white background and black text",()=>{
 for(const version of ["KJV","NKJV","NIV","NLT","ESV","RVR1909","RVR1960"]){
  const enriched=decorate(slide(version),defaults,1920,1080);
  assert.equal(abbr(version),version);
  assert.ok(enriched.tags.includes(tagId(version)));
  assert.ok(enriched.tags.includes("custom-tag"),"preserve manual tags");
  const badge=enriched.objects.find(o=>o.binding==="hwpBibleTranslationBadge");
  assert.equal(badge.text,version);
  assert.equal(badge.fill.color,"#ffffff");
  assert.equal(badge.textStyle.color,"#000000");
  assert.equal(badge.locked,true);
  const definitions=defineTags([{id:"custom-tag",name:"Other",color:"#00ff00"}],[enriched]);
  const tag=definitions.find(o=>o.id===tagId(version));
  assert.equal(tag.name,version);
  assert.equal(tag.color,"#ffffff");
 }
});
test("translations remain separate on their respective Scripture slides",()=>{
 const original=["KJV","ESV","NIV"].map((v,i)=>slide(v,"verse-"+i));
 const output=original.map(s=>decorate(s,defaults,1920,1080));
 assert.deepEqual(Array.from(output,s=>s.scripture.translation),["KJV","ESV","NIV"]);
 assert.deepEqual(Array.from(output,s=>s.tags.at(-1)),["hwp_bible_translation_KJV","hwp_bible_translation_ESV","hwp_bible_translation_NIV"]);
});
test("re-applying tag styles never duplicates badges or tags",()=>{
 let s=slide("RVR1960");
 for(let i=0;i<4;i++)s=decorate(s,defaults,1920,1080);
 assert.equal(s.objects.filter(o=>o.binding==="hwpBibleTranslationBadge").length,1);
 assert.equal(s.tags.filter(t=>t.startsWith("hwp_bible_translation_")).length,1);
 const afterChange=decorate(s,{...defaults,translationBadgePosition:"bottom-left",translationBadgeSize:60},1920,1080);
 assert.equal(afterChange.objects.filter(o=>o.binding==="hwpBibleTranslationBadge").length,1);
 assert.ok(afterChange.objects.find(o=>o.binding==="hwpBibleTranslationBadge").y>500);
 assert.ok(afterChange.objects.find(o=>o.binding==="hwpBibleTranslationBadge").x<150);
});
test("turning badge visibility off preserves the actual translation tag",()=>{
 const enriched=decorate(slide("KJV"),{...defaults,translationBadgeVisible:false},1920,1080);
 assert.ok(enriched.tags.includes("hwp_bible_translation_KJV"));
 assert.equal(enriched.objects.filter(o=>o.binding==="hwpBibleTranslationBadge").length,0);
});
test("existing untagged slides and unrelated objects are not altered unless explicitly decorated",()=>{
 const ordinary={id:"text",objects:[{id:"one",binding:"lyrics"}],tags:["original"]};
 assert.equal(decorate(ordinary,defaults),ordinary);
 const existing=slide("ESV");
 const processed=decorate(existing,defaults);
 assert.equal(existing.objects.length,1,"inputs remain immutable");
 assert.equal(processed.objects[0],existing.objects[0],"preserve existing text object");
 const tags=defineTags([{id:tagId("ESV"),name:"Custom",color:"#333333"}],[processed]);
 assert.equal(tags.find(x=>x.id===tagId("ESV")).color,"#ffffff");
});
test("divider headings follow the same first/next group pattern as song headings",()=>{
 const start=html.indexOf("function hwpScriptureTranslationStart(");
 const end=html.indexOf("function Wi({cue:e",start);
 assert.ok(start>0&&end>start);
 runInContext(html.slice(start,end),vm);
 const group=[{slide:{id:"a",scripture:{translation:"KJV"}}},
              {slide:{id:"b",scripture:{translation:"KJV"}}},
              {slide:{id:"c",scripture:{translation:"ESV"}}}];
 const p={category:"scripture",translations:["KJV","ESV"]};
 assert.equal(vm.hwpScriptureTranslationStart(p,group,group[0],{}).version,"KJV");
 assert.equal(vm.hwpScriptureTranslationStart(p,group,group[0],{}).first,true);
 assert.equal(vm.hwpScriptureTranslationStart(p,group,group[1],{}),null);
 assert.equal(vm.hwpScriptureTranslationStart(p,group,group[2],{}).version,"ESV");
 assert.equal(vm.hwpScriptureTranslationStart(p,group,group[2],{}).first,false);
 assert.equal(vm.hwpScriptureTranslationStart(p,group,group[2],{translationDividers:false}),null);
 assert.equal(vm.hwpScriptureTranslationStart({category:"song"},group,group[2],{}),null);
});
test("Bible creation, settings controls and import still use the existing translation engine",()=>{
 assert.ok(html.includes("function HwpBibleTranslationDialog({available,onChoose,onClose,busy,error,viewTranslation,defaultCount=1})"));
 assert.ok(html.includes("defaultCount:e.doc.settings.bible.defaultTranslationCount||1"));
 assert.ok(html.includes("translationSets,perSlide:e.session.versesPerSlide"));
 assert.ok(html.includes('scriptureSets.map(block=>hwpBibleAbbreviation(block.translation)).join(" / ")'));
 assert.ok(html.includes("hwpDefineBibleTranslationTags(e.doc.tags,s)"));
 assert.ok(html.includes('case'+String.fromCharCode(96)+'hwp-sync-bible-styles'+String.fromCharCode(96)));
 assert.ok(html.includes("Apply translation tags and badges to existing Scripture slides"));
});


test("ordinary Bible screen has directly usable multi-translation selection",()=>{
 assert.ok(html.includes('function HwpBibleInlineTranslationPicker('));
 assert.ok(html.includes('"Number of Bible translations"'));
 assert.ok(html.includes('"Bible translation "+(index+1)'));
 assert.ok(html.includes('onCreate:versions=>y(versions)'));
 assert.equal(html.includes('children:"More translation choices"'),false);
 assert.equal(html.includes("Click a verse, then shift-click to extend the range."),false);
 assert.equal(html.includes("Choose up to four translations. Each will be grouped on separate slides with its own heading and abbreviation tag."),false);
 const available=[{id:"KJV"},{id:"ESV"},{id:"NIV"},{id:"RVR1960"}];
 const chosen=vm.hwpBibleChosenTranslations(available,["ESV","ESV","NIV","RVR1960"],4);
 assert.deepEqual(Array.from(chosen),["ESV","KJV","NIV","RVR1960"]);
 assert.deepEqual(Array.from(vm.hwpBibleChosenTranslations(available,["KJV"],2)),["KJV","ESV"]);
});

test("old Scripture slides visibly receive badges without mutating saved data",()=>{
 const old=slide("NIV","legacy-bible-slide");
 assert.equal(old.objects.length,1);
 const projected={key:old.id,width:1920,height:1080,background:{type:"none"},objects:old.objects.slice()};
 const displayed=vm.hwpBibleDisplaySlide(projected,old,defaults);
 assert.equal(displayed.objects.length,2);
 assert.equal(displayed.objects.at(-1).text,"NIV");
 assert.equal(displayed.objects.at(-1).fill.color,"#ffffff");
 assert.equal(displayed.objects.at(-1).textStyle.color,"#000000");
 assert.equal(old.objects.length,1,"stored library must remain untouched");
 assert.equal(projected.objects.length,1,"projection input must remain untouched");
 const hidden=vm.hwpBibleDisplaySlide(projected,old,{...defaults,translationBadgeVisible:false});
 assert.equal(hidden.objects.length,1);
 const nonBible={id:"song",objects:[{id:"lyrics"}]};
 assert.equal(vm.hwpBibleDisplaySlide(projected,nonBible,defaults),projected);
 assert.ok(html.includes("hwpBibleDisplaySlide(De(r,c.slide"));
 assert.ok(html.includes("hwpBibleVisibleObjects(e.slide,i.doc.settings.bible,o.width,o.height)"));
});

test("scripture labels follow current HWP label settings, never obsolete Reading defaults",()=>{
 const start=html.indexOf("function hwpScriptureConfiguredLabel(doc){");
 const end=html.indexOf("var Ge=[[",start);
 assert.ok(start>=0&&end>start,"configured scripture label resolver exists");
 const labelContext=createContext({
  Ge:[],
  le:()=>"#c4a574",
  hwpCategoryForLabel:name=>String(name).toLowerCase()==="scripture"?"scripture":"standard"
 });
 runInContext(html.slice(start,end),labelContext);
 const labels=[
  {id:"old-reading",name:"Reading",color:"#bbbbbb",categoryId:"scripture"},
  {id:"scripture-label",name:"Scripture",color:"#ca9f55",categoryId:"scripture"},
  {id:"passage",name:"Passage",color:"#33aacc",categoryId:"scripture"}
 ];
 const doc=chosen=>({labels,settings:{appearance:{slideDefaults:{scripture:chosen}}}});
 const outdated=labelContext.hwpScriptureConfiguredLabel(doc("Reading"));
 assert.equal(outdated.name,"Scripture");
 assert.equal(outdated.id,"scripture-label");
 assert.equal(outdated.color,"#ca9f55");
 assert.equal(labelContext.hwpScriptureConfiguredLabel(doc("Passage")).name,"Passage");
 const deleted=labelContext.hwpScriptureConfiguredLabel({labels:labels.filter(label=>label.name!=="Reading"),settings:{appearance:{slideDefaults:{scripture:"Reading"}}}});
 assert.equal(deleted.name,"Scripture");
 assert.ok(html.includes("labelId:hwpScriptureConfiguredLabel(e.doc).id"),"new scripture groups link to configured label");
 assert.ok(html.includes("group.name===`Reading`?defaultLabel:null"),"legacy Reading groups migrate");
 assert.ok(html.includes("[`scripture`,`Scripture`,`Scripture`]"),"settings never suggest Reading by default");
});

test("audience and stage output hide translation badges while retaining saved edit tags",()=>{
 const start=html.indexOf("function hwpOutputWithoutTranslationTag(model){");
 const end=html.indexOf("function Oe(e){",start);
 assert.ok(start>0&&end>start);
 const scope=createContext({});
 runInContext(html.slice(start,end),scope);
 const saved={key:"slide-1",tags:["hwp_bible_translation_KJV","custom-tag"],objects:[
  {id:"hwp_bible_badge_123",binding:"hwpBibleTranslationBadge",text:"KJV"},
  {id:"verse-text",binding:"lyrics",text:"A Bible verse"}
 ]};
 const projected=scope.hwpOutputWithoutTranslationTag(saved);
 assert.deepEqual(Array.from(projected.objects,o=>o.id),["verse-text"]);
 assert.equal(saved.objects.length,2,"saved presentation remains untouched");
 assert.equal(saved.tags.length,2,"editing tags remain intact");
 assert.ok(html.includes("hwpOutputWithoutTranslationTag(hwpBibleDisplaySlide"),"both current and next output slides must filter badges");
});

test("slide editor media-fit choices reach correctly sized image and video output frames",()=>{
 const start=html.indexOf("function Pn({item:e,playing:t,quality:n})");
 const end=html.indexOf("function Fn({preset:e,playing:t})",start);
 assert.ok(start>0&&end>start,"media renderer is present");
 const scope=createContext({
  M:{jsx:(tag,props)=>({tag,props})},
  Ve:src=>src,jn:src=>src,Nn:()=>false
 });
 runInContext(html.slice(start,end),scope);
 for(const kind of ["image","video"]){
  const node=scope.Pn({item:{id:"test",src:"blob:example",kind},playing:false,quality:"draft"});
  assert.equal(node.tag,kind==="image"?"img":"video");
  assert.equal(node.props.style.width,"100%");
  assert.equal(node.props.style.height,"100%");
  assert.equal(node.props.style.position,"absolute");
  assert.equal(node.props.style.objectFit,"var(--media-fit, cover)");
  assert.equal(node.props.style.objectPosition,"var(--media-position, center)");
 }
 for(const choice of ["cover","contain","fill","none","scale-down"]){
  assert.ok(html.includes('["'+choice+'",'),choice+" remains in the media fit selector");
 }
 assert.ok(html.includes('onChange:e=>patch("fit",e.target.value)'));
 assert.ok(html.includes('onChange:e=>patch({mediaFit:e.target.value})'));
});
test("logo output obeys configured dissolve while retaining cached media and image/video prewarm",()=>{
 assert.ok(!html.includes('outMs:e.logoOn?0:c,inMs:e.logoOn?0:l'));
 assert.ok(html.includes('outMs:c,inMs:l,render:n=>n.hwpOverlay'));
 assert.ok(html.includes('const hwpResolvedLocalMedia=new Map()'));
 assert.ok(html.includes('function hwpFastResolve(src)')); assert.ok(html.includes('hwpLocalMediaUrl(src)'));
 assert.ok(html.includes('const hwpFastMediaUrls=new Map()'));
 assert.ok(html.includes('function HwpLogoPrewarm({media})'));
 assert.ok(html.includes('preload:"auto",muted:true,playsInline:true'));
 assert.ok(html.includes('loading:"eager",decoding:"async"'));
 assert.ok(html.includes('<link rel="preload" as="image" href="./hwp-logo.png"/>'));
});
test("slide edit right click has main slide view copy paste delete label tag and template operations",()=>{
 const menu=html.slice(html.indexOf('function HwpEditorSlideContextMenu('),html.indexOf('function gr(){',html.indexOf('function HwpEditorSlideContextMenu(')));
 assert.ok(menu.length>1500);
 for(const action of ['Duplicate slide','Copy slide','Paste slide','Delete slide','Edit','Templates','Label','Tag','Translation']){
  assert.ok(menu.includes(action),"missing menu action "+action);
 }
 for(const action of ['type:"paste-slide"','type:"set-slide-label"','type:"set-slide-tags"','type:"apply-theme"','type:"bulk-delete-selected-slides"']){
  assert.ok(menu.includes(action),"missing dispatched slide action "+action);
 }
 const film=html.slice(html.indexOf('function gr(){'),html.indexOf('function Er(){',html.indexOf('function gr(){')));
 assert.ok(film.includes('onContextMenu:event=>{event.preventDefault();event.stopPropagation();'));
 assert.ok(film.includes('setFilmMenu({slideId:i.id,x:event.clientX,y:event.clientY})'));
 assert.ok(film.includes('filmMenu&&(0,M.jsx)(HwpEditorSlideContextMenu'));
});


test("multi-select context actions preserve selected targets and batch undo",()=>{
 const start=html.indexOf("function hwpBatch("),end=html.indexOf("function qt(e,t){switch(t.type)",start);
 assert.ok(start>0&&end>start);
 const scope=createContext({});
 runInContext(html.slice(start,end),scope);
 assert.deepEqual(Array.from(scope.hwpContextSelection(["a","b"],"b")),["a","b"]);
 assert.deepEqual(Array.from(scope.hwpContextSelection(["a","b"],"c")),["c"]);
 assert.deepEqual(Array.from(scope.hwpContextToggle(["a"],"c",["a","b","c"],{shiftKey:true})),["a","b","c"]);
 assert.deepEqual(Array.from(scope.hwpContextToggle(["a","b"],"b",["a","b","c"],{metaKey:true})),["a"]);
 let action;scope.hwpBatch(a=>action=a,[{type:"delete-presentation",id:"a"},{type:"delete-presentation",id:"b"}]);
 assert.equal(action.history,"push");
 assert.deepEqual(Array.from(action.actions,a=>a.id),["a","b"]);
 const reducerStart=html.indexOf('case"hwp-batch-context":',end);
 const reducerEnd=html.indexOf('case"hwp-slide-menu-color":',reducerStart);
 const deletionStart=html.indexOf('case'+String.fromCharCode(96)+'delete-presentation'+String.fromCharCode(96)+':',reducerEnd);
 const deletionEnd=html.indexOf('case'+String.fromCharCode(96)+'duplicate-presentation'+String.fromCharCode(96)+':',deletionStart);
 const reducer=createContext({hwpServiceOrganize:items=>items});
 runInContext('function qt(e,t){switch(t.type){'+html.slice(reducerStart,reducerEnd)+html.slice(deletionStart,deletionEnd)+'default:return e}}',reducer);
 const state={doc:{presentations:[{id:"a"},{id:"b"},{id:"keep"}],playlists:[{items:[{id:"ra",presentationId:"a"},{id:"rb",presentationId:"b"},{id:"rk",presentationId:"keep"}]}]},session:{activePresentationId:"a",selectedSlideIds:[]},live:{presentationId:"b",slideId:"s",cueIndex:0}};
 const result=reducer.qt(state,action);
 assert.deepEqual(Array.from(result.doc.presentations,p=>p.id),["keep"]);
 assert.deepEqual(Array.from(result.doc.playlists[0].items,row=>row.id),["rk"]);
 assert.equal(result.live.presentationId,null);
 assert.equal(state.doc.presentations.length,3);
 assert.ok(html.includes('hwpPresentationClipboard=selectedPresentationRows().map'));
 assert.ok(html.includes('hwpSlideBatchOptions')||html.includes('HwpSlideBatchOptions'));
 assert.ok(html.includes('hwpContextToggle(e.session.selectedSlideIds,i.id,hwpEditorOrderedSlides'));
});
