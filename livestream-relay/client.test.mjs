import test from 'node:test';
import assert from 'node:assert/strict';
import {startRelayStream} from './client.mjs';

test('starts and stops a capture without retaining the stream token',async()=>{
 let trackStopped=false, sent=[];
 const track={stop(){trackStopped=true}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getDisplayMedia:async()=>({getTracks:()=>[track],getVideoTracks:()=>[track]})}}});
 globalThis.WebSocket=class {static OPEN=1;readyState=1;bufferedAmount=0;constructor(){queueMicrotask(()=>this.onopen())}send(value){sent.push(value);if(typeof value==='string')queueMicrotask(()=>this.onmessage({data:'{"status":"accepting-media"}'}))}close(){this.readyState=3;this.onclose?.()}};
 globalThis.MediaRecorder=class {static isTypeSupported(){return true}state='inactive';start(){this.state='recording'}stop(){this.state='inactive';this.onstop?.()}};
 let status=[];const session=await startRelayStream({token:'secret',destinations:['rtmp://example.test/live/key'],onStatus:s=>status.push(s)});assert.equal(JSON.parse(sent[0]).token,'secret');assert.deepEqual(status,['Sending to relay']);session.stop();assert.equal(trackStopped,true);assert.equal(status.at(-1),'stopped');
});
