// Authenticated, read-only companion foundation. Never mount the desktop receiver,
// output audio or document autosave in this view.
export function isCompanionDevice(query, media) {
  const mode = new URLSearchParams(query).get('companion');
  if (mode === '0') return false;
  if (mode === '1') return true;
  return media('(pointer: coarse) and (max-width: 1366px)').matches;
}
export function visibleSchedules(doc, visibleServices) {
  return visibleServices(doc?.playlists || []).filter(s => s.hwpScheduleId && s.hwpSchedulePublished !== false);
}
export function sameCue(a,b) {
  return !!a && !!b && ['itemId','presentationId','slideId','cueIndex'].every(k => a[k] === b[k]);
}
export function remoteCue(status,target) {
  return !!status?.online && (status.songs || []).some(p =>
    p.itemId === target.itemId && p.presentationId === target.presentationId &&
    (p.slides || []).some(s => s.slideId === target.slideId && s.cueIndex === target.cueIndex && s.enabled !== false));
}
export function createMobileCompanion({h,React,boot,visibleServices,cues,renderCue,lookupScripture,Chat,Icon,accentInk,translations,signOut}) {
 const {useState,useEffect,useRef}=React;
 const labels={
  en:{presenter:'Presenter',livestream:'Livestream',mixer:'Sound Mixer',settings:'Settings',service:'Service',presentation:'Presentation',preview:'Active cue preview',lookup:'Quick lookup',slides:'Slides',song:'Song',scripture:'Scripture',search:'Search songs',reference:'Scripture reference',find:'Find',none:'No published services',choose:'Choose a presentation',connected:'Receiver connected',disconnected:'Receiver not connected',checking:'Checking receiver…',unknown:'Receiver status unavailable',notLive:'Audience off',on:'Audience on',noCue:'No active song cue reported',readOnly:'Preview only · remote action not yet supported',unavailable:'Remote connection is not available in this build. Use the production computer for live controls.',close:'Close',logout:'Sign out',loading:'Loading shared library…',refresh:'Refresh',empty:'No matches',sent:'Request sent; waiting for receiver',applied:'Receiver confirmed',rejected:'Receiver rejected or command expired',failed:'Could not send cue',language:'Language',size:'Slide size',noWorkspace:'Shared workspace is not initialized',lookupNote:'Lookup does not add or send content.',pending:'Sending…',retry:'Retry'},
  es:{presenter:'Presentación',livestream:'Transmisión',mixer:'Mezclador',settings:'Ajustes',service:'Servicio',presentation:'Presentación',preview:'Vista de diapositiva activa',lookup:'Búsqueda rápida',slides:'Diapositivas',song:'Canción',scripture:'Escritura',search:'Buscar canciones',reference:'Referencia bíblica',find:'Buscar',none:'No hay servicios publicados',choose:'Elija una presentación',connected:'Receptor conectado',disconnected:'Receptor desconectado',checking:'Comprobando receptor…',unknown:'Estado del receptor no disponible',notLive:'Pantalla apagada',on:'Pantalla encendida',noCue:'No hay canción activa',readOnly:'Solo vista previa · acción remota no disponible',unavailable:'La conexión remota no está disponible en esta versión. Use la computadora de producción.',close:'Cerrar',logout:'Cerrar sesión',loading:'Cargando biblioteca…',refresh:'Actualizar',empty:'Sin resultados',sent:'Solicitud enviada; esperando receptor',applied:'Receptor confirmó',rejected:'Solicitud rechazada o vencida',failed:'No se pudo enviar',language:'Idioma',size:'Tamaño',noWorkspace:'Biblioteca compartida sin inicializar',lookupNote:'La búsqueda no agrega ni envía contenido.',pending:'Enviando…',retry:'Reintentar'}
 };
 return function HwpMobileCompanion(){
  const [language,setLanguage]=useState(()=>{try{return sessionStorage.getItem('hwp-companion-language')==='es'?'es':'en'}catch{return 'en'}});
  const L=labels[language], [mode,setMode]=useState('presenter'),[settings,setSettings]=useState(false),[doc,setDoc]=useState(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[serviceId,setServiceId]=useState(''),[rowId,setRowId]=useState(''),[status,setStatus]=useState(null),[statusError,setStatusError]=useState(false),[kind,setKind]=useState('song'),[query,setQuery]=useState(''),[translation,setTranslation]=useState(()=>window.hwpAccountPreferences?.defaultTranslation||'KJV'),[lookup,setLookup]=useState(null),[lookupError,setLookupError]=useState(''),[lookupBusy,setLookupBusy]=useState(false),[openedSong,setOpenedSong]=useState(''),[size,setSize]=useState(170),[tab,setTab]=useState('slides'),[command,setCommand]=useState(null),[feedback,setFeedback]=useState('');
  const request=useRef(null),lock=useRef(false),lookupVersion=useRef(0);
  useEffect(()=>{let alive=true;setError('');(async()=>{try{const system=await boot();request.current=data=>system.auth.workspace(data);const result=await system.createController().inspect();if(!alive)return;if(!result.workspace){setError('noWorkspace');return}setDoc(result.workspace)}catch(e){if(alive)setError(e?.message||String(e))}})();return()=>{alive=false}},[refresh]);
  const services=visibleSchedules(doc,visibleServices),service=services.find(s=>s.id===serviceId)||services[0]||null;
  const rows=(service?.items||[]).filter(r=>r.header||doc?.presentations?.some(p=>p.id===r.presentationId));
  const presentations=rows.filter(r=>!r.header),row=presentations.find(r=>r.id===rowId)||presentations[0]||null;
  const p=doc?.presentations?.find(p=>p.id===row?.presentationId);
  const slideCues=p?cues(p):[];
  const sid=service?.hwpScheduleId||'';
  useEffect(()=>{let alive=true,timer;setStatus(null);setStatusError(false);setFeedback('');setCommand(null);lock.current=false;if(!sid)return;
    async function poll(){try{const result=await request.current({action:'worshipControlStatus',serviceId:sid});if(alive){setStatus({...result,serviceId:sid});setStatusError(false)}}catch{if(alive){setStatus(null);setStatusError(true)}}finally{if(alive)timer=setTimeout(poll,1200)}}
    void poll();return()=>{alive=false;clearTimeout(timer)}
  },[sid]);
  useEffect(()=>{if(!command||command.serviceId!==sid)return;const result=status?.command;
   if(result?.id===command.id&&result.status==='applied'&&sameCue(status.active,command.target)){setFeedback('applied');setCommand(null);lock.current=false}
   else if(result?.id===command.id&&['rejected','expired'].includes(result.status)||Date.now()>=command.expiresAt){setFeedback('rejected');setCommand(null);lock.current=false}
  },[command,status,sid]);
  useEffect(()=>{if(!command)return;const timer=setTimeout(()=>{setFeedback('rejected');setCommand(null);lock.current=false},Math.max(0,command.expiresAt-Date.now()+100));return()=>clearTimeout(timer)},[command]);
  const currentSid=useRef(sid);currentSid.current=sid;
  async function take(cue){
   const target={itemId:row.id,presentationId:p.id,slideId:cue.slide.id,cueIndex:cue.index};
   if(lock.current||status?.serviceId!==sid||!remoteCue(status,target))return;
   lock.current=true;setFeedback('pending');
   try{const result=await request.current({action:'worshipControlSelect',serviceId:sid,target});
     if(currentSid.current!==sid)return;
     if(!result.commandId||!Number.isFinite(result.expiresAt))throw Error('Invalid command response');
     setCommand({id:result.commandId,expiresAt:result.expiresAt,target,serviceId:sid});setFeedback('sent')
   }catch(e){if(currentSid.current===sid){setFeedback('failed');lock.current=false}}
  }
  useEffect(()=>{lookupVersion.current++;setLookup(null);setLookupError('');setLookupBusy(false)},[kind,query,translation]);
  async function findScripture(){const version=++lookupVersion.current;setLookupBusy(true);setLookupError('');try{const result=await lookupScripture(query,translation,doc.settings);if(version===lookupVersion.current){setLookup(result);if(!result)setLookupError('empty')}}catch(e){if(version===lookupVersion.current)setLookupError(e?.message||String(e))}finally{if(version===lookupVersion.current)setLookupBusy(false)}}
  const search=query.trim().toLowerCase();
  const found=kind==='song'&&search?(doc?.presentations||[]).filter(p=>p.category==='song'&&(p.name?.toLowerCase().includes(search)||p.slides?.some(s=>s.objects?.some(o=>o.kind==='text'&&String(o.text||'').toLowerCase().includes(search))))).slice(0,50):[];
  const active=status?.serviceId===sid&&status.online?status.active:null;
  const activeP=doc?.presentations?.find(p=>p.id===active?.presentationId);
  const activeCue=activeP&&cues(activeP).find(c=>c.index===active?.cueIndex&&c.slide.id===active?.slideId);
  const accent=window.hwpAccountPreferences?.accent||doc?.settings?.appearance?.accent||'#e2a04a';
  const btn=(text,onClick,props={})=>h('button',{type:'button',onClick,...props},text);
  const icon=(name,title,onClick,props={})=>btn(h(Icon,{name,size:23}),onClick,{className:'hwp-mobile-icon',title,'aria-label':title,...props});
  const modeIcons={presenter:'audience',livestream:'video',mixer:'audio'};
  function selectRow(id){setRowId(id);setTab('slides')}
  function selectService(id){setServiceId(id);setRowId('');setTab('slides')}
  const picker=h('select',{'aria-label':L.presentation,value:row?.id||'',onChange:e=>selectRow(e.target.value)},...(presentations.length?presentations.map(r=>h('option',{key:r.id,value:r.id},doc.presentations.find(p=>p.id===r.presentationId)?.name||r.id)):[h('option',{value:''},L.choose)]));
  const serviceList=h('aside',{className:'hwp-mobile-setlist'},h('h2',null,L.presentation),...rows.map(r=>r.header?h('div',{key:r.id,className:'hwp-mobile-section',style:{background:r.bgColor||undefined,color:r.fontColor||undefined}},r.header):btn(doc.presentations.find(p=>p.id===r.presentationId)?.name||r.id,()=>selectRow(r.id),{key:r.id,className:'hwp-mobile-row'+(row?.id===r.id?' selected':''),'aria-pressed':row?.id===r.id})));
  const preview=h('section',{className:'hwp-mobile-preview'},h('div',{className:'hwp-mobile-caption'},h('strong',null,L.preview),h('span',null,activeP?.name||'')),h('div',{className:'hwp-mobile-artboard'},activeCue?renderCue(doc,activeP,activeCue):h('span',null,L.noCue)));
  const slideGrid=h('section',{className:'hwp-mobile-slides'},h('div',{className:'hwp-mobile-caption'},h('strong',null,p?.name||L.choose),h('label',null,L.size,' ',h('input',{type:'range',min:120,max:260,step:10,value:size,onChange:e=>setSize(Number(e.target.value))}))),h('div',{className:'hwp-mobile-slide-grid',style:{'--hwp-mobile-tile':size+'px'}},...slideCues.map(c=>{const target={itemId:row.id,presentationId:p.id,slideId:c.slide.id,cueIndex:c.index},live=sameCue(active,target),enabled=status?.serviceId===sid&&remoteCue(status,target),color=(doc.labels||[]).find(l=>String(l.name).toLowerCase()===String(c.group.name).toLowerCase())?.color||c.group.color;return btn(h('span',{className:'hwp-mobile-slide-content'},h('span',{className:'hwp-mobile-artboard'},renderCue(doc,p,c)),h('span',{className:'hwp-mobile-slide-label',style:color?{background:color,color:accentInk(color)}:undefined},c.group.name,live?' · LIVE':'')),()=>take(c),{key:c.index,className:'hwp-mobile-slide'+(live?' live':''),disabled:!enabled||!!command||feedback==='pending','aria-label':c.group.name+(enabled?'':': '+L.readOnly),title:enabled?c.group.name:L.readOnly})})),p&&slideCues.length>0&&!slideCues.some(c=>remoteCue(status,{itemId:row.id,presentationId:p.id,slideId:c.slide.id,cueIndex:c.index}))&&h('p',{className:'hwp-mobile-note'},L.readOnly));
  const quick=h('section',{className:'hwp-mobile-lookup'},h('h2',null,L.lookup),h('div',{className:'hwp-mobile-tabs'},...['song','scripture'].map(k=>btn(L[k],()=>{setKind(k);setQuery('');setOpenedSong('')},{key:k,'aria-pressed':kind===k}))),h('p',{className:'hwp-mobile-note'},L.lookupNote),h('form',{onSubmit:e=>{e.preventDefault();if(kind==='scripture'&&query.trim()&&doc)findScripture()}},h('input',{value:query,onChange:e=>{setQuery(e.target.value);setOpenedSong('')},placeholder:kind==='song'?L.search:L.reference,'aria-label':kind==='song'?L.search:L.reference}),kind==='scripture'&&h('div',{className:'hwp-mobile-tabs'},h('select',{value:translation,onChange:e=>setTranslation(e.target.value),'aria-label':'Bible translation'},...translations.map(t=>h('option',{key:t,value:t},t))),h('button',{type:'submit',disabled:lookupBusy||!query.trim()||!doc},lookupBusy?'…':L.find))),kind==='song'&&search&&(!found.length?h('p',null,L.empty):found.map(p=>h('div',{key:p.id,className:'hwp-mobile-song-result'},btn(p.name,()=>setOpenedSong(openedSong===p.id?'':p.id),{'aria-expanded':openedSong===p.id}),openedSong===p.id&&cues(p).map(c=>h('div',{key:c.index,className:'hwp-mobile-lyrics'},h('strong',null,c.group.name),h('p',null,c.slide.objects?.filter(o=>o.kind==='text'&&!o.hidden&&o.binding!=='copyright').map(o=>o.text||'').join('\n'))))))),lookupError&&h('p',{role:'status'},L[lookupError]||lookupError),lookup&&h('div',{className:'hwp-mobile-lyrics'},...lookup.verses.map(v=>h('p',{key:v.n},h('strong',null,v.n+' '),v.text))));
  return h('main',{className:'hwp-mobile-companion',lang:language,style:{'--amber':accent,'--hwp-accent-ink':accentInk(accent)}},h('header',{className:'hwp-mobile-header'},h('img',{src:'./hwp-logo.png',alt:"Heaven's Wake Production"}),h('div',{className:'hwp-mobile-modes'},...Object.keys(modeIcons).map(k=>icon(modeIcons[k],L[k],()=>setMode(k),{key:k,'aria-pressed':mode===k}))),h('div',{className:'hwp-mobile-head-end'},h(Chat,{}),icon('gear',L.settings,()=>setSettings(!settings),{'aria-expanded':settings}))),settings&&h('section',{className:'hwp-mobile-settings'},h('strong',null,L.settings),h('label',null,L.language,h('select',{value:language,onChange:e=>{setLanguage(e.target.value);try{sessionStorage.setItem('hwp-companion-language',e.target.value)}catch{}}},h('option',{value:'en'},'English'),h('option',{value:'es'},'Español'))),btn(L.refresh,()=>setRefresh(v=>v+1)),btn(L.logout,signOut),btn(L.close,()=>setSettings(false))),mode!=='presenter'?h('section',{className:'hwp-mobile-unavailable'},h('h2',null,L[mode]),h('p',null,L.unavailable)):h('div',{className:'hwp-mobile-presenter'},h('div',{className:'hwp-mobile-service'},h('label',null,L.service,h('select',{value:service?.id||'',onChange:e=>selectService(e.target.value)},...(services.length?services.map(s=>h('option',{key:s.id,value:s.id},s.name)):[h('option',{value:''},L.none)]))),h('div',{className:'hwp-mobile-status',role:'status'},statusError?L.unknown:status?.serviceId!==sid?L.checking:status.online?L.connected+' · '+(status.audienceOn?L.on:L.notLive):L.disconnected)),h('div',{className:'hwp-mobile-feedback',role:'status'},feedback?L[feedback]||feedback:''),error?h('section',{className:'hwp-mobile-unavailable'},h('p',{role:'alert'},L[error]||error),btn(L.retry,()=>setRefresh(v=>v+1))):!doc?h('p',{className:'hwp-mobile-note'},L.loading):h('div',{className:'hwp-mobile-body'},serviceList,h('div',{className:'hwp-mobile-main'},h('div',{className:'hwp-mobile-phone-picker'},picker),preview,h('div',{className:'hwp-mobile-phone-tabs hwp-mobile-tabs'},...['slides','lookup'].map(k=>btn(L[k],()=>setTab(k),{key:k,'aria-pressed':tab===k}))),h('div',{className:'hwp-mobile-content','data-tab':tab},slideGrid,quick)))));
 };
}
