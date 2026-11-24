import unittest
from identity import authorize_stream, AccessDenied

class IdentityTests(unittest.TestCase):
    def test_authorized_identity_is_verified_with_revocation(self):
        seen=[]
        def verify(token, check_revoked):
            seen.append(check_revoked); return {'uid':'av-user','email_verified':True}
        result=authorize_stream('signed-token',verify,lambda uid:{'active':True,'memberMinistries':['audio-video-team']})
        self.assertEqual(result,'av-user');self.assertEqual(seen,[True])
    def test_rejects_revoked_invalid_and_unauthorized(self):
        def revoked(*args,**kwargs): raise ValueError('revoked')
        for verify,profile in [(revoked,{}),(lambda *a,**k:{'uid':'x','email_verified':False},{'active':True,'role':'admin','emailVerificationRequired':True}),(lambda *a,**k:{'uid':'bad/path'}, {'active':True,'role':'admin'})]:
            with self.assertRaises(AccessDenied): authorize_stream('token',verify,lambda uid:profile)

if __name__ == '__main__': unittest.main()
