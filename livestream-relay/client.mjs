// The token and destination URLs stay in memory for the duration of a session.
export async function startRelayStream({token,destinations,onStatus=()=>{}}){
 if(!token||!Array.isArray(destinations)||!destinations.length)throw Error('Enter the relay token and at least one destination.');
 if(!navigator.mediaDevices?.getDisplayMedia)throw Error('Screen capture is unavailable in this browser.');
 let capture, socket, recorder, ended=false;
 const stop=(reason='stopped')=>{
  if(ended)return;ended=true;
  const close=()=>{if(socket&&(socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING))socket.close();capture?.getTracks().forEach(track=>track.stop());onStatus(reason)};
  if(recorder&&recorder.state!=='inactive'){recorder.onstop=close;recorder.stop()}else close();
 };
 try{
  capture=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
  socket=new WebSocket('ws://127.0.0.1:8765');
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Could not connect to the relay.')),10000);
   socket.onopen=()=>{clearTimeout(timeout);resolve()};
   socket.onerror=()=>{clearTimeout(timeout);reject(Error('Could not connect to the relay.'))};
  });
  socket.send(JSON.stringify({token,destinations}));
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Relay did not respond.')),10000);
   socket.onmessage=event=>{try{if(JSON.parse(event.data).status==='accepting-media'){clearTimeout(timeout);resolve()}}catch{}};
   socket.onclose=()=>{clearTimeout(timeout);reject(Error('Relay refused the request.'))};
  });
  const type=['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  recorder=new MediaRecorder(capture,type?{mimeType:type}:undefined);
  recorder.ondataavailable=event=>{if(event.data.size&&socket.readyState===WebSocket.OPEN){if(socket.bufferedAmount>8*1024*1024){stop('Connection too slow');return}socket.send(event.data)}};
  recorder.onerror=()=>{stop('Capture failed')};
  socket.onclose=event=>{if(!ended)stop(event.reason||'Relay disconnected')};
  capture.getVideoTracks()[0].onended=()=>stop();
  recorder.start(500);onStatus('Sending to relay');return {stop};
 }catch(error){stop();throw error}
}
