"""Experimental local HWP relay. Not connected to production."""
import asyncio, json, os, secrets, shutil
from urllib.parse import urlsplit
from websockets.asyncio.server import serve

ORIGIN = 'https://production.sioncdo.com'
TOKEN = secrets.token_urlsafe(32)

def destination(url):
    if not isinstance(url, str) or len(url) > 2048 or any(ord(c) < 32 for c in url):
        raise ValueError('Invalid destination')
    parsed = urlsplit(url)
    if parsed.scheme not in ('rtmp', 'rtmps') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Expected an RTMP or RTMPS URL')
    return url

async def handler(socket):
    if socket.request.headers.get('Origin') != ORIGIN:
        await socket.close(1008, 'Origin denied'); return
    processes = []
    try:
        raw = await asyncio.wait_for(socket.recv(), timeout=10)
        settings = json.loads(raw)
        if not secrets.compare_digest(str(settings.get('token', '')), TOKEN):
            await socket.close(1008, 'Authentication failed'); return
        urls = settings.get('destinations')
        if not isinstance(urls, list) or not 1 <= len(urls) <= 4:
            raise ValueError('Select one to four destinations')
        urls = [destination(url) for url in urls]
        for url in urls:
            process = await asyncio.create_subprocess_exec(
                'ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
                '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
                '-r', '30', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
                '-b:v', '4500k', '-maxrate', '4500k', '-bufsize', '9000k',
                '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-f', 'flv', url,
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL)
            processes.append(process)
        await socket.send(json.dumps({'status': 'accepting-media'}))
        async for chunk in socket:
            if not isinstance(chunk, bytes):
                continue
            for process in processes:
                if process.returncode is not None:
                    raise RuntimeError('A destination encoder stopped')
                process.stdin.write(chunk)
            await asyncio.gather(*(process.stdin.drain() for process in processes))
    except (ValueError, TypeError, json.JSONDecodeError, asyncio.TimeoutError, RuntimeError):
        await socket.close(1008, 'Relay request failed')
    finally:
        for process in processes:
            if process.stdin:
                process.stdin.close()
        for process in processes:
            try: await asyncio.wait_for(process.wait(), 5)
            except asyncio.TimeoutError:
                process.kill(); await process.wait()

async def main():
    if not shutil.which('ffmpeg'):
        raise SystemExit('Install ffmpeg before starting the relay')
    print('Experimental relay on 127.0.0.1:8765')
    print('Session token:', TOKEN, flush=True)
    async with serve(handler, '127.0.0.1', 8765, max_size=8*1024*1024):
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())
