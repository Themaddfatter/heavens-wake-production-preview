import {HOSTED_RELAY_ENDPOINT} from './config.mjs';

export function validateRelayConfiguration(endpoint) {
  if (!endpoint) throw new Error('Hosted streaming relay is not configured.');
  const url = new URL(endpoint);
  if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash)
    throw new Error('Invalid secure relay configuration.');
  return url.href;
}

export async function startHostedStream({getToken, destinations, muted=false, audioDeviceId='', onStatus=()=>{}, onDestination=()=>{}}) {
  const endpoint = validateRelayConfiguration(HOSTED_RELAY_ENDPOINT);
  if (typeof getToken !== 'function' || !Array.isArray(destinations) || destinations.length < 1 || destinations.length > 4)
    throw new Error('Choose one to four streaming destinations.');
  if (!navigator.mediaDevices?.getDisplayMedia || !globalThis.MediaRecorder)
    throw new Error('This browser does not support program capture.');
  const mimeType = ['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('This browser cannot encode the required WebM stream. Use a supported browser.');
  let display, mic, audioContext, capture, socket, recorder, ended=false;
  function release(reason) {
    if (ended) return;
    ended=true;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (socket && [WebSocket.OPEN,WebSocket.CONNECTING].includes(socket.readyState)) socket.close();
    for (const stream of [display,mic,capture]) stream?.getTracks().forEach(track=>track.stop());
    audioContext?.close().catch(()=>{});
    onStatus(reason);
  }
  try {
    // Start screen selection directly from the operator's click, before awaiting auth.
    onStatus('Select HWP Program output');
    display=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:30,max:30},width:{max:1920},height:{max:1080}},audio:!muted});
    capture=new MediaStream(display.getVideoTracks());
    if (!muted) {
      mic=await navigator.mediaDevices.getUserMedia({video:false,audio:audioDeviceId?{deviceId:{exact:audioDeviceId}}:true});
      audioContext=new AudioContext();
      const mixer=audioContext.createMediaStreamDestination();
      for (const source of [display,mic]) if (source.getAudioTracks().length)
        audioContext.createMediaStreamSource(source).connect(mixer);
      await audioContext.resume();
      mixer.stream.getAudioTracks().forEach(track=>capture.addTrack(track));
    }
    const token=await getToken();
    if (!token) throw new Error('Sign in to start a stream.');
    onStatus('Connecting to hosted relay');
    socket=new WebSocket(endpoint);
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Relay connection timed out.')),15000);
      socket.onopen=()=>{clearTimeout(timeout);resolve()};
      socket.onerror=socket.onclose=()=>{clearTimeout(timeout);reject(new Error('Could not connect to hosted relay.'))};
    });
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Relay authorization timed out.')),20000);
      socket.onmessage=event=>{try{
        const message=JSON.parse(event.data);
        if (message.status==='accepting-media'){clearTimeout(timeout);resolve()}
      }catch{}};
      socket.onclose=socket.onerror=()=>{clearTimeout(timeout);reject(new Error('Relay refused the request. Check account permissions and destinations.'))};
      socket.send(JSON.stringify({token,destinations}));
    });
    recorder=new MediaRecorder(capture,{mimeType,videoBitsPerSecond:4500000,audioBitsPerSecond:128000});
    socket.onmessage=event=>{try{
      const message=JSON.parse(event.data);
      if(Number.isInteger(message.destination)&&message.destination>=0&&message.destination<destinations.length&&['sending-media','encoder-stopped'].includes(message.status))
        onDestination(message.destination,message.status);
    }catch{}};
    socket.onclose=()=>release('Relay disconnected');
    socket.onerror=()=>release('Relay connection failed');
    recorder.ondataavailable=event=>{
      if (!event.data.size || ended) return;
      if (socket.readyState!==WebSocket.OPEN||socket.bufferedAmount>8*1024*1024){release('Connection too slow or disconnected');return}
      socket.send(event.data);
    };
    recorder.onerror=()=>release('Capture failed');
    display.getVideoTracks()[0].onended=()=>release('Program capture ended');
    recorder.start(500);
    onStatus('Sending program to relay');
    return {stop:()=>release('Stopped')};
  } catch (error) {
    release('Stopped');
    throw error;
  }
}
