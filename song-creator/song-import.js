import {pairSongSections,parseLegacySongSections,readSongStructure,songStructureLabel} from './song-structure.js';
// Client-side song import. No source document is uploaded or saved until the editor reviews and saves it.
// ProPresenter 7+ .pro presentations are read as binary slide data; the editor can review extracted lyrics before saving.
// Supported: text, DOCX, text-based PDF, and ProPresenter 7+ protobuf .pro presentations.
const sectionPattern=/^(?:verse|verso|estrofa|chorus|coro|bridge|puente|intro|introduction|introducci[oó]n|pre[- ]?chorus|pre[- ]?coro|prechorus|precoro|tag|cierre|outro|salida|vamp|hook|gancho|refrain|estribillo|drop|ca[ií]da|instrumental|ending|final|interlude|interludio|un\s+intervalo|intervalo)(?:\s*(?:#\s*)?(?:\d+|[ivx]+))?(?:\s+sp)?$/i;
const spanishSection=/^(?:verso|estrofa|coro|puente|pre[- ]?coro|precoro|estribillo|introducci[oó]n|salida|cierre|gancho|ca[ií]da|interludio|un\s+intervalo|intervalo)\b/i;
const englishSection=/^(?:verse|chorus|bridge|pre[- ]?chorus|prechorus|refrain|hook|tag|intro|outro|vamp|drop|interlude)\b/i;
const langHeading=/^(?:\[(?:es|en|spa|eng)\]|(?:english|ingl[eé]s|spanish|espa[nñ]ol|letra en espa[nñ]ol|lyrics in english)\s*:?)$/i;
const normalize=value=>String(value||'').replace(/\r\n?/g,'\n').replace(/\u0000/g,'').replace(/[\u00a0\t]/g,' ').trim();
const filenameTitle=name=>String(name||'Untitled Song').replace(/\.(?:pro|txt|docx|pdf)$/i,'').replace(/[_-]+/g,' ').trim()||'Untitled Song';

const SPANISH_WORDS=new Set('el la los las del al un una unos unas que quien quienes cuando donde como porque para por con sin y pero aunque te me se nos ellos ellas tu tus su sus mi mis nuestro nuestra dios señor jesús cristo espíritu santo alabado eres eres mi eres nuestra eres por siempre santo adoración gloria bendito salvador poderoso fuerte grande reino ven cielo tierra palabra gracia misericordia victoria exaltado levantamos corazón amor somos nada hay está estas estoy estoy canta cantad hoy aquí amén'.split(' '));
const ENGLISH_WORDS=new Set('the and of for with without your you are is was were to from have has will shall let lord jesus christ holy spirit god worship praise glory blessed savior mighty great kingdom heaven earth word mercy victory exalted lift heart faith love forever always sing singing there here today our we me mine this these those not never all'.split(' '));
export function identifySongLanguage(text){
 const words=String(text||'').toLocaleLowerCase().match(/[a-záéíóúüñ]+/g)||[];
 let es=0,en=0;
 for(const word of words){if(SPANISH_WORDS.has(word))es+=1;if(ENGLISH_WORDS.has(word))en+=1}
 es+=Math.min(6,(String(text).match(/[ñ¿¡áéíóúü]/gi)||[]).length)*1.2;
 const result=es>=2&&es>en*1.4?'es':en>=2&&en>es*1.4?'en':null;
 return result;
}


export function parseSongLyricsText(input,filename=''){
 const original=normalize(input);
 if(!original)throw Error('No readable song lyrics were found. Nothing was imported.');
 const fallback=filenameTitle(filename);
 let title='',titleEs='',active='en',explicitLanguage=false,sectionLanguageLocked=false,parts={en:[],es:[]},hasChordPro=/\{(?:title|t|start_of_chorus|start_of_verse|soc|sov)\b/i.test(original);
 const lines=original.split('\n');
 const push=line=>{if(line.trim())parts[active].push(line.trim());else if(parts[active].length&&parts[active][parts[active].length-1]!=='')parts[active].push('');};
 const pushHeading=line=>{
  const recognized=readSongStructure(line);
  if(!recognized){push(line);return;}
  // SP is part of the heading's meaning, not lyric content or a new verse.
  // A heading belongs to exactly one language; mirroring it into both
  // languages invented empty sections and lost the actual Spanish label.
  if(recognized.language==='es')active='es';
  else if(!explicitLanguage){
   if(spanishSection.test(line))active='es';
   else if(englishSection.test(line))active='en';
  }
  parts[active].push(songStructureLabel(recognized,active));
  sectionLanguageLocked=true;
 };
 for(let i=0;i<lines.length;i++){
  let line=lines[i].trim();
  if(!line){push('');continue;}
  let m=line.match(/^\s*(?:\{(?:title|t)\s*:\s*([^}]+)\}|(?:song\s+)?(?:title|t[ií]tulo)\s*[:：]\s*(.+))\s*$/i);
  if(m){const value=(m[1]||m[2]||'').trim();if(active==='es')titleEs=value;else title=value;continue;}
  m=line.match(/^\{(?:start_of_|end_of_)?(verse|chorus|bridge|sov|soc|sob|eov|eoc|eob)(?:\s*:\s*([^}]+))?\}$/i);
  if(m){
   if(/^end_of_|^e(?:ov|oc|ob)$/i.test(m[0].slice(1)))continue;
   const kind={sov:'Verse',soc:'Chorus',sob:'Bridge'}[m[1].toLowerCase()]||m[1];
   pushHeading((m[2]||'').match(/label\s*=\s*["']([^"']+)/i)?.[1]||kind[0].toUpperCase()+kind.slice(1));
   continue;
  }
  m=line.match(/^\{(?:comment|c)\s*:\s*([^}]+)\}$/i);
  if(m){if(sectionPattern.test(m[1].trim()))pushHeading(m[1].trim());continue;}
  if(/^\{[^}]+\}$/.test(line))continue;
  if(langHeading.test(line)){
   active=/(es|spa|spanish|espa[nñ]ol)/i.test(line)?'es':'en';explicitLanguage=true;sectionLanguageLocked=true;
   continue;
  }
  m=line.match(/^\s*(?:\[(?:es|spa|espa[nñ]ol)\]|(?:spanish|espa[nñ]ol)\s*[:：])\s*(.*)$/i);
  if(m){active='es';explicitLanguage=true;sectionLanguageLocked=true;line=m[1].trim();if(!line)continue;}
  m=line.match(/^\s*(?:\[(?:en|eng)\]|(?:english|ingl[eé]s)\s*[:：])\s*(.*)$/i);
  if(m){active='en';explicitLanguage=true;sectionLanguageLocked=true;line=m[1].trim();if(!line)continue;}
  const bare=line.replace(/^[\[\]{}()*#\s]+|[\[\]{}()*\s:.-]+$/g,'').trim();
  if(/\s+sp$/i.test(bare)&&!readSongStructure(bare))
   throw Error('Unrecognized Spanish SP section label: '+bare+'. Nothing was imported.');
  if(/\s+sp$/i.test(bare)&&sectionPattern.test(bare))active='es';
  else if(!explicitLanguage){
   if(spanishSection.test(bare)&&sectionPattern.test(bare))active='es';
   else if(englishSection.test(bare)&&sectionPattern.test(bare))active='en';
  }
  if(sectionPattern.test(bare)){pushHeading(bare);continue;}
  if(hasChordPro)line=line.replace(/\[(?:[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?|N\.?C\.?)\]/g,'');
  if(!line.trim())continue;
  // Detect unlabeled Spanish and English lyric verses, including bulk imports
  // and ProPresenter slides, without relying on the file extension.
  const detected=identifySongLanguage(line);
  if(detected&&!explicitLanguage&&!sectionLanguageLocked)active=detected;
  if(!title&&!titleEs&&!parts.en.some(Boolean)&&!parts.es.some(Boolean)){
   const next=(lines.slice(i+1).find(x=>x.trim())||'').trim().replace(/^[\[\]{}()*#\s]+|[\[\]{}()*\s:.-]+$/g,'');
   if(sectionPattern.test(next)||!lines[i+1]?.trim()){title=line;continue;}
  }
  push(line);
 }
 let body=parts.en.join('\n').trim(),bodyEs=parts.es.join('\n').trim();
 // Mirrored section headings alone are not lyrics.
 if(!parseLegacySongSections(body,'en').length)body='';
 if(!parseLegacySongSections(bodyEs,'es').length)bodyEs='';
 if(!body&&!bodyEs)throw Error('No verse, chorus, bridge or lyric lines were found. Nothing was imported.');
 // Whole files with no language tags are often Spanish-only uploads.
 // Do not manufacture English lyrics or title from Spanish content.
 if(body&&!bodyEs&&identifySongLanguage(body)==='es'){
  bodyEs=body;body='';titleEs=titleEs||title||fallback;title='';
 }
 // Mixed files can contain an unlabeled Spanish stanza before an English verse.
 if(body&&bodyEs&&identifySongLanguage(body)==='es'&&identifySongLanguage(bodyEs)!=='en'){
  bodyEs=body+'\n\n'+bodyEs;body='';
 }
 if(body.length>30000||bodyEs.length>30000)throw Error('Song lyrics exceed the 30,000-character limit per language. Split the document before importing.');
 if(body)title=title||fallback;
 if(bodyEs&&!body)titleEs=titleEs||title||fallback;
 if(bodyEs&&body&&!titleEs)titleEs=title||fallback;
 return {title:body?title:'',body,titleEs,bodyEs,primaryLanguage:body?'en':'es',sections:pairSongSections(body,bodyEs),spanishManual:!!bodyEs};
}

// Minimal, strictly bounded protobuf wire reader for ProPresenter .pro presentations.
// Uses the public ProPresenter 7 message field layout; ignores unknown metadata.
function fields(bytes){
 let pos=0,count=0;const items=[];
 const varint=()=>{let value=0,shift=0;for(let i=0;i<10;i++){
  if(pos>=bytes.length)throw Error('Truncated ProPresenter file.');
  const b=bytes[pos++];if(shift<53)value+=(b&127)*2**shift;
  if(!(b&128))return value;shift+=7;
 }throw Error('Invalid ProPresenter field.');};
 while(pos<bytes.length){
  if(++count>200000)throw Error('ProPresenter file has too many fields.');
  const key=varint(),id=Math.floor(key/8),wire=key%8;
  if(id<1||id>536870911)throw Error('Invalid ProPresenter field number.');
  let value=null;
  if(wire===0)value=varint();
  else if(wire===1){if(pos+8>bytes.length)throw Error('Truncated ProPresenter field.');pos+=8;}
  else if(wire===5){if(pos+4>bytes.length)throw Error('Truncated ProPresenter field.');pos+=4;}
  else if(wire===2){const size=varint();if(!Number.isSafeInteger(size)||pos+size>bytes.length)throw Error('Invalid ProPresenter field length.');value=bytes.subarray(pos,pos+size);pos+=size;}
  else throw Error('Unsupported ProPresenter wire format.');
  items.push({id,wire,value});
 }
 return items;
}
const child=(items,id)=>items.filter(item=>item.id===id&&item.wire===2).map(item=>item.value);
const decode=bytes=>new TextDecoder('utf-8',{fatal:false}).decode(bytes);
const firstString=(items,id)=>{const bytes=child(items,id)[0];return bytes?decode(bytes):'';};
const uuid=bytes=>firstString(fields(bytes),1);
const safeFields=bytes=>{try{return fields(bytes)}catch{return [];}};

// RTF text is stored inside the slide's Graphics.Text.rtf_data field.
// Skip RTF metadata/font tables; preserve Unicode and line breaks.
export function plainRtf(bytes){
 const input=decode(bytes);
 if(!/^\s*\{\\rtf/i.test(input))return normalize(input);
 let out='',skip=false,stack=[],uc=1;
 const hidden=/^(?:fonttbl|colortbl|stylesheet|info|pict|object|generator|xmlnstbl|listtable|listoverridetable|datastore|themedata|header|footer)$/i;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='{'){stack.push({skip,uc});continue;}
  if(c==='}'){const state=stack.pop();skip=state?.skip||false;uc=state?.uc??1;continue;}
  if(c!=='\\'){if(!skip&&c!=='\r'&&c!=='\n')out+=c;continue;}
  if(input[i+1]==='*'){skip=true;i++;continue;}
  if(input[i+1]==="'"){
   const hex=input.slice(i+2,i+4);i+=3;
   if(!skip&&/^[\da-f]{2}$/i.test(hex))out+=new TextDecoder('windows-1252').decode(Uint8Array.of(parseInt(hex,16)));
   continue;
  }
  if(/[\\{}]/.test(input[i+1]||'')){if(!skip)out+=input[i+1];i++;continue;}
  if(!/[A-Za-z]/.test(input[i+1]||'')){i++;if(input[i]==='~'&&!skip)out+=' ';continue;}
  let j=i+1;while(/[A-Za-z]/.test(input[j]||''))j++;
  const word=input.slice(i+1,j);let k=j;if(input[k]==='-')k++;
  while(/\d/.test(input[k]||''))k++;
  const arg=input.slice(j,k);if(input[k]===' ')k++;
  i=k-1;
  if(hidden.test(word)){skip=true;continue;}
  if(word==='uc'){uc=Math.max(0,Math.min(6,parseInt(arg,10)||0));continue;}
  if(skip)continue;
  if(word==='par'||word==='line')out+='\n';
  else if(word==='tab')out+=' ';
  else if(word==='emdash')out+='—';
  else if(word==='endash')out+='–';
  else if(word==='u'){
   const n=Number(arg);if(Number.isInteger(n)){out+=String.fromCharCode(n<0?n+65536:n);i+=uc;}
  }
 }
 return normalize(out).replace(/ *\n */g,'\n');
}
export function parseProPresenter(bytes,filename=''){
 const root=fields(bytes);
 const groups=child(root,12).map(g=>{
  const f=safeFields(g),gfields=safeFields(child(f,1)[0]||new Uint8Array());
  return {name:firstString(gfields,2)||'Verse',id:uuid(child(gfields,1)[0]||new Uint8Array()),
   cues:child(f,2).map(uuid)};
 });
 const cues=new Map(child(root,13).map(data=>{const f=safeFields(data);return [uuid(child(f,1)[0]||new Uint8Array()),f]}));
 if(!groups.length||!cues.size)throw Error('This .pro file does not contain readable ProPresenter song groups and slides. Export its lyrics as .txt and import that file instead.');
 const selected=child(root,10)[0];const selectedId=selected?uuid(selected):'';
 const arrangement=child(root,11).map(a=>safeFields(a)).find(a=>uuid(child(a,1)[0]||new Uint8Array())===selectedId);
 const groupOrder=arrangement?child(arrangement,3).map(uuid):[];
 const ordered=groupOrder.length?groupOrder.map(id=>groups.find(g=>g.id===id)).filter(Boolean):groups;
 const lyrics=[];
 for(const group of ordered){
  const slides=[],seen=new Set();
  for(const id of group.cues){
   const cue=cues.get(id);if(!cue)continue;
   const texts=[];
   for(const action of child(cue,10)){
    const a=safeFields(action),sl=child(a,23)[0];if(!sl)continue;
    const presentation=child(safeFields(sl),2)[0];if(!presentation)continue;
    const base=child(safeFields(presentation),1)[0];if(!base)continue;
    for(const el of child(safeFields(base),1)){
     const graphic=child(safeFields(el),1)[0];if(!graphic)continue;
     const txt=child(safeFields(graphic),13)[0];if(!txt)continue;
     const rtf=child(safeFields(txt),5)[0];if(!rtf)continue;
     const value=plainRtf(rtf);
     if(value&&value.length>1)texts.push(value);
    }
   }
   if(!texts.length)continue;
   const largest=Math.max(...texts.map(t=>t.length));
   const content=texts.filter(t=>t.length>=Math.max(5,largest*.6)).filter((t,i,a)=>a.indexOf(t)===i).join('\n');
   if(content&&!seen.has(id)){slides.push(content);seen.add(id);}
  }
  if(slides.length){lyrics.push(group.name+'\n'+slides.join('\n'));}
 }
 if(!lyrics.length)throw Error('The .pro presentation contains slides but no extractable lyrics. Export the presentation as text and import the .txt file instead.');
 const ccli=child(root,14)[0];const ccliTitle=ccli?firstString(safeFields(ccli),3):'';
 const title=ccliTitle||firstString(root,3)||filenameTitle(filename);
 return parseSongLyricsText('Title: '+title+'\n\n'+lyrics.join('\n\n'),filename);
}
async function pdfText(bytes){
 const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
 const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
 if(pdf.numPages>100)throw Error('Use a PDF of no more than 100 pages per song.');
 const pages=[];
 for(let i=1;i<=pdf.numPages;i++){
  const items=(await (await pdf.getPage(i)).getTextContent()).items;
  let row='',lastY=null,lines=[];
  for(const item of items){if(typeof item.str!=='string')continue;
   const y=item.transform?.[5];
   if(row&&lastY!==null&&Math.abs((y??0)-lastY)>2){lines.push(row.trim());row='';}
   row+=(row&&!/\s$/.test(row)?' ':'')+item.str;
   if(item.hasEOL){lines.push(row.trim());row='';}
   lastY=y;
  }
  if(row)lines.push(row.trim());
  pages.push(lines.filter(Boolean).join('\n'));
 }
 const text=pages.join('\n\n');
 if(!text.trim())throw Error('This PDF has no selectable text. Import a text-based PDF, DOCX or TXT instead.');
 return text;
}
export async function extractSongFile(file){
 if(!file||!/\.(?:pro|txt|docx|pdf)$/i.test(file.name||''))throw Error('Choose a .pro, .txt, .docx or .pdf song file.');
 if(file.size>12*1024*1024)throw Error('Choose a song file smaller than 12 MB.');
 const ext=file.name.split('.').pop().toLowerCase();
 if(ext==='pro')return parseProPresenter(new Uint8Array(await file.arrayBuffer()),file.name);
 let content='';
 if(ext==='txt')content=await file.text();
 else if(ext==='docx'){const mammoth=await loadMammoth();content=(await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;}
 else content=await pdfText(await file.arrayBuffer());
 if(content.length>80000)throw Error('This song document exceeds 80,000 characters. Split it before importing.');
 return parseSongLyricsText(content,file.name);
}

let mammothPromise;
function loadMammoth(){
 if(globalThis.mammoth?.extractRawText)return Promise.resolve(globalThis.mammoth);
 if(!mammothPromise)mammothPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';script.onload=()=>globalThis.mammoth?.extractRawText?resolve(globalThis.mammoth):reject(Error('DOCX reader unavailable.'));script.onerror=()=>reject(Error('Could not load DOCX reader. Try again.'));document.head.append(script)}).catch(error=>{mammothPromise=null;throw error});
 return mammothPromise;
}
