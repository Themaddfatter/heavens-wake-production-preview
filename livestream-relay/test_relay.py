import unittest
from relay import destination

class DestinationTests(unittest.TestCase):
    def test_accepts_rtmp_destinations(self):
        self.assertEqual(destination('rtmps://stream.example.test/live/key'), 'rtmps://stream.example.test/live/key')

    def test_rejects_non_rtmp_urls_and_credentials(self):
        for value in ['http://localhost/', 'file:///tmp/out', 'rtmp://user:pass@example.test/live', 'rtmp://example.test/\nkey', '']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                destination(value)

if __name__ == '__main__':
    unittest.main()

class AuthenticationTests(unittest.IsolatedAsyncioTestCase):
    async def test_rejects_wrong_origin_and_token(self):
        import json
        from websockets.asyncio.server import serve
        from websockets.asyncio.client import connect
        from websockets.exceptions import ConnectionClosed
        from relay import handler, ORIGIN
        async with serve(handler, '127.0.0.1', 0) as server:
            port = server.sockets[0].getsockname()[1]
            async with connect(f'ws://127.0.0.1:{port}', origin='https://example.test') as socket:
                with self.assertRaises(ConnectionClosed):
                    await socket.recv()
            async with connect(f'ws://127.0.0.1:{port}', origin=ORIGIN) as socket:
                await socket.send(json.dumps({'token':'incorrect','destinations':['rtmp://example.test/live/key']}))
                with self.assertRaises(ConnectionClosed):
                    await socket.recv()
