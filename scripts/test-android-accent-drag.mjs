/** Continuous accent holds and two-dimensional selection, using observed
 * 411x914 docked Gboard/Keyflow coordinates. Open Native interaction tests.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const [session, serial] = process.argv.slice(2);
if (!session || !/^emulator-\d+$/.test(serial || ''))
  throw new Error('Supply agent-device session and emulator serial');
const bin = process.env.AGENT_DEVICE || 'agent-device';
const adb = process.env.ADB || 'adb';
const dir = 'artifacts/native-parity/android';
mkdirSync(dir, { recursive: true });
const run = (...args) =>
  JSON.parse(
    execFileSync(bin, [...args.map(String), '--session', session, '--json'], {
      encoding: 'utf8',
      timeout: 30000,
    }),
  ).data;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const nodes = () => run('snapshot').nodes;
const button = (label) => {
  const n = nodes().find((n) => n.label === label);
  if (!n) throw new Error(`Missing ${label}`);
  run('press', n.rect.x + n.rect.width / 2, n.rect.y + n.rect.height / 2);
};
const motion = (action, x, y) =>
  execFileSync(adb, [
    '-s',
    serial,
    'shell',
    'input',
    'motionevent',
    action,
    String(x),
    String(y),
  ]);
const capture = (name) => {
  const data = execFileSync(
    adb,
    ['-s', serial, 'exec-out', 'screencap', '-p'],
    { maxBuffer: 5 * 1024 * 1024 },
  );
  writeFileSync(`${dir}/${name}.png`, data);
  const { width, height } = PNG.sync.read(data);
  if (width !== 411 || height !== 914)
    throw new Error('Requires 411x914 reference emulator');
};
const results = [];
try {
  capture('accent-viewport');
  for (const mode of ['native', 'custom']) {
    button(mode === 'native' ? 'Android native' : 'Keyflow');
    await pause(650);
    for (const [expected, destinationY] of [
      ['É', 613],
      ['Ë', 569],
    ]) {
      button('Reset Empty');
      await pause(600);
      const e =
        mode === 'native'
          ? nodes().find((n) => n.label === 'E' && n.rect.y > 600)
          : null;
      if (mode === 'native' && !e)
        throw new Error('Native uppercase E missing');
      const origin = e
        ? [e.rect.x + e.rect.width / 2, e.rect.y + e.rect.height / 2]
        : [102, 677];
      motion('DOWN', ...origin);
      try {
        await pause(700);
        capture(`${mode}-accent-held`);
        motion('MOVE', 145, destinationY);
        await pause(150);
        capture(`${mode}-accent-selected-${expected.codePointAt(0)}`);
      } finally {
        motion('UP', 145, destinationY);
      }
      await pause(450);
      const editor = nodes().find(
        (n) =>
          n.type === 'android.widget.EditText' &&
          n.bundleId === 'com.keyflow.example',
      );
      const actual = editor?.value;
      if (actual !== expected)
        throw new Error(`${mode}: expected ${expected}, received ${actual}`);
      const result = {
        mode,
        gesture: `hold E, drag to ${expected}, release`,
        expected,
        actual,
        pass: true,
      };
      results.push(result);
      console.log('PASS', mode, result.gesture);
    }
  }
  writeFileSync(
    `${dir}/accent-results.json`,
    JSON.stringify({ result: 'PASS', results }, null, 2),
  );
} catch (error) {
  writeFileSync(
    `${dir}/accent-results.json`,
    JSON.stringify({ result: 'FAIL', results, error: String(error) }, null, 2),
  );
  throw error;
}
