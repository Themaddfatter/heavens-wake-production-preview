// Canonical ordered, bilingual song sections. No automatic lyric translation.
export const SONG_STRUCTURE_OPTIONS=[
 {type:'verse',en:'Verse',es:'Verso',aliases:['verse','verso','estrofa','stanza']},
 {type:'chorus',en:'Chorus',es:'Coro',aliases:['chorus','coro']},
 {type:'bridge',en:'Bridge',es:'Puente',aliases:['bridge','puente']},
 {type:'intro',en:'Intro',es:'Introducción',aliases:['intro','introduction','introduccion','introducción']},
 {type:'outro',en:'Outro',es:'Salida',aliases:['outro','ending','final','salida']},
 {type:'tag',en:'Tag',es:'Cierre',aliases:['tag','cierre']},
 {type:'vamp',en:'Vamp',es:'Vamp',aliases:['vamp']},
 {type:'pre-chorus',en:'Pre-Chorus',es:'Pre-Coro',aliases:['pre-chorus','pre chorus','prechorus','pre-coro','pre coro','precoro']},
 {type:'hook',en:'Hook',es:'Gancho',aliases:['hook','gancho']},
 {type:'refrain',en:'Refrain',es:'Estribillo',aliases:['refrain','estribillo']},
 {type:'drop',en:'Drop',es:'Drop',aliases:['drop','caida','caída']},
 {type:'interlude',en:'Interlude',es:'Interludio',aliases:['interlude','interludio','un intervalo','intervalo']}
];
const known=new Map(SONG_STRUCTURE_OPTIONS.map(option=>[option.type,option]));
const cleaned=value=>String(value||'').replace(/\r\n?/g,'\n').trim();
const plainHeading=value=>cleaned(value)
 .replace(/^#{1,6}\s*/,'').replace(/^<h[1-6][^>]*>|<\/h[1-6]>$/gi,'')
 .replace(/^[\[({*\s]+|[\])}*\s:.-]+$/g,'').replace(/\s+/g,' ').trim();
const fold=value=>plainHeading(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function readSongStructure(value){
 const normalized=fold(value).replace(/[_–—]/g,'-');
 for(const option of SONG_STRUCTURE_OPTIONS){
  for(const alias of option.aliases){
   const a=fold(alias);
   if(normalized===a)return {type:option.type,number:''};
   if(normalized.startsWith(a)){
    const suffix=normalized.slice(a.length);
    const match=suffix.match(/^\s*(?:#\s*)?(\d{1,2}|[ivx]{1,6})?\s*(sp)?\s*$/i);
    if(match)return {type:option.type,number:(match[1]||'').toUpperCase(),language:match[2]?'es':null};
   }
  }
 }
 return null;
}
export function songStructureLabel(section,lang='en'){
 const option=known.get(section?.type)||known.get('verse');
 const number=String(section?.number||'').trim();
 return option[lang==='es'?'es':'en']+(number?' '+number:'');
}
export const newSongSection=(type='verse')=>({
 id:'sec-'+Math.random().toString(36).slice(2,11),
 type:known.has(type)?type:'verse',number:'',lyrics:'',lyricsEs:''
});
export function parseLegacySongSections(body,lang='en'){
 const lines=cleaned(body).split('\n');
 if(lines.length===1&&!lines[0])return [];
 const sections=[];let current=null;
 const flush=()=>{
  if(current&&current[lang==='es'?'lyricsEs':'lyrics'].trim())sections.push(current);
 };
 for(const line of lines){
  const found=readSongStructure(line);
  if(found){
   flush();current={...newSongSection(found.type),number:found.number,explicitStructure:true};
  }else{
   if(!current)current=newSongSection('verse');
   const field=lang==='es'?'lyricsEs':'lyrics';
   current[field]+=(current[field]?'\n':'')+line;
  }
 }
 flush();
 return sections;
}
export function pairSongSections(body,bodyEs){
 const en=parseLegacySongSections(body,'en');
 const es=parseLegacySongSections(bodyEs,'es');
 const merged=en.map(s=>({...s}));
 const used=new Set();
 for(let i=0;i<es.length;i++){
  const section=es[i];
  const match=merged.findIndex((candidate,j)=>!used.has(j)&&
    candidate.type===section.type&&String(candidate.number||'')===String(section.number||''));
  let pos=match;
  // Repeated unnumbered choruses are paired in their original occurrence order.
  // Never pair a clearly labelled Spanish chorus/bridge to an unrelated English
  // verse by position; only truly unlabelled legacy stanzas can use that fallback.
  if(pos<0&&merged[i]&&!used.has(i)&&!merged[i].lyricsEs&&
    !section.explicitStructure&&!merged[i].explicitStructure)pos=i;
  if(pos<0){merged.push({...section});pos=merged.length-1;}
  else merged[pos].lyricsEs=section.lyricsEs;
  used.add(pos);
 }
 return merged;
}
// Keep editor whitespace intact. Trimming here previously swallowed the space bar
// after every word in controlled lyric textareas.
const draftLyrics=value=>String(value??'').replace(/\r\n?/g,'\n');
export function normalizedSongSections(song){
 if(!Array.isArray(song?.sections)||(!song.sections.length&&(song?.body||song?.bodyEs)))return pairSongSections(song?.body,song?.bodyEs);
 return song.sections.slice(0,120).map((part,index)=>{
  const identified=readSongStructure(part?.type||'')||readSongStructure(part?.label||'')||
   (known.has(part?.type)?{type:part.type,number:''}:null);
  return {
   id:String(part?.id||'section-'+index),type:identified?.type||'verse',
   number:String(part?.number??identified?.number??'').trim().slice(0,6),
   lyrics:draftLyrics(part?.lyrics??part?.body??part?.bodyEn),
   lyricsEs:draftLyrics(part?.lyricsEs??part?.bodyEs)
  };
 });
}
// Number repeated labels when displaying or exporting. Never require editors to assign numbers.
// Numbering restarts for each structure type and stays aligned across languages.
export function numberedSongSections(rows){
 const source=Array.isArray(rows)?rows:[];
 const totals=new Map(),seen=new Map();
 for(const part of source){
  const type=known.has(part?.type)?part.type:'verse';
  totals.set(type,(totals.get(type)||0)+1);
 }
 return source.map(part=>{
  const type=known.has(part?.type)?part.type:'verse';
  seen.set(type,(seen.get(type)||0)+1);
  return {...part,type,number:(totals.get(type)||0)>1?String(seen.get(type)):''};
 });
}
export function legacyBodiesFromSections(sections){
 const rows=numberedSongSections(sections);
 return {
  body:rows.filter(x=>cleaned(x.lyrics)).map(x=>songStructureLabel(x,'en')+'\n'+cleaned(x.lyrics)).join('\n\n'),
  bodyEs:rows.filter(x=>cleaned(x.lyricsEs)).map(x=>songStructureLabel(x,'es')+'\n'+cleaned(x.lyricsEs)).join('\n\n')
 };
}
