import asyncio
import socket
import unittest
from pinned_ingest import connect_pinned, PinnedIngest

class PinTests(unittest.IsolatedAsyncioTestCase):
    async def test_numeric_address_and_verified_hostname(self):
        calls=[]
        async def connect(ip,port,**options):
            calls.append((ip,port,options))
            return 'reader','writer'
        result=await connect_pinned({'secure':True,'host':'a.rtmps.youtube.com','port':443,'addresses':['8.8.8.8']},connect)
        self.assertEqual(result,('reader','writer'))
        ip,port,options=calls[0]
        self.assertEqual((ip,port),('8.8.8.8',443))
        self.assertEqual(options['flags'],socket.AI_NUMERICHOST)
        self.assertEqual(options['server_hostname'],'a.rtmps.youtube.com')
        self.assertTrue(options['ssl'].check_hostname)
        self.assertNotEqual(options['ssl'].verify_mode,0)

    async def test_failover_stays_in_validated_address_set(self):
        calls=[]
        async def connect(ip,port,**options):
            calls.append(ip)
            if len(calls)==1: raise OSError('offline')
            return 'reader','writer'
        await connect_pinned({'secure':False,'host':'stream.example','port':1935,'addresses':['8.8.8.8','1.1.1.1']},connect)
        self.assertEqual(calls,['8.8.8.8','1.1.1.1'])

    async def test_encoder_targets_loopback_and_preserves_ingest_identity(self):
        ingest=PinnedIngest({'url':'rtmps://a.rtmps.youtube.com/live2/test-key','host':'a.rtmps.youtube.com','secure':True,'port':443,'addresses':['8.8.8.8']})
        try:
            args=await ingest.start()
            self.assertTrue(args[-1].startswith('rtmp://127.0.0.1:'))
            self.assertEqual(args[args.index('-rtmp_tcurl')+1],'rtmps://a.rtmps.youtube.com/live2')
            self.assertEqual(args[args.index('-rtmp_playpath')+1],'test-key')
        finally:
            await ingest.close()
