import socket, unittest
from destinations import validate_destination, InvalidDestination

def resolve_to(*ips):
    return lambda host,port,**kw: [(socket.AF_INET,socket.SOCK_STREAM,6,'',(ip,port)) for ip in ips]

class DestinationTests(unittest.TestCase):
    def test_provider_and_approved_custom(self):
        result=validate_destination('rtmps://a.rtmps.youtube.com/live2/key',resolve_to('8.8.8.8'))
        self.assertEqual(result['port'],443)
        self.assertEqual(result['addresses'],['8.8.8.8'])
        self.assertTrue(result['secure'])
        result=validate_destination('rtmp://stream.example/live/key',resolve_to('8.8.8.8'),hosts={'stream.example'})
        self.assertEqual(result['port'],1935)

    def test_denied_urls(self):
        for url in ['rtmp://internal/live/key','rtmp://localhost/live/key','rtmp://metadata/live/key',
                    'rtmps://a.rtmps.youtube.com.evil.example/live/key',
                    'rtmps://u:p@a.rtmps.youtube.com/live/key','http://a.rtmps.youtube.com/live/key',
                    'rtmps://a.rtmps.youtube.com:22/live/key','rtmps://a.rtmps.youtube.com/live',
                    'rtmps://a.rtmps.youtube.com/live/key#fragment']:
            with self.subTest(url=url),self.assertRaises(InvalidDestination):
                validate_destination(url,resolve_to('8.8.8.8'))

    def test_mixed_public_private_and_multicast_rejected(self):
        for ip in ['10.0.0.1','127.0.0.1','169.254.169.254','224.0.0.1','::1','::ffff:127.0.0.1']:
            with self.subTest(ip=ip),self.assertRaises(InvalidDestination):
                validate_destination('rtmps://a.rtmps.youtube.com/live2/key',resolve_to('8.8.8.8',ip))
