"""Exercise the real React Native example through screen-space UI events.

No fixed device coordinates, Metro source mutations, or native-view substitutes.
The CI phone and tablet run every case. Failed cases retain XML, PNG and logcat.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import traceback
import xml.etree.ElementTree as ET


class ExampleSuite:
    PRIORITY_CASES = ('transitions', 'transparency', 'layouts')
    CASES = PRIORITY_CASES + ('editing', 'multiline', 'pages_and_accents', 'handoff', 'system_editor', 'submit', 'customization')
    SMOKE_CASES = ('core',)
    def __init__(self, serial, output):
        self.serial = serial
        self.output = Path(output)
        self.output.mkdir(parents=True, exist_ok=True)
        density = self.adb('shell', 'wm', 'density').decode()
        self.density = int(re.findall(r'density: (\d+)', density)[-1]) / 160
        self.results = []

    def adb(self, *args):
        return subprocess.check_output(['adb', '-s', self.serial, *map(str, args)], timeout=35)

    def nodes(self):
        dumped = self.adb('shell', 'uiautomator', 'dump', '/sdcard/keyflow-app-tests.xml')
        # UIAutomator sometimes exits zero without writing during animation.
        # Reading its previous XML would turn an old PASS into a new success.
        if b'dumped to:' not in dumped:
            return []
        xml = self.adb('exec-out', 'cat', '/sdcard/keyflow-app-tests.xml')
        self.xml = xml
        return list(ET.fromstring(xml).iter('node'))

    def wait(self, read, predicate=lambda value: value is not None and value is not False, timeout=15):
        deadline = time.monotonic() + timeout
        value = None
        while time.monotonic() < deadline:
            value = read()
            if predicate(value):
                return value
            time.sleep(.15)
        raise AssertionError(f'Timed out waiting for UI: {value}')

    def find(self, label, prefix=False):
        return next((node for node in self.nodes()
                     if any((value.startswith(label) if prefix else value == label)
                            for value in (node.get('content-desc', ''), node.get('text', ''), node.get('resource-id', '')))
                     and node.get('enabled') != 'false'), None)

    @staticmethod
    def center(node):
        x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
        assert x2 > x1 and y2 > y1, 'UI target has empty bounds'
        return (x1 + x2) // 2, (y1 + y2) // 2

    def tap(self, label, prefix=False):
        node = self.wait(lambda: self.find(label, prefix))
        self.adb('shell', 'input', 'tap', *self.center(node))

    @staticmethod
    def lab_viewport(root, display):
        bounds = list(map(int, re.findall(r'\d+', root.get('bounds'))))
        for frame in re.findall(r'type=navigationBars frame=(\[\d+,\d+\]\[\d+,\d+\]) visible=true', display):
            left, top, right, bottom = map(int, re.findall(r'\d+', frame))
            if left <= bounds[0] and right >= bounds[2] and bottom >= bounds[3]:
                bounds[3] = min(bounds[3], top)
        assert bounds[2] > bounds[0] and bounds[3] > bounds[1], 'Lab viewport is occluded'
        return bounds

    @staticmethod
    def card_visible(node, viewport):
        if node is None or node.get('package') != 'com.keyflow.example':
            return False
        left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
        x1, y1, x2, y2 = viewport
        return x1 <= left < right <= x2 and y1 <= top < bottom <= y2

    def open(self, label):
        # Navigate with the actual header; Back first dismisses an open keyboard.
        if self.find('Navigate up') is not None:
            self.tap('Navigate up')
        # React Navigation preserves the lab's scroll position between screens.
        for _ in range(8):
            if self.find('Keyboard lab') is not None:
                break
            root = self.wait(lambda: next((n for n in self.nodes() if n.get('scrollable') == 'true'), None))
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', root.get('bounds')))
            self.adb('shell', 'input', 'swipe', (x1+x2)//2, int(y1+(y2-y1)*.3), (x1+x2)//2, int(y1+(y2-y1)*.8), 300)
        self.wait(lambda: self.find('Keyboard lab'))
        for _ in range(12):
            nodes = self.nodes()
            root = next((n for n in nodes if n.get('scrollable') == 'true' and n.get('package') == 'com.keyflow.example'), None)
            if root is None:
                time.sleep(.15)
                continue
            display = self.adb('shell', 'dumpsys', 'window', 'displays').decode()
            assert re.search(r'mCurrentFocus=.*com\.keyflow\.example/', display), 'Example lost foreground during lab navigation'
            viewport = self.lab_viewport(root, display)
            node = next((n for n in nodes if label in (n.get('text'), n.get('content-desc'))), None)
            if self.card_visible(node, viewport):
                # A card may be exposed in XML while covered by the taskbar,
                # or still move as the previous keyboard dismisses. Tap once
                # only after its fully visible bounds survive another read.
                stable = self.find(label)
                if self.card_visible(stable, viewport) and stable.get('bounds') == node.get('bounds'):
                    self.adb('shell', 'input', 'tap', *self.center(stable))
                    return
                continue
            x1, y1, x2, y2 = viewport
            self.adb('shell', 'input', 'swipe', (x1+x2)//2, int(y1+(y2-y1)*.8), (x1+x2)//2, int(y1+(y2-y1)*.3), 300)
        raise AssertionError(f'Missing lab card: {label}')

    @staticmethod
    def startup_state(nodes):
        labels = {value for node in nodes for value in (node.get('text', ''), node.get('content-desc', ''))}
        anr = next((label for label in labels if label.endswith("isn't responding") or label.endswith('isn’t responding')), None)
        if anr:
            launcher_dialogs = {name + suffix for name in ('Quickstep', 'Pixel Launcher') for suffix in (" isn't responding", ' isn’t responding')}
            if anr in launcher_dialogs:
                return 'launcher_anr'
            system_names = ('System UI', 'Process system')
            system_dialogs = {name + suffix for name in system_names for suffix in (" isn't responding", ' isn’t responding')}
            return 'system_anr' if anr in system_dialogs else 'app_anr'
        if 'Open React Native dev menu' in labels and 'Reload' in labels:
            return 'dev_menu'
        if 'Keyboard lab' in labels:
            return 'ready'
        return 'waiting'

    def startup_capture(self, name):
        self.output.joinpath(name+'.xml').write_bytes(getattr(self, 'xml', b''))
        self.output.joinpath(name+'.png').write_bytes(self.artifact_read('screenshot', 'exec-out', 'screencap', '-p'))

    def prepare(self):
        # Cold AVDs can leave a System UI ANR dialog or Expo's first-launch
        # developer menu over the loaded app. Setup is bounded and recorded;
        # application ANRs fail, and no test gesture is ever replayed.
        deadline = time.monotonic() + 45
        recovered_system = False
        recovered_launcher = False
        dismissed_menu = False
        navigated_home = False
        while time.monotonic() < deadline:
            nodes = self.nodes()
            state = self.startup_state(nodes)
            if state == 'app_anr':
                raise AssertionError('Application ANR during startup')
            if state == 'launcher_anr' and not recovered_launcher:
                self.startup_capture('startup-launcher-anr')
                close = next((node for node in nodes if node.get('text') == 'Close app'), None)
                assert close is not None, 'Launcher ANR has no Close app action'
                self.adb('shell', 'input', 'tap', *self.center(close))
                recovered_launcher = True
            elif state == 'system_anr' and not recovered_system:
                self.startup_capture('startup-system-ui-anr')
                wait = next((node for node in nodes if node.get('text') == 'Wait'), None)
                assert wait is not None, 'System UI ANR has no Wait action'
                self.adb('shell', 'input', 'tap', *self.center(wait))
                recovered_system = True
            elif state == 'dev_menu' and not dismissed_menu:
                self.startup_capture('startup-expo-menu')
                self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
                dismissed_menu = True
            elif state == 'ready':
                self.startup_capture('startup-ready')
                return
            elif state == 'waiting' and not navigated_home:
                back = next((node for node in nodes if node.get('content-desc') == 'Navigate up'), None)
                if back is not None:
                    self.adb('shell', 'input', 'tap', *self.center(back))
                    navigated_home = True
            time.sleep(.15)
        raise AssertionError('App startup did not clear its overlays within 45 seconds')

    @staticmethod
    def landscape_for_rotation(width, height, rotation):
        return (width > height) != bool(rotation % 2)

    def text(self):
        node = self.find('interaction-text')
        return node.get('content-desc', '').removeprefix('Test text: ') if node is not None else None

    def expect_text(self, expected):
        self.wait(self.text, lambda value: value == expected)

    def reset(self, name, expected):
        self.tap(f'Reset {name}')
        self.expect_text(expected)
        return self.metrics()

    @staticmethod
    def fresh_metrics(label, after):
        prefix = 'Diagnostic state: '
        if not label.startswith(prefix+'{'):
            return None
        metrics = json.loads(label.removeprefix(prefix))
        if metrics.get('diagnosticRequest', 0) <= after:
            return None
        if not all(key in metrics for key in ('keyFrames', 'violations', 'focused', 'keyboardMode')):
            return None
        return metrics

    def metrics(self):
        previous = self.find('Diagnostic state: {', True)
        label = previous.get('content-desc', '') if previous is not None else ''
        after = json.loads(label.removeprefix('Diagnostic state: ')).get('diagnosticRequest', 0) if label else 0
        self.tap('Inspect keyboard state')
        def outcome():
            node = self.find('Diagnostic state: {', True)
            return self.fresh_metrics(node.get('content-desc', '') if node is not None else '', after)
        metrics = self.wait(outcome)
        assert not metrics['violations'], metrics
        return metrics

    def point(self, metrics, *labels):
        key = next((key for key in metrics['keyFrames'] if key['label'].lower() in [label.lower() for label in labels]), None)
        assert key, f'Missing key {labels}: {metrics["keyFrames"]}'
        return round((key['x'] + key['width']/2)*self.density), round((key['y'] + key['height']/2)*self.density)

    def key(self, metrics, *labels, hold=0):
        x, y = self.point(metrics, *labels)
        if hold:
            self.adb('shell', 'input', 'swipe', x, y, x, y, hold)
        else:
            self.adb('shell', 'input', 'tap', x, y)

    def trackpad(self, metrics, dx, dy):
        x, y = self.point(metrics, 'space', '')
        self.adb('shell', 'input', 'motionevent', 'DOWN', x, y)
        try:
            time.sleep(.75)
            self.adb('shell', 'input', 'motionevent', 'MOVE', round(x+dx*self.density), round(y+dy*self.density))
        finally:
            self.adb('shell', 'input', 'motionevent', 'UP', round(x+dx*self.density), round(y+dy*self.density))

    def editing(self):
        self.open('Compare native interactions')
        metrics = self.reset('Empty', '')
        expected = ''
        for char in 'abcdefghijklmnopqrstuvwxyz':
            self.key(metrics, char)
            expected += char
            self.wait(self.text, lambda text: text is not None and text.lower() == expected)
        self.wait(self.text, lambda text: text is not None and text.lower() == 'abcdefghijklmnopqrstuvwxyz')
        for name, initial in [('Grapheme', 'A👨‍👩‍👧‍👦'), ('Tone', 'A👋🏽')]:
            metrics = self.reset(name, initial)
            self.key(metrics, '⌫', 'delete')
            self.expect_text('A')
        metrics = self.reset('Repeat', 'abcdefghijklmnop')
        self.key(metrics, '⌫', 'delete', hold=1800)
        remaining = self.wait(self.text, lambda text: text is not None and len(text) < 15)
        assert 'abcdefghijklmnop'.startswith(remaining), remaining
        # Loaded runners deliver different numbers of repeat callbacks. Verify
        # repetition and release, rather than a wall-clock deletion quota.
        time.sleep(.3)
        assert self.text() == remaining, 'Held deletion continued after release'
        self.key(metrics, 'a')
        self.wait(self.text, lambda text: text is not None and text.lower() == (remaining+'a').lower())

    def core(self):
        self.open('Compare native interactions')
        metrics = self.reset('Empty', '')
        self.key(metrics, 'q')
        self.wait(self.text, lambda value: value is not None and value.lower() == 'q')
        self.key(metrics, '⌫', 'delete')
        self.expect_text('')
        metrics = self.reset('Grapheme', 'A👨‍👩‍👧‍👦')
        self.key(metrics, '⌫', 'delete')
        self.expect_text('A')
        metrics = self.reset('Empty', '')
        self.key(metrics, 'n', hold=850)
        self.wait(self.text, lambda value: value is not None and value.lower() == 'ñ')
        metrics = self.reset('Multiline', 'alpha\nbeta\ngamma')
        self.key(metrics, '↵', 'return', 'submit')
        self.expect_text('alpha\nbeta\ngamma\n')
        self.trackpad(self.metrics(), 0, -24)
        self.key(self.metrics(), '⌫', 'delete')
        self.expect_text('alpha\nbetagamma\n')
        metrics = self.reset('Cursor', 'alpha beta')
        self.trackpad(metrics, -32, 0)
        moved = self.metrics()
        assert 0 <= moved['selectionStart'] < 10 and moved['text'] == 'alpha beta', moved
        self.tap('Run switching checks')
        def switched():
            node = self.find('Diagnostic state: {', True)
            if node is None:
                return None
            report = json.loads(node.get('content-desc').removeprefix('Diagnostic state: '))
            return report if 'result' in report else None
        report = self.wait(switched, timeout=45)
        assert report['result'] == 'PASS' and report['checks'] == 6, report
        self.expect_text('alpha beta')
        metrics = self.metrics()
        self.key(metrics, 'submit')
        self.expect_text('alpha beta')
        state = self.metrics()
        assert not state['focused'] and not state['popupVisible'], state
        self.layouts(smoke=True)

    def multiline(self):
        self.open('Compare native interactions')
        metrics = self.reset('Multiline', 'alpha\nbeta\ngamma')
        self.key(metrics, '↵', 'return', 'submit')
        self.expect_text('alpha\nbeta\ngamma\n')
        metrics = self.metrics()
        assert metrics['focused'] and metrics['popupVisible'], metrics
        self.trackpad(metrics, 0, -24)
        moved = self.metrics()
        assert moved['selectionStart'] < 17 and moved['selectionStart'] == moved['selectionEnd'], moved
        assert moved['text'] == 'alpha\nbeta\ngamma\n', moved
        self.key(moved, '⌫', 'delete')
        self.expect_text('alpha\nbetagamma\n')
        metrics = self.reset('Cursor', 'alpha beta')
        self.trackpad(metrics, -32, 0)
        moved = self.metrics()
        assert 0 <= moved['selectionStart'] < 10, moved
        assert moved['text'] == 'alpha beta', moved
        assert moved['editorBottom'] <= moved['screenY'] + 1, moved

    def pages_and_accents(self):
        self.open('Compare native interactions')
        metrics = self.reset('Empty', '')
        self.key(metrics, '?123')
        metrics = self.metrics()
        assert metrics['keyboardPage'] == 'numbers', metrics
        for digit in '1234567890':
            self.key(metrics, digit)
        self.expect_text('1234567890')
        self.key(metrics, '=\\<')
        metrics = self.metrics()
        assert metrics['keyboardPage'] == 'symbols', metrics
        for symbol in '[]%':
            self.key(metrics, symbol)
        self.expect_text('1234567890[]%')
        self.key(metrics, 'ABC')
        assert self.metrics()['keyboardPage'] == 'letters'
        for letter, expected in [('a', 'à'), ('c', 'ç'), ('n', 'ñ')]:
            metrics = self.reset('Empty', '')
            self.key(metrics, letter, hold=850)
            self.wait(self.text, lambda value: value is not None and value.lower() == expected)
        # A cancelled letter must never reach the controlled React Native value.
        metrics = self.reset('Empty', '')
        x, y = self.point(metrics, 'a')
        self.adb('shell', 'input', 'motionevent', 'DOWN', x, y)
        try:
            self.adb('shell', 'input', 'motionevent', 'MOVE', 1, 1)
        finally:
            self.adb('shell', 'input', 'motionevent', 'UP', 1, 1)
        self.expect_text('')

    def handoff(self):
        self.open('Compare native interactions')
        for name, expected in [('Cursor', 'alpha beta'), ('Multiline', 'alpha\nbeta\ngamma')]:
            self.reset(name, expected)
            self.tap('Run switching checks')
            def outcome():
                node = self.find('Diagnostic state: {', True)
                if node is None:
                    return None
                report = json.loads(node.get('content-desc').removeprefix('Diagnostic state: '))
                return report if 'result' in report else None
            result = self.wait(outcome, timeout=45)
            assert result['result'] == 'PASS' and result['checks'] == 6, result
            self.expect_text(expected)
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.wait(lambda: self.find('Native interaction tests'))
        metrics = self.metrics()
        assert not metrics['popupVisible'], metrics

    def system_editor(self):
        self.open('Compare native interactions')
        self.tap('Android native')
        self.reset('Multiline', 'alpha\nbeta\ngamma')
        metrics = self.metrics()
        assert metrics['systemKeyboardVisible'] and not metrics['popupVisible'], metrics
        # Android's normal editor event path, with the actual system IME active.
        # No Keyflow native editing action is invoked by this baseline.
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_ENTER')
        self.expect_text('alpha\nbeta\ngamma\n')
        self.adb('shell', 'input', 'text', 'ab')
        self.expect_text('alpha\nbeta\ngamma\nab')
        self.tap('Keyflow')
        self.expect_text('alpha\nbeta\ngamma\nab')
        metrics = self.metrics()
        assert metrics['keyboardMode'] == 'custom' and metrics['popupVisible'], metrics

    def submit(self):
        self.open('Compare native interactions')
        for mode in ['Keyflow', 'Android native']:
            self.tap(mode)
            metrics = self.reset('Cursor', 'alpha beta')
            if mode == 'Keyflow':
                self.key(metrics, 'submit')
            else:
                self.adb('shell', 'input', 'keyevent', 'KEYCODE_ENTER')
            self.expect_text('alpha beta')
            state = self.metrics()
            assert not state['focused'] and not state['popupVisible'], state
        self.tap('Keyflow')

    def transitions(self):
        self.open('Test keyboard transitions')
        for material in ['Flat', 'Raised']:
            self.tap('RUN TRANSITION TESTS')
            # A previous material's PASS remains mounted until the new run
            # starts. Observe its running state before accepting a terminal.
            self.wait(lambda: self.find('transition-result'),
                      lambda node: node is not None and node.get('text', '').startswith(('Running:', 'baseline:', 'custom:', 'system:')))
            result = self.wait(lambda: self.find('transition-result'),
                               lambda node: node is not None and node.get('text', '').startswith(('PASS:', 'FAIL:')), timeout=210)
            assert result.get('text').startswith('PASS:'), result.attrib
            if material == 'Flat':
                self.tap('MATERIAL: FLAT')

    def customization(self):
        self.open('Customize fonts & test layouts')
        self.tap('Test customization boundaries', True)
        def outcome():
            node = self.find('customization-run')
            label = node.get('content-desc', '') if node is not None else ''
            return json.loads(label[label.index('{'):]) if '{' in label else None
        report = self.wait(outcome, timeout=90)
        assert report['result'] == 'PASS' and report['cases'], report
        for case in report['cases']:
            assert case['result'] == 'PASS', case

    def transparency(self):
        self.open('Make room for your style.')
        for background in range(2):
            self.tap('Run transparency checks')
            result = self.wait(lambda: self.find('Transparency test result:', True))
            assert 'PASS:' in result.get('content-desc'), result.attrib
            if background == 0:
                self.tap('Swap background image')

    @staticmethod
    def inserted_text(before, typed, metrics):
        # Tapping a long editor can place the caret in the middle. That is valid
        # native behavior; assert insertion at its reported selection.
        start, end = metrics['selectionStart'], metrics['selectionEnd']
        assert 0 <= start <= end <= len(before), metrics
        return before[:start] + typed + before[end:]

    def layouts(self, smoke=False):
        self.open('Compare layouts & rotation')
        size = self.adb('shell', 'wm', 'size').decode()
        natural_width, natural_height = map(int, re.findall(r'size: (\d+)x(\d+)', size)[-1])
        rotation = self.adb('shell', 'settings', 'get', 'system', 'user_rotation').decode().strip()
        automatic = self.adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation').decode().strip()
        try:
            self.adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', 0)
            for orientation in [0, 1]:
                self.adb('shell', 'settings', 'put', 'system', 'user_rotation', orientation)
                types = [('QWERTY', 'default')] if smoke else [('QWERTY', 'default'), ('Number', 'number-pad'), ('Decimal', 'decimal-pad'), ('Phone', 'phone-pad')]
                for name, keyboard_type in types:
                    # Core coverage keeps the already selected QWERTY layout.
                    # A focused phone editor can scroll its tabs out of view.
                    if not smoke:
                        self.tap(name)
                    self.tap('Layout input')
                    self.tap('check-layout')
                    def outcome():
                        node = self.find('check-layout')
                        label = node.get('content-desc', '') if node is not None else ''
                        return json.loads(label[label.index('{'):]) if '{' in label else None
                    report = self.wait(outcome, lambda value: value is not None and value['expectedType'] == keyboard_type and value['expectedLandscape'] == self.landscape_for_rotation(natural_width, natural_height, orientation))
                    assert not report['failures'] and report['focused'], report
                    assert report['editorBottom'] <= report['screenY'] + 1, report
                    before = self.wait(lambda: self.find('Layout input')).get('text', '')
                    # Empty editors expose the hint as text in UIAutomator.
                    if before == 'Try this layout…':
                        before = ''
                    typed = 'q' if keyboard_type == 'default' else '0123456789'
                    for char in typed:
                        self.key(report, char)
                    self.wait(lambda: self.find('Layout input'), lambda node: node is not None and node.get('text', '').lower() == self.inserted_text(before, typed, report).lower())
        finally:
            for key, original in [('user_rotation', rotation), ('accelerometer_rotation', automatic)]:
                args = ('delete', 'system', key) if original == 'null' else ('put', 'system', key, original)
                self.adb('shell', 'settings', *args)

    def artifact_read(self, name, *args):
        # Retry read-only capture, never input events or a failed app check.
        for attempt in range(3):
            try:
                return self.adb(*args)
            except subprocess.CalledProcessError as error:
                self.output.joinpath(f'{name}-error-{attempt+1}.txt').write_text(str(error))
                if error.output:
                    self.output.joinpath(f'{name}-partial-{attempt+1}.log').write_bytes(error.output)
                if attempt == 2:
                    raise
                time.sleep(.2)

    def save_log(self):
        self.output.joinpath('app.log').write_bytes(
            self.artifact_read('logcat', 'logcat', '-d', '-t', '5000', '-v', 'threadtime'))

    def run(self, names=None):
        profile = os.environ.get('KEYFLOW_CI_PROFILE', 'full')
        assert profile in ('full', 'smoke'), 'Invalid CI profile'
        names = (self.SMOKE_CASES if profile == 'smoke' else self.CASES) if names is None else tuple(names)
        assert names and len(set(names)) == len(names) and set(names) <= set(self.CASES + self.SMOKE_CASES), 'Invalid app test selection'
        suite = ET.Element('testsuite', name='Android React Native example')
        failures = 0
        try:
            self.prepare()
        except Exception as error:
            self.startup_capture('startup-failed')
            case = ET.SubElement(suite, 'testcase', classname='KeyflowExample', name='startup')
            ET.SubElement(case, 'failure', message=str(error))
            suite.set('tests', '1')
            suite.set('failures', '1')
            ET.ElementTree(suite).write(self.output/'app-tests.xml', encoding='utf-8', xml_declaration=True)
            (self.output/'app-tests.json').write_text(json.dumps([{'test': 'startup', 'result': 'FAIL', 'error': str(error)}]))
            self.save_log()
            raise
        for name in names:
            case = ET.SubElement(suite, 'testcase', classname='KeyflowExample', name=name)
            started = time.monotonic()
            self.xml = b''
            try:
                getattr(self, name)()
                self.results.append({'test': name, 'result': 'PASS'})
            except Exception as error:
                failures += 1
                self.output.joinpath(f'{name}-failure.txt').write_text(traceback.format_exc())
                ET.SubElement(case, 'failure', message=str(error))
                self.results.append({'test': name, 'result': 'FAIL', 'error': str(error)})
            finally:
                case.set('time', str(round(time.monotonic()-started, 3)))
                self.output.joinpath(f'{name}.xml').write_bytes(getattr(self, 'xml', b''))
                self.output.joinpath(f'{name}.png').write_bytes(self.artifact_read('screenshot', 'exec-out', 'screencap', '-p'))
                self.output.joinpath(f'{name}-app.log').write_bytes(self.artifact_read('logcat', 'logcat', '-d', '-t', '5000', '-v', 'threadtime'))
                print(json.dumps(self.results[-1]), flush=True)
            if failures and name in self.PRIORITY_CASES + self.SMOKE_CASES:
                break
        suite.set('tests', str(len(self.results)))
        suite.set('failures', str(failures))
        ET.ElementTree(suite).write(self.output/'app-tests.xml', encoding='utf-8', xml_declaration=True)
        (self.output/'app-tests.json').write_text(json.dumps(self.results, indent=2))
        self.save_log()
        assert failures == 0, f'{failures} React Native integration cases failed'


def run_cli(serial, output):
    awake = subprocess.Popen(['/usr/bin/caffeinate', '-d', '-i', '-w', str(os.getpid())],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) if sys.platform == 'darwin' else None
    try:
        ExampleSuite(serial, output).run()
    finally:
        if awake is not None:
            awake.terminate()
            awake.wait(timeout=5)


if __name__ == '__main__':
    run_cli(os.environ['KEYFLOW_ANDROID_SERIAL'], sys.argv[1])
