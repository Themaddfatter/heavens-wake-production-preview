export const emptyGroup = () => ({songIds:[''],links:['']});
export const safeUrl = value => {
  const input=String(value||'').trim();
  if(!input)return '';
  try{
    const url=new URL(/^https?:\/\//i.test(input)?input:'https://'+input);
    return ['https:','http:'].includes(url.protocol)&&url.hostname?url.href:'';
  }catch{return '';}
};
export function normalizeGroups(groups){
  if(!Array.isArray(groups))return [emptyGroup()];
  return groups.map(group=>{
    const ids=Array.isArray(group?.songIds)?group.songIds:[];
    const links=Array.isArray(group?.links)?group.links:[];
    const paired=ids.map((id,i)=>({id,link:links[i]}))
      .filter(row=>typeof row.id==='string'&&row.id.trim()).slice(0,30);
    return {songIds:paired.map(row=>row.id),links:paired.map(row=>safeUrl(row.link))};
  }).slice(0,50);
}
export function planFromSaved(data){
  if(!Array.isArray(data?.groups)||!data.groups.length)return [emptyGroup()];
  return normalizeGroups(data.groups.map(group=>({
    songIds:(group.songs||[]).map(song=>song.libraryId).filter(Boolean),
    links:(group.songs||[]).map(song=>song.link||'')
  })));
}
/** The first selected song names a service entry, even after adding a medley. */
export function serviceSongGroupTitle(group,songs=[],lang='en'){
 const ids=(Array.isArray(group?.songIds)?group.songIds:[]).filter(Boolean);
 const first=songs.find(song=>song.id===ids[0]);
 const name=first?(lang==='es'?first.titleEs||first.title:first.title||first.titleEs):'';
 return (name|| (lang==='es'?'Seleccionar canción…':'Select song…'))+(ids.length>1?' Medley':'');
}

export function assertSaveable(groups,knownIds){
  const rows=normalizeGroups(groups).filter(group=>group.songIds.length);
  if(!rows.length)throw Error('Choose at least one saved song.');
  for(const row of rows){
    if(row.songIds.some(id=>!knownIds.has(id)))throw Error('Your list includes a song that is no longer in the library.');
  }
  return rows;
}

const lowerLabel=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^#{1,6}\s*/,'').replace(/^[\s\[({*]+|[\s\])}*:.-]+$/g,'').replace(/[_–—-]/g,' ').replace(/\s+/g,' ').trim();
const songRoots={
 verse:['verse','verso','estrofa'],chorus:['chorus','coro'],bridge:['bridge','puente'],
 intro:['intro','introduction','introduccion'],outro:['outro','salida','final','ending'],
 tag:['tag','cierre'],'pre-chorus':['pre chorus','pre coro','prechorus','precoro'],
 vamp:['vamp'],refrain:['refrain','estribillo'],hook:['hook','gancho'],
 interlude:['interlude','interludio','intervalo'],drop:['drop'],instrumental:['instrumental']
};
const describeType=(type,number='')=>{
 const t=String(type||'verse').replace(/-/g,' '),heading=t.charAt(0).toUpperCase()+t.slice(1);
 return heading+(number?' '+number:'');
};
export const primarySongLabels=labels=>(Array.isArray(labels)?labels:[]).filter(label=>label.categoryId==='songs'&&label.language!=='es'&&!label.pairedLabelId);
export function resolveSongLabel(part={},labels=[]){
 const english=primarySongLabels(labels),id=String(part?.labelId||'');
 if(id){
  const selected=labels.find(item=>item.id===id);
  const main=selected?.pairedLabelId||id;
  const found=english.find(item=>item.id===main);
  if(found)return found;
  // Preserve custom saved IDs even when the shared catalog is briefly unavailable.
  return null;
 }
 const candidates=[part?.label,part?.labelName].filter(Boolean).map(lowerLabel);
 const suffix=String(part?.number||'').trim();
 const roots=songRoots[String(part?.type||'').toLowerCase()]||[String(part?.type||'verse').replace(/-/g,' ')];
 for(const root of roots)if(root){
  candidates.push(lowerLabel(root+(suffix?' '+suffix:'')));
 }
 for(const candidate of candidates){
  const matching=labels.find(item=>lowerLabel(item.name)===candidate);
  if(matching){
   const main=matching.pairedLabelId||matching.id;
   const found=english.find(item=>item.id===main);
   if(found)return found;
  }
 }
 // An unnumbered legacy Verse still selects the first matching catalog entry.
 // A saved custom or numbered label must never silently be changed to Verse 1.
 const explicit=lowerLabel(part?.label||part?.labelName);
 const rootOnly=roots.some(root=>lowerLabel(root)===explicit);
 if((explicit&&!rootOnly)||suffix)return null;
 for(const root of roots){
  const prefix=lowerLabel(root);
  const found=english.find(item=>lowerLabel(item.name)===prefix||lowerLabel(item.name).startsWith(prefix+' '));
  if(found)return found;
 }
 return null;
}
export function sectionLabelTitle(part={},labels=[],lang='en'){
 const label=resolveSongLabel(part,labels);
 if(label){
  if(lang==='es')return labels.find(item=>item.language==='es'&&item.pairedLabelId===label.id)?.name||label.name;
  return label.name;
 }
 return String(part?.label||'').trim()||describeType(part?.type,part?.number);
}
export function newLabeledSection(type='verse',labels=[]){
 const section={type,number:'',labelId:'',label:'',lyrics:'',lyricsEs:''};
 const match=resolveSongLabel(section,labels);
 return {...section,labelId:match?.id||'',label:match?.name||describeType(type)};
}
const legacyHeading=(line,labels)=>{
 const candidate=lowerLabel(line);
 if(!candidate)return null;
 const all=Array.isArray(labels)?labels:[];
 const exact=all.find(item=>lowerLabel(item.name)===candidate);
 if(exact){
  const main=resolveSongLabel({labelId:exact.id},all);
  const type=Object.entries(songRoots).find(([,names])=>names.some(name=>candidate===lowerLabel(name)||candidate.startsWith(lowerLabel(name)+' ')))?.[0]||'verse';
  return {type,labelId:main?.id||'',label:main?.name||exact.name};
 }
 for(const [type,aliases] of Object.entries(songRoots)){
  for(const alias of aliases){
   const root=lowerLabel(alias);
   const match=candidate.match(new RegExp('^'+root+'(?:\\s+(\\d{1,2}|[ivx]{1,6}))?$','i'));
   if(match){
    const section={type,number:match[1]||'',label:describeType(type,match[1]||'')};
    const selected=resolveSongLabel(section,labels);
    return {...section,labelId:selected?.id||'',label:selected?.name||section.label};
   }
  }
 }
 return null;
};
function parseLegacyLyrics(body,field,labels,defaultType){
 const text=String(body||'').replace(/\r\n?/g,'\n').replace(/\\n/g,'\n').trim();
 if(!text)return [];
 const result=[];
 let current=null;
 for(const line of text.split('\n')){
  const heading=legacyHeading(line,labels);
  if(heading){
   if(current&&current[field].trim())result.push({...current,[field]:current[field].trim()});
   current={...newLabeledSection(heading.type,labels),...heading};
  }else{
   if(!current)current=newLabeledSection(defaultType,labels);
   current[field]+=(current[field]?'\n':'')+line;
  }
 }
 if(current&&current[field].trim())result.push(current);
 return result;
}
/** Restore old library entries from their stored lyrics; never open an empty editor over saved text. */
export function editableSongSections(song={},labels=[],defaultType='verse'){
 if(Array.isArray(song.sections)&&song.sections.length){
  return song.sections.map(s=>({...s,lyrics:String(s.lyrics??s.body??''),lyricsEs:String(s.lyricsEs??s.bodyEs??'')}));
 }
 const english=parseLegacyLyrics(song.body,'lyrics',labels,defaultType);
 const spanish=parseLegacyLyrics(song.bodyEs,'lyricsEs',labels,defaultType);
 const result=english.map(section=>({...section}));
 const matched=new Set();
 for(let i=0;i<spanish.length;i++){
  const section=spanish[i];
  const chosen=resolveSongLabel(section,labels);
  let slot=result.findIndex((candidate,j)=>!matched.has(j)&&!candidate.lyricsEs&&chosen&&resolveSongLabel(candidate,labels)?.id===chosen.id);
  if(slot<0&&result[i]&&!matched.has(i)&&!result[i].lyricsEs)slot=i;
  if(slot<0){result.push(section);slot=result.length-1;}
  else result[slot].lyricsEs=section.lyricsEs;
  matched.add(slot);
 }
 return result.length?result:[newLabeledSection(defaultType,labels)];
}

export function serializeSections(sections,labels=[]){
  const allowed=new Set(['verse','chorus','bridge','intro','outro','tag','vamp','pre-chorus','hook','refrain','drop','interlude']);
  return (Array.isArray(sections)?sections:[]).filter(s=>String(s?.lyrics||'').trim()||String(s?.lyricsEs||'').trim()).map((s,i)=>{
    const choice=resolveSongLabel(s,labels);
    const canonicalType=String(choice?.name||s.type||'verse').toLowerCase().replace(/\s+\d+$/,'').replaceAll(' ','-');
    const type=allowed.has(canonicalType)?canonicalType:(allowed.has(s.type)?s.type:null);
    if(!type)throw Error('Unrecognized song structure: '+String(s.label||s.type||'unknown')+'. Fix the label before saving.');
    return {id:'section-'+i,type,
      labelId:choice?.id||s.labelId||'',label:choice?.name||s.label||describeType(s.type,s.number),number:String(s.number||''),
      lyrics:String(s.lyrics||'').trim(),lyricsEs:String(s.lyricsEs||'').trim()};
  }).filter(s=>s.lyrics||s.lyricsEs).slice(0,120);
}
