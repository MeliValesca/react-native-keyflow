import { preserveRotationSettings } from './rotation-settings.mjs';
/** Gboard pad spaces must stay spaces; QWERTY double-space punctuation is separate. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { layoutDriver, pause } from './layout-driver.mjs';
const [session, device] = process.argv.slice(2);
if (!session || !/^emulator-\d+$/.test(device ?? ''))
  throw new Error('Supply session and Stim emulator serial');
const d = layoutDriver('android', session),
  adb = process.env.ADB || 'adb',
  output = resolve('artifacts/layouts/android/spaces');
mkdirSync(output, { recursive: true });
const checks = [];
const restoreRotation = preserveRotationSettings('android', session, device);
let result = 'FAIL',
  error;
try {
  d.run('orientation', 'portrait');
  await pause(800);
  d.open();
  for (const type of ['Number', 'Decimal', 'Phone']) {
    d.control(type);
    await pause(500);
    for (const mode of ['system', 'custom']) {
      d.control(mode === 'system' ? 'Native' : 'Custom keyboard');
      await pause(700);
      let metrics = await d.inspect();
      if (
        type === 'Phone' &&
        mode === 'system' &&
        !d.snapshot().some((n) => n.label === '1')
      )
        d.key(['Dial keyboard'], metrics);
      d.key(['Delete'], metrics, 1800);
      d.key(['1'], metrics);
      const [x, y] = d.keyPoint(['Space'], metrics).map(Math.round);
      execFileSync(adb, [
        '-s',
        device,
        'shell',
        `input tap ${x} ${y}; input tap ${x} ${y}`,
      ]);
      assert.equal(d.text(), '1  ', `${type} ${mode} preserves double space`);
      const name = `${type}-${mode}`,
        path = `${output}/${name}.png`;
      d.run('screenshot', path);
      checks.push({ name, path });
      console.log(`PASS ${name}`);
    }
  }
  result = 'PASS';
} catch (e) {
  error = String(e.stack || e);
  console.error(error);
} finally {
  restoreRotation();
}
writeFileSync(
  `${output}/results.json`,
  JSON.stringify(
    { result, checks, error, completedAt: new Date().toISOString() },
    null,
    2,
  ),
);
if (result !== 'PASS') process.exitCode = 1;
