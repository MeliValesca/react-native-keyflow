"""Guard device-independent targets and asynchronous result handling."""
import unittest
import json
import subprocess
import tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
from app import ExampleSuite


class AppHarnessTests(unittest.TestCase):
    def test_key_target_uses_reported_geometry_and_device_density(self):
        suite = ExampleSuite.__new__(ExampleSuite)
        suite.density = 2.625
        metrics = {'keyFrames': [{'label': 'A', 'x': 120, 'y': 650, 'width': 30, 'height': 50}]}
        self.assertEqual(suite.point(metrics, 'a'), (354, 1772))
        with self.assertRaisesRegex(AssertionError, 'Missing key'):
            suite.point(metrics, 'b')

    def test_empty_xml_leaf_is_a_valid_async_ui_result(self):
        suite = ExampleSuite.__new__(ExampleSuite)
        node = ET.fromstring('<node bounds="[0,0][20,40]"/>')
        self.assertIs(suite.wait(lambda: node, timeout=.1), node)
        self.assertEqual(suite.center(node), (10, 20))
        with self.assertRaisesRegex(AssertionError, 'Timed out'):
            suite.wait(lambda: None, timeout=.01)

    def test_busy_dump_cannot_reuse_a_previous_pass_snapshot(self):
        suite = ExampleSuite.__new__(ExampleSuite)
        suite.xml = b'<node text="PASS"/>'
        calls = []
        def adb(*args):
            calls.append(args)
            return b'ERROR: could not get idle state.'
        suite.adb = adb
        self.assertEqual(suite.nodes(), [])
        self.assertEqual(len(calls), 1, 'A failed dump must never read the old XML')

    def test_layout_insertion_respects_the_native_caret_and_selection(self):
        self.assertEqual(ExampleSuite.inserted_text('abcdef', '12', {'selectionStart': 3, 'selectionEnd': 3}), 'abc12def')
        self.assertEqual(ExampleSuite.inserted_text('abcdef', '12', {'selectionStart': 2, 'selectionEnd': 5}), 'ab12f')
        with self.assertRaises(AssertionError):
            ExampleSuite.inserted_text('a', '12', {'selectionStart': 2, 'selectionEnd': 2})

    def test_inspection_rejects_old_empty_and_switching_results(self):
        state = {'diagnosticRequest': 5, 'keyFrames': [], 'violations': [], 'focused': True, 'keyboardMode': 'custom'}
        label = 'Diagnostic state: '+json.dumps(state)
        self.assertIsNone(ExampleSuite.fresh_metrics(label, 5))
        self.assertIsNone(ExampleSuite.fresh_metrics('Diagnostic state: {}', 0))
        self.assertIsNone(ExampleSuite.fresh_metrics('Diagnostic state: {"result":"PASS","diagnosticRequest":6}', 5))
        self.assertEqual(ExampleSuite.fresh_metrics(label, 4), state)

    def test_log_collection_retries_reads_and_retains_terminal_failures(self):
        with tempfile.TemporaryDirectory() as output:
            suite = ExampleSuite.__new__(ExampleSuite)
            suite.output = Path(output)
            calls = []
            def adb(*args):
                calls.append(args)
                if len(calls) == 1:
                    raise subprocess.CalledProcessError(255, 'adb logcat', output=b'partial')
                return b'complete log'
            suite.adb = adb
            suite.save_log()
            self.assertEqual(len(calls), 2)
            self.assertEqual((suite.output/'app.log').read_bytes(), b'complete log')
            self.assertEqual((suite.output/'logcat-partial-1.log').read_bytes(), b'partial')
            def always_fails(*args):
                raise subprocess.CalledProcessError(255, 'adb logcat')
            suite.adb = always_fails
            with self.assertRaises(subprocess.CalledProcessError):
                suite.save_log()
            self.assertTrue((suite.output/'logcat-error-3.txt').exists())
