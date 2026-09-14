/** Verify sensor-driven rotation, plus restoration of the settings changed by orientation tests. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { layoutDriver, pause } from './layout-driver.mjs';
import { preserveRotationSettings } from './rotation-settings.mjs';
const [session, device] = process.argv.slice(2);
assert(
  session && /^emulator-\d+$/.test(device ?? ''),
  'Supply session and emulator serial',
);
const adb = (...args) =>
  execFileSync(process.env.ADB || 'adb', ['-s', device, ...args], {
    maxBuffer: 16000000,
  });
const shell = (...args) =>
  adb('shell', ...args)
    .toString()
    .trim();
const state = () => [
  shell('wm', 'user-rotation'),
  shell('settings', 'get', 'system', 'accelerometer_rotation'),
  shell('settings', 'get', 'system', 'user_rotation'),
];
const original = state();
assert.equal(
  original[1],
  '1',
  'Enable emulator auto-rotate before this manual-rotation regression',
);
const restore = preserveRotationSettings('android', session, device);
const sensor = adb('emu', 'sensor', 'get', 'acceleration')
  .toString()
  .match(/acceleration = ([^\r\n]+)/)?.[1];
assert(sensor);
const d = layoutDriver('android', session);
const output = resolve(`artifacts/android-auto-rotation/run-${Date.now()}`);
mkdirSync(output, { recursive: true });
const checks = [];
let error;
try {
  for (const interrupted of [false, true]) {
    const cleanup = preserveRotationSettings('android', session, device);
    const sentinel = new Error('Intentional test interruption');
    try {
      d.run('orientation', 'portrait');
      if (interrupted) throw sentinel;
    } catch (e) {
      assert.equal(e, sentinel);
    } finally {
      cleanup();
    }
    assert.deepEqual(state(), original, 'Rotation policy was not restored');
    checks.push({
      name: `settings restored after ${interrupted ? 'failure' : 'success'}`,
    });
  }
  d.open();
  d.control('QWERTY');
  d.control('Custom keyboard');
  await pause(500);
  for (const [orientation, acceleration] of [
    ['portrait', '0:9.81:0'],
    ['landscape-left', '9.81:0:0'],
    ['landscape-right', '-9.81:0:0'],
  ]) {
    adb('emu', 'sensor', 'set', 'acceleration', acceleration);
    await pause(1200);
    assert.equal(
      shell('settings', 'get', 'system', 'accelerometer_rotation'),
      '1',
    );
    for (const mode of ['custom', 'system']) {
      d.control(mode === 'custom' ? 'Custom keyboard' : 'Native');
      await pause(700);
      const metrics = await d.inspect();
      const bytes = adb('exec-out', 'screencap', '-p'),
        png = PNG.sync.read(bytes);
      assert.equal(
        png.width > png.height,
        orientation !== 'portrait',
        'The screen did not follow the sensor',
      );
      assert.equal(metrics.expectedLandscape, orientation !== 'portrait');
      assert.equal(metrics.keyboardMode, mode);
      if (mode === 'custom') {
        assert.equal(metrics.landscape, orientation !== 'portrait');
        assert(metrics.keyCount > 25);
      } else
        assert.equal(
          metrics.systemKeyboardVisible,
          true,
          'Native keyboard is not visible',
        );
      const path = `${output}/${orientation}-${mode}.png`;
      writeFileSync(path, bytes);
      checks.push({ name: `${orientation}/${mode}`, path, metrics });
      console.log(`PASS sensor-driven ${orientation}/${mode}`);
    }
  }
} catch (e) {
  error = String(e.stack || e);
  console.error(error);
} finally {
  restore();
  adb('emu', 'sensor', 'set', 'acceleration', sensor);
}
const result = error ? 'FAIL' : 'PASS';
writeFileSync(
  `${output}/results.json`,
  JSON.stringify(
    { result, checks, error, original, restored: state() },
    null,
    2,
  ),
);
console.log(`${result}: ${checks.length}/8 checks; ${output}`);
if (error) process.exitCode = 1;
