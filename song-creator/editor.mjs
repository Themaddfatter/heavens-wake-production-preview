import {serializeSections,resolveSongLabel,sectionLabelTitle,newLabeledSection,primarySongLabels} from './song-plan.mjs';
import {extractSongFile,parseSongLyricsText} from './song-import.js';
import {SONG_UPLOAD_EXTENSIONS,MAX_BULK_SONG_FILES,normalizedSongTitle,importedSongDraft,missingImportedSongLabels,songLibraryWrite} from './song-import-adapter.mjs';
const errorText=e=>String(e?.message||e).replace(/^Firebase:\s*/,'');
const bilingual=(item,labels)=>item.name+' / '+(labels.find(x=>x.pairedLabelId===item.id&&x.language==='es')?.name||item.nameEs||String(item.name||'').replace(/^Pre-Chorus/i,'Pre-Coro').replace(/^Verse/i,'Verso').replace(/^Chorus/i,'Coro').replace(/^Bridge/i,'Puente').replace(/^Intro$/i,'Introducción').replace(/^Outro$/i,'Salida').replace(/^Ending$/i,'Final').replace(/^Tag$/i,'Cierre').replace(/^Turnaround$/i,'Interludio'));

const quickLabelFold=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const quickLabelPairs=[['Verse','Verso'],['Chorus','Coro'],['Bridge','Puente'],['Pre-Chorus','Pre-Coro'],['Intro','Introducción'],['Outro','Salida'],['Tag','Cierre'],['Ending','Final'],['Turnaround','Transición'],['Instrumental','Instrumental'],['Vamp','Vamp'],['Hook','Gancho'],['Refrain','Estribillo'],['Interlude','Interludio'],['Drop','Drop'],['Repeat','Repetición'],['Break','Pausa'],['Spoken','Hablado'],['Solo','Solo'],['Reprise','Repetición'],['Response','Respuesta'],['Prayer','Oración'],['Worship','Adoración'],['Praise','Alabanza'],['Ad Lib','Improvisación'],['Build','Crescendo']];
async function quickSongLabelPair(value,language='auto',fallback='en'){
 const name=String(value||'').trim().replace(/\s+/g,' ');
 if(!name||name.length>100)throw Error('Enter a label name of 1–100 characters.');
 const number=name.match(/\s*(\d+)$/),suffix=number?' '+number[1]:'',base=number?name.slice(0,number.index).trim():name;
 const folded=quickLabelFold(base);
 for(const [en,es] of quickLabelPairs){
  if((language!=='es'&&folded===quickLabelFold(en))||(language!=='en'&&folded===quickLabelFold(es))||(language!=='en'&&['estrofa','precoro','intervalo'].includes(folded)&&({estrofa:'Verse',precoro:'Pre-Chorus',intervalo:'Interlude'})[folded]===en))return {name:en+suffix,nameEs:es+suffix};
 }
 let source=language;
 if(source==='auto'){
  source=/[ñáéíóúü¿¡]/i.test(base)||/\b(?:de|del|la|las|los|estrofa|coro|puente|verso|parte|seccion|entrada|salida|oracion|alabanza|adoracion|final|repeticion|respuesta|acorde|suave|fuerte|lento|rapido|musica|cantado|segunda|primera|principal|doble|estribillo|interludio)\b/i.test(folded)?'es':fallback;
  try{
   const detector=globalThis.LanguageDetector;
   if(detector&&await detector.availability()==='available'){
    const instance=await detector.create({expectedInputLanguages:['en','es']});
    const [result]=await instance.detect(base);instance.destroy();
    if(['en','es'].includes(result?.detectedLanguage)&&result.confidence>=0.55)source=result.detectedLanguage;
   }
  }catch{}
 }
 const target=source==='es'?'en':'es';
 // Use the same translation provider as Ministry Connect. Only the public label name is sent.
 const url=new URL('https://api.mymemory.translated.net/get');
 url.searchParams.set('q',base);url.searchParams.set('langpair',source+'|'+target);
 let response,data;
 try{response=await fetch(url.toString(),{signal:AbortSignal.timeout(15000)});data=await response.json()}catch{throw Error('Could not reach automatic translation. Try again.')}
 const translated=String(data?.responseData?.translatedText||'').trim();
 if(!response.ok||Number(data?.responseStatus)!==200||data?.quotaFinished||!translated||translated.length+suffix.length>100)throw Error('Automatic translation is unavailable. The label was not saved.');
 const decode=document.createElement('textarea');decode.innerHTML=translated;
 const other=decode.value.trim().replace(/\s+/g,' ')+suffix;
 return source==='es'?{name:other,nameEs:name}:{name,nameEs:other};
}
async function saveQuickSongLabel(call,value,color,language,fallback){
 const pair=await quickSongLabelPair(value,language,fallback);
 const fresh=await call({action:'labelCatalog'});
 if(!Array.isArray(fresh?.labels))throw Error('Could not verify the shared label catalog.');
 const rows=fresh.labels.filter(x=>x.categoryId==='songs');
 if(rows.some(x=>[pair.name,pair.nameEs].some(n=>quickLabelFold(n)===quickLabelFold(x.name))))throw Error('That song label already exists. Choose it from the label dropdown.');
 const result=await call({action:'saveSongLabel',operation:'upsert',label:{id:'',...pair,color,spanishColor:''}});
 if(result?.pending||result?.saved!==true||!Array.isArray(result?.labels))throw Error('The shared label was not saved. Try again.');
 const labels=result.labels.filter(x=>x.categoryId==='songs');
 if(!labels.some(x=>x.id===result.id&&x.language!=='es')||!labels.some(x=>x.pairedLabelId===result.id&&x.language==='es'))throw Error('The bilingual label pair could not be verified. Refresh labels.');
 return {labels,pair};
}

export function createSongEditor({jsx:h,jsxs:hs,useState,useEffect,boot,icon}){
 return function HwpSongEditor({onClose,onSaved}){
  const [labels,setLabels]=useState([]),[draft,setDraft]=useState({id:'',title:'',sections:[]}),[ready,setReady]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[paste,setPaste]=useState(false),[pasted,setPasted]=useState(''),[progress,setProgress]=useState('');
  const [labelOpen,setLabelOpen]=useState(false),[labelName,setLabelName]=useState(''),[labelColor,setLabelColor]=useState('#5179bf'),[labelLanguage,setLabelLanguage]=useState('auto'),[labelError,setLabelError]=useState('');
  const call=async data=>{const system=await boot();if(!system.auth.firebaseAuth.currentUser)throw Error('Sign in to HWP before creating a shared song.');return system.auth.songLibrary(data)};
  const catalog=async()=>{const result=await call({action:'labelCatalog'});if(!Array.isArray(result?.labels))throw Error('Shared song labels are unavailable.');return result.labels.filter(x=>x.categoryId==='songs')};
  async function load(){setError('');setBusy('Loading labels…');try{const items=await catalog();setLabels(items);setDraft(old=>({...old,sections:old.sections.length?old.sections:[newLabeledSection('verse',items)]}));setReady(true)}catch(e){setError(errorText(e))}finally{setBusy('')}}
  useEffect(()=>{void load()},[]);
  const ensureLabels=async parsed=>{let items=await catalog();for(const label of missingImportedSongLabels(parsed,items)){const result=await call({action:'saveSongLabel',operation:'upsert',label:{id:'',...label}});if(result?.pending||!Array.isArray(result?.labels))throw Error('Could not create bilingual label '+label.name+'. Song not saved.');items=result.labels.filter(x=>x.categoryId==='songs')}setLabels(items);return items};
  const patch=(i,x)=>setDraft(old=>({...old,sections:old.sections.map((part,j)=>j===i?{...part,...x}:part)}));
  const confirmReplace=()=>!(draft.title.trim()||draft.sections.some(x=>x.lyrics?.trim()||x.lyricsEs?.trim()))||window.confirm('Replace the title and lyrics in the editor? Nothing will be saved until you select Save.');
  const importOne=async file=>{if(!file||busy||!confirmReplace())return;setBusy('Importing song…');setError('');setNotice('');try{const parsed=await extractSongFile(file),items=await ensureLabels(parsed);setDraft(importedSongDraft(parsed,items));setNotice('Song loaded. Review its labels and English/Spanish lyrics, then save.')}catch(e){setError(errorText(e))}finally{setBusy('')}};
  const importPaste=async()=>{if(busy||!pasted.trim())return;if(!confirmReplace())return;setBusy('Importing lyrics…');setError('');setNotice('');try{const parsed=parseSongLyricsText(pasted,draft.title.trim()?draft.title.trim()+'.txt':'Pasted Song.txt'),items=await ensureLabels(parsed),next=importedSongDraft(parsed,items);setDraft({...next,title:next.title==='Pasted Song'?'':next.title});setPaste(false);setPasted('');setNotice('Pasted lyrics loaded. Review the title, labels, and bilingual lyrics, then save.')}catch(e){setError(errorText(e))}finally{setBusy('')}};
  async function saveSong(data,items){const result=await call(songLibraryWrite(data,items,''));if(result?.pending||result?.saved===false||result?.success===false)throw Error('The shared song could not be saved.');return result}
  const save=async()=>{if(busy)return;setBusy('Saving…');setError('');try{if(!draft.title.trim())throw Error('Add a song title and at least one lyrics section.');const items=await ensureLabels(draft),sections=serializeSections(draft.sections,items);await saveSong({...draft,sections},items);onSaved();onClose()}catch(e){setError(errorText(e))}finally{setBusy('')}};
  const bulk=async files=>{if(busy||!files.length)return;if(files.length>MAX_BULK_SONG_FILES){setError('Select no more than 100 song files at a time.');return}setBusy('Importing songs…');setProgress('0 / '+files.length);setError('');setNotice('');let saved=0,skipped=0;const failures=[];try{const library=await call({action:'library'});if(!Array.isArray(library?.songs))throw Error('Could not verify existing song titles.');const existing=new Set(library.songs.map(x=>normalizedSongTitle(x.title||x.titleEs)));for(let i=0;i<files.length;i++){try{const parsed=await extractSongFile(files[i]),key=normalizedSongTitle(parsed.title||parsed.titleEs);if(existing.has(key)){skipped++}else{const items=await ensureLabels(parsed);await saveSong(importedSongDraft(parsed,items),items);existing.add(key);saved++}}catch(e){failures.push(files[i].name+': '+errorText(e))}setProgress((i+1)+' / '+files.length)}if(saved)onSaved();setNotice(saved+' saved · '+skipped+' existing titles skipped');if(failures.length)setError(failures.join('\n'))}catch(e){setError(errorText(e))}finally{setBusy('');setProgress('')}};
  const openLabel=()=>{setLabelName('');setLabelColor('#5179bf');setLabelLanguage('auto');setLabelError('');setLabelOpen(true)};
  const saveLabel=async()=>{if(busy)return;setBusy('Creating label…');setLabelError('');try{const result=await saveQuickSongLabel(call,labelName,labelColor,labelLanguage,'en');setLabels(result.labels);setLabelOpen(false);setNotice('Label saved: '+result.pair.name+' / '+result.pair.nameEs);onSaved()}catch(e){setLabelError(errorText(e))}finally{setBusy('')}};
  const button=(label,onClick,primary=false,disabled=false)=>h('button',{type:'button',className:'btn'+(primary?' primary':''),onClick,disabled,children:label});
  const label=(title,child)=>hs('label',{className:'hwp-song-field',children:[h('span',{children:title}),child]});
  const textInput=(value,onChange,props={})=>h('input',{type:'text',value,onChange:e=>onChange(e.target.value),...props});
  const textarea=(value,onChange,props={})=>h('textarea',{value,onChange:e=>onChange(e.target.value),rows:4,...props});
  const close=()=>{if(!busy)onClose()};
  return h('div',{className:'hwp-song-back',onMouseDown:e=>{e.stopPropagation();if(e.target===e.currentTarget)close()},children:hs('section',{className:'hwp-song-dialog',role:'dialog','aria-modal':true,'aria-label':'Create Song',onMouseDown:e=>e.stopPropagation(),children:[
   hs('header',{children:[h('h2',{children:'Create Song'}),h('button',{type:'button',className:'iconbtn','aria-label':'Close song creator',disabled:!!busy,onClick:close,children:'×'})]}),
   hs('div',{className:'hwp-song-body',children:[
    hs('div',{className:'hwp-song-actions',children:[hs('label',{className:'btn hwp-song-upload',children:[h('span',{children:'Upload Songs'}),h('input',{type:'file',multiple:true,accept:SONG_UPLOAD_EXTENSIONS,disabled:!ready||!!busy,'aria-label':'Upload one or multiple song files',onChange:e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(files.length===1)void importOne(files[0]);else if(files.length>1)void bulk(files)}})]}),button('Paste song lyrics',()=>setPaste(v=>!v),false,!ready||!!busy),button('+ Create Label',openLabel,false,!ready||!!busy)]}),
    h('p',{className:'hwp-song-help',children:'Select one file to review before saving, or select multiple files to import and save separately. Supports .pro, .txt, .docx and text-based .pdf. Existing titles are skipped during bulk import.'}),
    paste&&hs('div',{className:'hwp-song-paste',children:[label('Paste title, labels and lyrics',textarea(pasted,setPasted,{rows:9,placeholder:'Title: Song Name\nEnglish\nVerse 1\nFirst lyrics line\nChorus\nChorus lyrics\nSpanish\nVerso 1\nPrimera línea'})),h('p',{className:'hwp-song-help',children:'Section labels create editable slides. English and Spanish lyrics remain separate.'}),hs('div',{className:'hwp-song-actions',children:[button('Cancel',()=>setPaste(false),false,!!busy),button('Import into editor',importPaste,true,!!busy||!pasted.trim())]})]}),
    notice&&h('p',{className:'hwp-song-notice',role:'status',children:notice}),
    label('Song title',textInput(draft.title,title=>setDraft(old=>({...old,title})),{maxLength:200,disabled:!!busy})),
    h('p',{className:'hwp-song-help',children:'Lyrics stay exactly as written. Lyrics are not automatically translated.'}),
    ...draft.sections.map((part,i)=>hs('section',{className:'hwp-song-section',children:[hs('div',{className:'hwp-song-section-head',children:[h('strong',{children:sectionLabelTitle(part,labels,'en')}),h('button',{type:'button',className:'iconbtn',title:'Remove section','aria-label':'Remove section',disabled:!!busy,onClick:()=>setDraft(old=>({...old,sections:old.sections.filter((_,j)=>j!==i)})),children:h(icon,{name:'trash',size:16})})]}),label('Label',hs('select',{value:resolveSongLabel(part,labels)?.id||'',disabled:!!busy,onChange:e=>{const choice=primarySongLabels(labels).find(x=>x.id===e.target.value);patch(i,{labelId:choice?.id||'',label:choice?.name||'',type:part.type||'verse'})},children:[h('option',{value:'',disabled:true,children:part.label||'Choose label'}),...primarySongLabels(labels).map(item=>h('option',{value:item.id,children:bilingual(item,labels)},item.id))]})),hs('div',{className:'hwp-song-cols',children:[label('English lyrics',textarea(part.lyrics||'',lyrics=>patch(i,{lyrics}),{disabled:!!busy})),label('Spanish lyrics',textarea(part.lyricsEs||'',lyricsEs=>patch(i,{lyricsEs}),{disabled:!!busy}))]})]},i)),
    button('+ Add labeled slide',()=>setDraft(old=>({...old,sections:[...old.sections,newLabeledSection('verse',labels)]})),false,!ready||!!busy),
    !ready&&!busy&&button('Retry loading shared labels',load),error&&h('p',{className:'hwp-song-error',role:'alert',children:error})
   ]}),
   labelOpen&&h('div',{className:'hwp-song-back',style:{zIndex:10060},onMouseDown:e=>{e.stopPropagation();if(e.target===e.currentTarget&&!busy)setLabelOpen(false)},children:hs('section',{className:'hwp-song-dialog',style:{width:'min(420px,100%)'},role:'dialog','aria-modal':true,'aria-label':'Create song label',onMouseDown:e=>e.stopPropagation(),onKeyDown:e=>{if(e.key==='Escape'){e.stopPropagation();if(!busy)setLabelOpen(false)}},children:[
    hs('header',{children:[h('h2',{children:'Create Label'}),button('×',()=>setLabelOpen(false),false,!!busy)]}),
    hs('div',{className:'hwp-song-body',children:[label('Label name',textInput(labelName,setLabelName,{autoFocus:true,maxLength:100,disabled:!!busy,placeholder:'English or Spanish'})),label('Name language',hs('select',{value:labelLanguage,disabled:!!busy,onChange:e=>setLabelLanguage(e.target.value),children:[h('option',{value:'auto',children:'Auto-detect'}),h('option',{value:'en',children:'English'}),h('option',{value:'es',children:'Spanish'})]})),label('Label color',h('input',{type:'color',value:labelColor,disabled:!!busy,onChange:e=>setLabelColor(e.target.value),style:{width:64,height:38,padding:3}})),h('p',{className:'hwp-song-help',children:'English will be the main label. Spanish uses the matching pale color. Both apps receive the same label immediately after saving.'}),labelError&&h('p',{className:'hwp-song-error',role:'alert',children:labelError})]}),
    hs('footer',{children:[button('Cancel',()=>setLabelOpen(false),false,!!busy),button(busy?'Saving…':'Save Label',saveLabel,true,!!busy||!labelName.trim())]})
   ]})}),
   hs('footer',{children:[h('span',{className:'hwp-song-status',role:'status',children:busy+(progress?' '+progress:'')}),button('Cancel',close,false,!!busy),button('Save to song library',save,true,!ready||!!busy)]})
  ]})});
 };
}
