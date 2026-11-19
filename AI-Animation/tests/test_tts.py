import unittest
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import tts

class VoiceTests(unittest.TestCase):
    def test_number_and_name(self):
        items = [{'id':'one','name':'Первый'}, {'id':'egor','name':'Егор Тихонов'}]
        self.assertEqual(tts.resolve_voice('2',items),'egor')
        self.assertEqual(tts.resolve_voice('егор тихонов',items),'egor')
        self.assertEqual(tts.resolve_voice('egor',items),'egor')
        with self.assertRaises(ValueError): tts.resolve_voice('0',items)
        with self.assertRaises(ValueError): tts.resolve_voice('9',items)
        with self.assertRaises(ValueError): tts.resolve_voice('нет',items)

if __name__ == '__main__': unittest.main()
