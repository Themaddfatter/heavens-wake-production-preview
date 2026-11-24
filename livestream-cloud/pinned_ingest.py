"""Connect an encoder to one DNS-validated destination without a second DNS lookup."""
import asyncio
import socket
import ssl
from urllib.parse import urlsplit

async def connect_pinned(target, connect=asyncio.open_connection):
    tls = ssl.create_default_context() if target['secure'] else None
    for address in target['addresses']:
        try:
            options = {'flags': socket.AI_NUMERICHOST}
            if tls is not None:
                options.update(ssl=tls, server_hostname=target['host'])
            return await asyncio.wait_for(connect(address, target['port'], **options), 10)
        except (OSError, asyncio.TimeoutError):
            continue
    raise ConnectionError('Unable to connect to approved ingest.')

async def pump(reader, writer):
    while True:
        chunk = await reader.read(65536)
        if not chunk:
            return
        writer.write(chunk)
        await asyncio.wait_for(writer.drain(), 15)

class PinnedIngest:
    def __init__(self, target):
        self.target = target
        self.server = None
        self.tasks = set()
        self.accepted = False

    async def start(self):
        self.server = await asyncio.start_server(self.handle, '127.0.0.1', 0)
        port = self.server.sockets[0].getsockname()[1]
        original = urlsplit(self.target['url'])
        app, playpath = original.path.strip('/').split('/', 1)
        if original.query:
            playpath += '?' + original.query
        tcurl = f'{original.scheme}://{original.netloc}/{app}'
        return ['-rtmp_app', app, '-rtmp_playpath', playpath, '-rtmp_tcurl', tcurl,
                '-f', 'flv', f'rtmp://127.0.0.1:{port}/{app}']

    async def handle(self, reader, writer):
        task = asyncio.current_task()
        self.tasks.add(task)
        upstream = None
        pumps = []
        try:
            if self.accepted:
                return
            self.accepted = True
            self.server.close()
            remote_reader, upstream = await connect_pinned(self.target)
            pumps = [asyncio.create_task(pump(reader, upstream)),
                     asyncio.create_task(pump(remote_reader, writer))]
            await asyncio.wait(pumps, return_when=asyncio.FIRST_COMPLETED)
        except (OSError, asyncio.TimeoutError):
            pass
        finally:
            for p in pumps:
                p.cancel()
            await asyncio.gather(*pumps, return_exceptions=True)
            for w in (writer, upstream):
                if w is not None:
                    w.close()
            self.tasks.discard(task)

    async def close(self):
        if self.server is not None:
            self.server.close()
            await self.server.wait_closed()
        tasks = list(self.tasks)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
