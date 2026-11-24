"""Hosted relay prototype. Not configured for production deployment."""
import asyncio, json, os
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed
from identity import authorize_stream, AccessDenied
from destinations import validate_destination, InvalidDestination
from pinned_ingest import PinnedIngest

ORIGIN='https://production.sioncdo.com'
active=asyncio.Lock()

def firebase_identity(token,check_revoked):
    from firebase_admin import auth
    return auth.verify_id_token(token,check_revoked=check_revoked)

def firebase_profile(uid):
    from firebase_admin import firestore
    snapshot=firestore.client().collection('users').document(uid).get()
    return snapshot.to_dict() if snapshot.exists else None

async def handler(socket, verify=firebase_identity, profile=firebase_profile, validator=validate_destination):
    if socket.request.headers.get('Origin')!=ORIGIN:
        await socket.close(1008,'Origin denied');return
    processes=[]
    ingests=[]
    try:
        message=json.loads(await asyncio.wait_for(socket.recv(),10))
        if not isinstance(message,dict): raise ValueError('Invalid request')
        await asyncio.to_thread(authorize_stream,message.get('token'),verify,profile)
        urls=message.get('destinations')
        if not isinstance(urls,list) or not 1<=len(urls)<=4: raise ValueError('Invalid destinations')
        targets=[await asyncio.to_thread(validator,url) for url in urls]
        if active.locked(): await socket.close(1008,'Another stream is active');return
        async with active:
            for target in targets:
                ingest= PinnedIngest(target)
                ingests.append(ingest)
                output=await ingest.start()
                p=await asyncio.create_subprocess_exec('ffmpeg','-hide_banner','-loglevel','error','-protocol_whitelist','pipe','-f','matroska','-i','pipe:0','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-r','30','-g','60','-keyint_min','60','-sc_threshold','0','-b:v','4500k','-maxrate','4500k','-bufsize','9000k','-c:a','aac','-b:a','128k','-ar','44100','-protocol_whitelist','rtmp,tcp',*output,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.DEVNULL,stderr=asyncio.subprocess.DEVNULL)
                processes.append(p)
            await socket.send(json.dumps({'status':'accepting-media'}))
            async with asyncio.timeout(12*60*60):
                while True:
                    chunk=await asyncio.wait_for(socket.recv(),30)
                    if not isinstance(chunk,bytes): raise ValueError('Expected media data')
                    for p in processes:
                        if p.returncode is not None: raise RuntimeError('Encoder stopped')
                        p.stdin.write(chunk)
                    await asyncio.wait_for(asyncio.gather(*(p.stdin.drain() for p in processes)),15)
    except (AccessDenied,InvalidDestination,ValueError,TypeError,asyncio.TimeoutError,RuntimeError,OSError):
        await socket.close(1008,'Stream request failed')
    except ConnectionClosed:
        pass
    finally:
        for p in processes:
            if p.stdin: p.stdin.close()
        for p in processes:
            try: await asyncio.wait_for(p.wait(),5)
            except asyncio.TimeoutError:
                if p.returncode is None: p.kill()
                await p.wait()
        await asyncio.gather(*(ingest.close() for ingest in ingests),return_exceptions=True)

async def main():
    import firebase_admin
    firebase_admin.initialize_app()
    async with serve(handler,'0.0.0.0',int(os.environ.get('PORT','8080')),max_size=8*1024*1024):
        await asyncio.Future()

if __name__=='__main__': asyncio.run(main())
