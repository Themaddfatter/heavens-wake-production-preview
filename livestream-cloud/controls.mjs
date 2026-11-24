import {startHostedStream,validateRelayConfiguration} from './client.mjs';
import {HOSTED_RELAY_ENDPOINT} from './config.mjs';

export function createHostedRelayControls({jsx,jsxs,useState,useEffect,useRef,boot}) {
  return function HostedRelayControls({settings}) {
    const [urls,setUrls]=useState(['']),[status,setStatus]=useState('Stopped'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[running,setRunning]=useState(false),[states,setStates]=useState([]);
    const session=useRef(null),mounted=useRef(false),starting=useRef(false);
    let configured=false;try{validateRelayConfiguration(HOSTED_RELAY_ENDPOINT);configured=true}catch{}
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;session.current?.stop()}},[]);
    useEffect(()=>{session.current?.setMuted?.(settings.muted)},[settings.muted]);
    const destinations=urls.map(url=>url.trim()).filter(Boolean);
    async function start(){
      if(starting.current||session.current||!configured)return;
      starting.current=true;setBusy(true);setError('');setStates(destinations.map(()=> 'Connecting'));
      try{
        const next=await startHostedStream({
          getToken:async()=>{const system=await boot();const user=system.auth.firebaseAuth.currentUser;if(!user)throw Error('Sign in to start streaming.');return user.getIdToken()},
          destinations,muted:settings.muted,audioDeviceId:settings.audioDeviceId,
          onStatus:value=>{if(!mounted.current)return;setStatus(value);if(value==='Sending program to relay')setRunning(true);else if(['Stopped','Relay disconnected','Relay connection failed','Capture failed','Program capture ended','Connection too slow or disconnected'].includes(value)){session.current=null;setRunning(false)}},
          onDestination:(index,value)=>{if(mounted.current)setStates(old=>old.map((item,i)=>i===index?(value==='sending-media'?'Encoder sending':'Encoder stopped'):item))}
        });
        if(!mounted.current)next.stop();else session.current=next;
      }catch(e){if(mounted.current){setError(e?.message||'Unable to start streaming');setRunning(false)}}
      finally{starting.current=false;if(mounted.current)setBusy(false)}
    }
    const locked=busy||running;
    return jsxs('div',{className:'live-mix hwp-relay-controls',children:[
      jsx('div',{className:'lbl',children:'Streaming destinations'}),
      jsx('p',{className:'hint',children:configured?'Choose the HWP Program output in the browser share dialog. Stream keys are used only for this session. Encoder status is not a platform live confirmation.':'Hosted relay is not connected. Broadcasting is disabled until a secure service is configured.'}),
      ...urls.map((url,index)=>jsxs('div',{className:'field',children:[
        jsxs('span',{className:'lbl',children:['Destination ',index+1,states[index]?' · '+states[index]:'']}),
        jsx('input',{type:'password',autoComplete:'off',spellCheck:false,placeholder:'RTMP or RTMPS URL and stream key',value:url,disabled:locked,onChange:e=>setUrls(old=>old.map((v,i)=>i===index?e.target.value:v))}),
        urls.length>1&&jsx('button',{className:'btn',disabled:locked,onClick:()=>{setUrls(old=>old.filter((_,i)=>i!==index));setStates([])},children:'Remove destination'})
      ]},index)),
      urls.length<4&&jsx('button',{className:'btn',disabled:locked,onClick:()=>setUrls(old=>[...old,'']),children:'+ Add destination'}),
      jsx('button',{className:'btn primary',disabled:locked||!configured||!destinations.length,onClick:start,children:busy?'Connecting…':'Start streaming'}),
      jsx('button',{className:'btn',disabled:!running,onClick:()=>{session.current?.stop();session.current=null;setRunning(false)},children:'Stop streaming'}),
      jsx('p',{role:'status',children:status}),
      error&&jsx('p',{role:'alert',children:error})
    ]});
  };
}
