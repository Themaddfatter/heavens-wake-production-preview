import {primarySongLabels,resolveSongLabel,serializeSections} from './song-plan.mjs';
import {readSongStructure,songStructureLabel} from './song-structure.js';

export const SONG_UPLOAD_EXTENSIONS='.pro,.txt,.docx,.pdf';
export const MAX_BULK_SONG_FILES=100;

export const normalizedSongTitle=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();

// HWW and HWP share a label catalog. Never silently map an unknown structural
// label to an existing Verse 1, or drop the language implied by an SP suffix.
const songLabelColors={
 verse:'#2f7edb',chorus:'#2f9e6b',bridge:'#e0a106',
 'pre-chorus':'#8b5cf6',intro:'#a8a29e',outro:'#64748b',
 tag:'#d46a2c',vamp:'#6b5fae',hook:'#2f9e6b',
 refrain:'#2f9e6b',drop:'#64748b',interlude:'#14919b'
};
const normalizedLabelName=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g,' ');
export function missingImportedSongLabels(imported,labels=[]){
 const existing=primarySongLabels(labels);
 const known=new Set(existing.map(x=>normalizedLabelName(x.name)));
 const missing=[];
 for(const part of Array.isArray(imported?.sections)?imported.sections:[]){
  // A deliberately assigned shared label is authoritative in existing songs.
  if(part?.labelId&&resolveSongLabel(part,labels))continue;
  const structure=readSongStructure(part?.label||'')||readSongStructure(part?.type||'');
  if(!structure)throw Error('An uploaded song has an unrecognized section label. Correct it before saving.');
  const canonical={...structure,number:String(part?.number||structure.number||'')};
  const name=songStructureLabel(canonical,'en');
  const key=normalizedLabelName(name);
  if(known.has(key))continue;
  // Do not let an unnumbered fallback count as a match for a numbered section.
  const exact=resolveSongLabel({type:canonical.type,number:canonical.number,label:name},labels);
  if(exact&&normalizedLabelName(exact.name)===key){known.add(key);continue}
  const related=existing.find(x=>readSongStructure(x.name)?.type===canonical.type);
  const nameEs=canonical.type==='chorus'?'Coro':songStructureLabel(canonical,'es');
  missing.push({name,nameEs,color:related?.color||songLabelColors[canonical.type]||'#64748b'});
  known.add(key);
 }
 if(missing.length>24)throw Error('This import needs more than 24 new section labels. Review the source file first.');
 return missing;
}


/** One narrowly-scoped repair for the already imported worship song.
 * Do not guess from lyrics or rewrite legitimate English verses.
 * A repair is safe only when the two wrongly labelled sections contain
 * Spanish lyrics exclusively and no correctly labelled counterpart exists.
 * The caller explicitly persists the result; this function is pure.
 */
export function repairThankYouJesusForTheBlood(song){
 const key=normalizedSongTitle(song?.title||song?.titleEs).replace(/[^a-z0-9]+/g,' ').trim();
 if(!/^thank you jesus for the bloo(?:d|k)(?: |$)/.test(key))return null;
 const rows=Array.isArray(song?.sections)?song.sections:[];
 if(rows.length<2)return null;
 const SpanishOnly=part=>Boolean(String(part?.lyricsEs||'').trim())&&!String(part?.lyrics||'').trim();
 const canonical=part=>String(part?.label||'').toLocaleLowerCase().trim().replace(/\s+/g,' ');
 const badChorus=part=>SpanishOnly(part)&&(
  (part.type==='chorus'&&String(part.number||'')==='2'&&canonical(part)!=='chorus 2')||
  (part.type==='verse'&&canonical(part)==='verse 1')
 );
 const badBridge=part=>SpanishOnly(part)&&(
  (part.type==='bridge'&&canonical(part)!=='bridge')||
  (part.type==='verse'&&canonical(part)==='verse 2')
 );
 const c=rows.map((part,i)=>badChorus(part)?i:-1).filter(i=>i>=0);
 const b=rows.map((part,i)=>badBridge(part)?i:-1).filter(i=>i>=0);
 if(c.length!==1||b.length!==1||c[0]===b[0])return null;
 const already=rows.some((part,i)=>i!==c[0]&&i!==b[0]&&
   ((part.type==='chorus'&&String(part.number||'')==='2')||part.type==='bridge')&&SpanishOnly(part));
 if(already)return null;
 return {...song,sections:rows.map((part,i)=>{
  if(i===c[0])return {...part,type:'chorus',number:'2',labelId:'',label:'Chorus 2'};
  if(i===b[0])return {...part,type:'bridge',number:'',labelId:'',label:'Bridge'};
  return {...part};
 })};
}

/** Convert an extracted document to editable sections using the HWP/HWW shared song label catalog. */
export function importedSongDraft(imported,labels=[]){
 const title=String(imported?.title||imported?.titleEs||'').trim();
 if(!title||title.length>200)throw Error('The imported song needs a title of 200 characters or fewer.');
 const source=Array.isArray(imported?.sections)?imported.sections:[];
 if(!source.length)throw Error('No readable lyric sections were found in this song.');
 if(source.length>120)throw Error('This song has more than 120 lyric sections; split it before importing.');
 const sections=source.map((s,i)=>{
  const label=resolveSongLabel(s,labels);
  return {
   id:'section-'+i,
   type:String(s.type||'verse'),number:String(s.number||''),
   labelId:label?.id||String(s.labelId||''),
   label:label?.name||songStructureLabel(s,'en'),
   lyrics:String(s.lyrics||''),lyricsEs:String(s.lyricsEs||'')
  };
 });
 if(!sections.some(s=>s.lyrics.trim()||s.lyricsEs.trim()))throw Error('The imported document has no lyrics.');
 return {id:'',title,sections};
}
/** One guarded write shape for both single-song saving and bulk importing. */
export function songLibraryWrite(data,labels=[],serviceId=''){
 const title=String(data?.title||'').trim();
 const sections=serializeSections(data?.sections,labels);
 if(!title||title.length>200||!sections.length)throw Error('Enter a song title and at least one lyrics section.');
 if(sections.length>120)throw Error('A song may contain no more than 120 lyric sections.');
 const body=sections.filter(s=>s.lyrics).map(s=>s.lyrics).join('\n\n');
 const bodyEs=sections.filter(s=>s.lyricsEs).map(s=>s.lyricsEs).join('\n\n');
 if(body.length>30000||bodyEs.length>30000)throw Error('A song has more than 30,000 characters in one language. Split the lyrics before saving.');
 if(!body&&!bodyEs)throw Error('The song has no lyrics to save.');
 return {
  action:'saveLibrary',serviceId,libraryId:String(data?.id||''),
  title,titleEs:'',sections,body,bodyEs,primaryLanguage:body?'en':'es',
  spanishManual:sections.some(s=>Boolean(s.lyricsEs))
 };
}
