"""Hosted relay prototype. Not configured for production deployment."""
import asyncio, json, os
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed
from identity import authorize_stream, AccessDenied
from destinations import validate_destination, InvalidDestination

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
    try:
        message=json.loads(await asyncio.wait_for(socket.recv(),10))
        if not isinstance(message,dict): raise ValueError('Invalid request')
        await asyncio.to_thread(authorize_stream,message.get('token'),verify,profile)
        urls=message.get('destinations')
        if not isinstance(urls,list) or not 1<=len(urls)<=4: raise ValueError('Invalid destinations')
        # Validation is not sufficient protection against DNS rebinding: do not deploy
        # until outbound connections are pinned to verified public addresses.
        targets=[await asyncio.to_thread(validator,url) for url in urls]
        if active.locked(): await socket.close(1008,'Another stream is active');return
        async with active:
            for target in targets:
                p=await asyncio.create_subprocess_exec('ffmpeg','-hide_banner','-loglevel','error','-i','pipe:0','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-r','30','-g','60','-keyint_min','60','-sc_threshold','0','-b:v','4500k','-maxrate','4500k','-bufsize','9000k','-c:a','aac','-b:a','128k','-ar','44100','-f','flv',target['url'],stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.DEVNULL,stderr=asyncio.subprocess.DEVNULL)
                processes.append(p)
            await socket.send(json.dumps({'status':'accepting-media'}))
            async for chunk in socket:
                if not isinstance(chunk,bytes): continue
                for p in processes:
                    if p.returncode is not None: raise RuntimeError('Encoder stopped')
                    p.stdin.write(chunk)
                await asyncio.gather(*(p.stdin.drain() for p in processes))
    except (AccessDenied,InvalidDestination,ValueError,TypeError,asyncio.TimeoutError,RuntimeError,BrokenPipeError,ConnectionResetError):
        await socket.close(1008,'Stream request failed')
    except ConnectionClosed:
        pass
    finally:
        for p in processes:
            if p.stdin: p.stdin.close()
        for p in processes:
            try: await asyncio.wait_for(p.wait(),5)
            except asyncio.TimeoutError: p.kill();await p.wait()

async def main():
    import firebase_admin
    firebase_admin.initialize_app()
    async with serve(handler,'0.0.0.0',int(os.environ.get('PORT','8080')),max_size=8*1024*1024):
        await asyncio.Future()

if __name__=='__main__': asyncio.run(main())
