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

    def test_startup_overlays_are_classified_before_the_lab_behind_them(self):
        lab = ET.fromstring('<node text="Keyboard lab"/>')
        system = ET.fromstring("<node text=\"System UI isn't responding\"/>")
        app = ET.fromstring("<node text=\"Keyflow isn't responding\"/>")
        menu = ET.fromstring('<node text="Open React Native dev menu"/>')
        reload = ET.fromstring('<node text="Reload"/>')
        self.assertEqual(ExampleSuite.startup_state([lab, system]), 'system_anr')
        self.assertEqual(ExampleSuite.startup_state([lab, app]), 'app_anr')
        self.assertEqual(ExampleSuite.startup_state([lab, menu, reload]), 'dev_menu')
        self.assertEqual(ExampleSuite.startup_state([lab]), 'ready')

    def test_startup_recovers_os_menu_once_and_never_dismisses_app_anr(self):
        suite = ExampleSuite.__new__(ExampleSuite)
        system = [ET.fromstring("<node text=\"System UI isn't responding\"/>"), ET.fromstring('<node text="Wait" bounds="[10,20][30,40]"/>')]
        menu = [ET.fromstring('<node text="Open React Native dev menu"/>'), ET.fromstring('<node text="Reload"/>')]
        ready = [ET.fromstring('<node text="Keyboard lab"/>')]
        snapshots = iter([system, system, menu, menu, ready])
        suite.nodes = lambda: next(snapshots)
        actions, captures = [], []
        suite.adb = lambda *args: actions.append(args)
        suite.startup_capture = lambda name: captures.append(name)
        suite.prepare()
        self.assertEqual(actions, [('shell', 'input', 'tap', 20, 30), ('shell', 'input', 'keyevent', 'KEYCODE_BACK')])
        self.assertEqual(captures, ['startup-system-ui-anr', 'startup-expo-menu', 'startup-ready'])
        suite.nodes = lambda: [ET.fromstring("<node text=\"Keyflow isn't responding\"/>")]
        with self.assertRaisesRegex(AssertionError, 'Application ANR'):
            suite.prepare()
        self.assertEqual(len(actions), 2, 'Application failures must not be dismissed')

    def test_rotation_respects_portrait_and_landscape_natural_displays(self):
        for width, height, expected in [(1080, 2400, False), (2560, 1800, True)]:
            self.assertEqual(ExampleSuite.landscape_for_rotation(width, height, 0), expected)
            self.assertEqual(ExampleSuite.landscape_for_rotation(width, height, 1), not expected)
            self.assertEqual(ExampleSuite.landscape_for_rotation(width, height, 2), expected)
            self.assertEqual(ExampleSuite.landscape_for_rotation(width, height, 3), not expected)

    def test_screenshot_retry_does_not_replay_a_gesture(self):
        with tempfile.TemporaryDirectory() as output:
            suite = ExampleSuite.__new__(ExampleSuite)
            suite.output = Path(output)
            calls = []
            def adb(*args):
                calls.append(args)
                if len(calls) == 1:
                    raise subprocess.CalledProcessError(255, 'adb screencap')
                return b'png capture'
            suite.adb = adb
            self.assertEqual(suite.artifact_read('screenshot', 'exec-out', 'screencap', '-p'), b'png capture')
            self.assertEqual(calls, [('exec-out', 'screencap', '-p')] * 2)
            self.assertTrue((suite.output/'screenshot-error-1.txt').exists())

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
