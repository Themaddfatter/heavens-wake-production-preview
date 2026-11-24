import socket,unittest
from destinations import validate_destination,InvalidDestination

def resolve_to(ip):
    return lambda host,port,**kw:[(socket.AF_INET,socket.SOCK_STREAM,6,'',(ip,port))]

class DestinationTests(unittest.TestCase):
    def test_public_rtmp(self):
        self.assertEqual(validate_destination('rtmps://video.example/live/key',resolve_to('8.8.8.8'))['port'],443)
    def test_private_metadata_and_credentials_denied(self):
        for url,resolver in [('rtmp://internal/live/key',resolve_to('10.0.0.1')),('rtmp://localhost/live/key',resolve_to('127.0.0.1')),('rtmp://metadata/live/key',resolve_to('169.254.169.254')),('rtmp://u:p@video.example/live/key',resolve_to('8.8.8.8')),('http://video.example/live/key',resolve_to('8.8.8.8'))]:
            with self.subTest(url=url),self.assertRaises(InvalidDestination):validate_destination(url,resolver)
