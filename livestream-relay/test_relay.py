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
