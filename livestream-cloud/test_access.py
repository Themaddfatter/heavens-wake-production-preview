import unittest
from access import can_stream

class AccessTests(unittest.TestCase):
    def test_authorized_operators(self):
        self.assertTrue(can_stream({'active': True, 'role':'admin'}, True))
        self.assertTrue(can_stream({'active': True, 'memberMinistries':['audio-video-team']}, True))
    def test_rejects_inactive_or_unverified_and_unrelated(self):
        self.assertFalse(can_stream({'active':False,'role':'admin'},True))
        self.assertFalse(can_stream({'active':True,'role':'admin','emailVerificationRequired':True},False))
        self.assertFalse(can_stream({'active':True,'memberMinistries':['ushers']},True))
        self.assertFalse(can_stream(None,True))

if __name__ == '__main__': unittest.main()
