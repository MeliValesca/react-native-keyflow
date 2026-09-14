/** Start on the empty default QWERTY playground. Capture both cases/appearances.
 * AGENT_DEVICE=/path/to/agent-device node scripts/capture-qwerty-defaults.mjs ios session
 * ADB=/path/to/adb AGENT_DEVICE=/path/to/agent-device node scripts/capture-qwerty-defaults.mjs android session emulator-5568
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [platform, session, serial] = process.argv.slice(2);
if (
  !['ios', 'android'].includes(platform) ||
  !session ||
  (platform === 'android' && !/^emulator-\d+$/.test(serial || ''))
)
  throw new Error('Supply platform, session and (Android) reference emulator');
const bin = process.env.AGENT_DEVICE || 'agent-device';
const adb = process.env.ADB || 'adb';
const dir = `artifacts/qwerty-defaults/${platform}`;
mkdirSync(dir, { recursive: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (...args) => {
  const result = JSON.parse(
    execFileSync(bin, [...args.map(String), '--session', session, '--json'], {
      encoding: 'utf8',
      timeout: 35000,
    }),
  );
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data;
};
const control = (label) => {
  const n = run('snapshot').nodes.find(
    (n) => n.label === label && n.rect?.y < 250 && n.rect.width > 0,
  );
  if (!n)
    throw new Error(`Missing ${label}; open the default QWERTY playground`);
  run('press', `@${n.ref}`);
};
let mode = 'native';
function key(label, hold = 0) {
  const tree = run('snapshot').nodes;
  const n = tree.find(
    (n) =>
      n.label?.toLowerCase() === label.toLowerCase() &&
      n.rect?.y >= (platform === 'ios' ? 580 : 650) &&
      n.rect.width > 0,
  );
  if (n)
    run(hold ? 'longpress' : 'press', `@${n.ref}`, ...(hold ? [hold] : []));
  else if (platform === 'android' && mode === 'custom')
    run(
      hold ? 'longpress' : 'press',
      ...(label === 'Delete' ? [377, 794] : [22, 677]),
      ...(hold ? [hold] : []),
    );
  else throw new Error(`Missing keyboard key ${label}`);
}
let dark = false;
const previousNight =
  platform === 'android'
    ? execFileSync(adb, ['-s', serial, 'shell', 'cmd', 'uimode', 'night'], {
        encoding: 'utf8',
      }).match(/Night mode: (yes|no|auto)/)?.[1]
    : null;
const captures = [];
try {
  for (const appearance of ['light', 'dark']) {
    if (appearance === 'dark') {
      control('Dark keyboard');
      dark = true;
    }
    if (platform === 'android')
      execFileSync(adb, [
        '-s',
        serial,
        'shell',
        'cmd',
        'uimode',
        'night',
        appearance === 'dark' ? 'yes' : 'no',
      ]);
    await pause(700);
    for (mode of ['native', 'custom']) {
      control(
        mode === 'custom'
          ? 'Keyflow keyboard'
          : platform === 'ios'
          ? 'Apple keyboard'
          : 'System keyboard',
      );
      await pause(1000);
      key('Delete', 1000);
      await pause(400);
      const upper = `${dir}/${appearance}-${mode}-uppercase.png`;
      run('screenshot', upper);
      captures.push(upper);
      key('q');
      await pause(400);
      const lower = `${dir}/${appearance}-${mode}-lowercase.png`;
      run('screenshot', lower);
      captures.push(lower);
      key('Delete', 1000);
      await pause(300);
    }
  }
} finally {
  if (dark) control('Dark keyboard');
  if (previousNight)
    execFileSync(adb, [
      '-s',
      serial,
      'shell',
      'cmd',
      'uimode',
      'night',
      previousNight,
    ]);
}
const results = [];
for (const appearance of ['light', 'dark'])
  for (const letterCase of ['uppercase', 'lowercase']) {
    const report = `${dir}/${appearance}-${letterCase}.json`;
    const result = spawnSync(
      process.execPath,
      [
        'scripts/compare-qwerty-defaults.mjs',
        platform,
        `${dir}/${appearance}-native-${letterCase}.png`,
        `${dir}/${appearance}-custom-${letterCase}.png`,
        report,
      ],
      { encoding: 'utf8' },
    );
    console.log(result.stdout || result.stderr);
    results.push({ appearance, letterCase, pass: result.status === 0, report });
  }
writeFileSync(
  `${dir}/results.json`,
  JSON.stringify(
    {
      result: results.every((r) => r.pass) ? 'PASS' : 'FAIL',
      captures,
      results,
    },
    null,
    2,
  ),
);
if (results.some((r) => !r.pass)) process.exitCode = 1;
