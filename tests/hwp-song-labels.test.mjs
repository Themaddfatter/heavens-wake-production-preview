import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('function hwpSpanishSongLabel(name){');
const end=html.indexOf('var Ge=',begin);
assert.ok(begin>=0&&end>begin,'song label normalization helpers must be present');
const context=createContext({String,Number,Array,Set,Map,Math});
runInContext(html.slice(begin,end),context);

test('HWP preserves a custom Spanish color and an English counterpart with the same IDs',()=>{
 const rows=[
  {id:'b1',categoryId:'songs',name:'Bridge 1',nameEs:'Puente 1',color:'#997733',spanishColor:'#112244',order:3},
  {id:'b1_es',categoryId:'songs',name:'Puente 1',color:'#eeeeee',language:'es',pairedLabelId:'b1'},
  {id:'r',categoryId:'scripture',name:'Reading',color:'#333333'}
 ];
 const result=context.hwpPairSongLabels(rows);
 assert.equal(result.find(x=>x.id==='b1').spanishColor,'#112244');
 assert.equal(result.find(x=>x.id==='b1_es').color,'#112244');
 assert.equal(result.find(x=>x.id==='b1_es').pairedLabelId,'b1');
 assert.equal(result.find(x=>x.id==='r').color,'#333333');
 const pale=context.hwpPairSongLabels([{...rows[0],spanishColor:''}]);
 assert.equal(pale.find(x=>x.id==='b1_es').color,context.hwpPaleSongColor('#997733'));
});

test('HWP displays all numbered variants together and preserves the shared order',()=>{
 const labels=[
  {id:'b2',name:'Bridge 2',categoryId:'songs',order:2},
  {id:'chorus',name:'Chorus',categoryId:'songs',order:3},
  {id:'b',name:'Bridge',categoryId:'songs',order:0},
  {id:'b1',name:'Bridge 1',categoryId:'songs',order:1},
  {id:'c2',name:'Custom Response 2',categoryId:'songs',order:5},
  {id:'c1',name:'Custom Response 1',categoryId:'songs',order:4}
 ];
 const groups=context.hwpSongLabelGroups(labels);
 assert.deepEqual(Array.from(groups,g=>g.title),['Bridge','Chorus','Custom Response']);
 assert.deepEqual(Array.from(groups[0].items,x=>x.name),['Bridge','Bridge 1','Bridge 2']);
 assert.deepEqual(Array.from(groups[2].items,x=>x.name),['Custom Response 1','Custom Response 2']);
});

test('HWP Song labels save through the same atomic Firebase catalog as HWW',()=>{
 const editor=html.slice(html.indexOf('function HwpPairedLabelsEditor({items})'),html.indexOf('function Ji({kind,items})'));
 assert.match(editor,/action:"saveSongLabel"/);
 assert.match(editor,/operation:"upsert"/);
 assert.match(editor,/operation:"delete"/);
 assert.match(editor,/operation:"reorder"/);
 assert.match(editor,/operation:"moveCategory"/);
 assert.match(editor,/window\.dispatchEvent\(new Event\("hwp-cloud-reload"\)\)/);
 assert.match(editor,/spanishColor:draft\.spanishColor/);
 assert.match(editor,/nameEs:es/);
 assert.match(editor,/hwpSongLabelGroups\(songs\)/);
 assert.match(html,/pollId=window\.setInterval\(\(\)=>\{if\(!document\.hidden\)void load\(\)\},15000\)/);
 assert.match(html,/cat\.id==="standard"\|\|cat\.id==="songs"/);
});

test('Other HWP label categories still use local workspace edits',()=>{
 const editor=html.slice(html.indexOf('function HwpPairedLabelsEditor({items})'),html.indexOf('function Ji({kind,items})'));
 assert.match(editor,/commit\(\[\.\.\.items\.filter/);
 assert.match(editor,/else if\(existing\?\.categoryId==="songs"\)/);
 assert.match(editor,/const updated=\{\.\.\.\(existing\|\|\{\}\)/);
});
