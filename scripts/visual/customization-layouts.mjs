import { preserveRotationSettings } from './rotation-settings.mjs';
/** Full customization matrix per phone layout/orientation, with real held-state captures. */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { colorCount as countColor } from './customization-pixels.mjs';
const [platform, session, device, startAt] = process.argv.slice(2);
assert(
  ['ios', 'android'].includes(platform) && session && device,
  'Supply platform session device [orientation/type]',
);
const agent = process.env.AGENT_DEVICE || 'agent-device',
  adb = process.env.ADB || 'adb';
const output = resolve(
  `artifacts/customization-layouts/${platform}/run-${Date.now()}`,
);
mkdirSync(output, { recursive: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (...args) =>
  JSON.parse(
    execFileSync(agent, [...args.map(String), '--session', session, '--json'], {
      encoding: 'utf8',
      timeout: 45000,
      maxBuffer: 16 * 1024 * 1024,
    }),
  ).data;
const tap = (id) => run('press', `id="${id}"`, '--settle');
const snapshot = () => run('snapshot').nodes;
const decode = (id) => {
  const n = snapshot().find((n) => n.identifier === id);
  assert(n, `Missing ${id}`);
  const at = n.label.indexOf('{');
  return at < 0 ? null : JSON.parse(n.label.slice(at));
};
const inspect = async () => {
  tap('customization-probe');
  await pause(200);
  const d = decode('customization-probe');
  assert.equal(d?.result, 'PASS', JSON.stringify(d));
  return d;
};
const capture = (path) => {
  if (platform === 'ios') {
    execFileSync('xcrun', ['simctl', 'io', device, 'screenshot', path], {
      stdio: 'ignore',
    });
    return PNG.sync.read(readFileSync(path));
  }
  const bytes = execFileSync(
    adb,
    ['-s', device, 'exec-out', 'screencap', '-p'],
    {
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  writeFileSync(path, bytes);
  return PNG.sync.read(bytes);
};
const colorCount = (...args) => countColor(platform, ...args);

const checks = [],
  captures = [],
  matrices = [];
const orientations = ['portrait', 'landscape-left', 'landscape-right'];
const types = [
  ['QWERTY', 'default'],
  ['Number', 'number-pad'],
  ['Decimal', 'decimal-pad'],
  ['Phone', 'phone-pad'],
];
const order = orientations.flatMap((o) => types.map(([, t]) => `${o}/${t}`));
if (startAt) assert(order.includes(startAt));
const restoreRotation = preserveRotationSettings(platform, session, device);
let result = 'FAIL',
  error;
try {
  run('orientation', 'portrait');
  await pause(700);
  execFileSync(
    process.execPath,
    ['scripts/visual/navigate.mjs', platform, session, 'customization'],
    { env: process.env, stdio: 'pipe' },
  );
  for (const orientation of orientations) {
    run('orientation', orientation);
    await pause(700);
    for (const [label, type] of types) {
      const name = `${orientation}/${type}`;
      if (startAt && order.indexOf(name) < order.indexOf(startAt)) continue;
      run('press', `label="${label}"`, '--settle');
      await pause(400);
      // Rotation can briefly leave accessibility hit targets at their old frames.
      let selected = await inspect();
      if (selected.keyboardType !== type) {
        run('press', `label="${label}"`, '--settle');
        await pause(500);
        selected = await inspect();
      }
      assert.equal(
        selected.keyboardType,
        type,
        'Layout selection did not settle',
      );
      tap('customization-run');
      let matrix;
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        await pause(1800);
        const d = decode('customization-run');
        if (d) {
          matrix = d;
          break;
        }
      }
      assert(matrix, 'Matrix timeout');
      assert.equal(matrix.result, 'PASS', JSON.stringify(matrix));
      assert.equal(matrix.type, type);
      assert.equal(matrix.landscape, orientation !== 'portrait');
      assert.equal(matrix.count, 58);
      matrices.push({ name, ...matrix });
      console.log(`PASS ${name}: ${matrix.count} themes`);
      for (const material of ['flat', 'raised']) {
        tap('customization-visual');
        await pause(400);
        let metrics = await inspect();
        assert.equal(metrics.profile, material);
        assert.equal(metrics.keyboardType, type);
        assert.equal(metrics.landscape, orientation !== 'portrait');
        const fontKey = metrics.keyFrames.find((k) =>
          type === 'default' ? k.label.toLowerCase() === 'b' : k.label === '2',
        );
        assert(fontKey, 'Missing text key');
        if (type === 'default') {
          run(
            'press',
            fontKey.x + fontKey.width / 2,
            fontKey.y + fontKey.height / 2,
          );
          metrics = await inspect();
        }
        const key = metrics.keyFrames.find((k) =>
          type === 'default' ? k.label === 'Delete' : k.label === '2',
        );
        assert(key, 'Missing test key');
        const prefix = `${orientation}-${type}-${material}`,
          idle = `${output}/${prefix}-idle.png`,
          held = `${output}/${prefix}-held.png`,
          released = `${output}/${prefix}-released.png`;
        const before = capture(idle);
        captures.push({ name: `${prefix}-idle`, path: idle, metrics });
        if (material === 'flat') {
          assert(
            colorCount(before, orientation, key, [24, 51, 75]) > 30,
            'Custom key background missing',
          );
          checks.push(`${name} flat background`);
          assert(
            colorCount(before, orientation, fontKey, [240, 229, 255]) > 5,
            'Custom font color missing',
          );
          const deleteKey = metrics.keyFrames.find((k) => k.label === 'Delete');
          assert(
            deleteKey &&
              colorCount(before, orientation, deleteKey, [255, 221, 51]) > 5,
            'Custom icon color missing',
          );
          checks.push(`${name} font and icon colors`);
        }
        const previousText = metrics.text;
        const x = Math.round(key.x + key.width / 2),
          y = Math.round(key.y + key.height / 2);
        let pressed;
        if (platform === 'ios') {
          const child = spawn(
            agent,
            ['longpress', String(x), String(y), '4500', '--session', session],
            { stdio: 'ignore' },
          );
          const done = new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('exit', (code) =>
              code === 0 ? resolve() : reject(new Error(`Hold failed ${code}`)),
            );
          });
          await pause(2000);
          try {
            pressed = capture(held);
          } finally {
            await done;
          }
        } else {
          const motion = (action) =>
            execFileSync(adb, [
              '-s',
              device,
              'shell',
              'input',
              'motionevent',
              action,
              String(x),
              String(y),
            ]);
          motion('DOWN');
          try {
            await pause(550);
            pressed = capture(held);
          } finally {
            motion('UP');
          }
        }
        captures.push({ name: `${prefix}-held`, path: held });
        if (material === 'flat') {
          assert(
            colorCount(
              pressed,
              orientation,
              key,
              [163, 92, 234],
              platform === 'android' ? [24, 51, 75] : undefined,
            ) > 30,
            'Custom pressed color missing',
          );
          checks.push(`${name} pressed color`);
        }
        // Sample the settled state after Android's native ripple fade.
        await pause(platform === 'android' ? 800 : 300);
        const after = capture(released);
        captures.push({ name: `${prefix}-released`, path: released });
        if (material === 'flat') {
          assert(
            colorCount(after, orientation, key, [24, 51, 75]) > 30,
            'Pressed color did not reset',
          );
          checks.push(`${name} released color`);
        }
        metrics = await inspect();
        assert(metrics.text !== previousText, 'Key hold did not type');
        checks.push(`${name} ${material} hold/release/bounds`);
      }
    }
  }
  result = 'PASS';
} catch (e) {
  error = String(e.stack || e);
  console.error(error);
  try {
    capture(`${output}/failure.png`);
  } catch {}
} finally {
  try {
    run('orientation', 'portrait');
  } catch {
  } finally {
    restoreRotation();
  }
  const report = {
    result,
    platform,
    device,
    completedAt: new Date().toISOString(),
    startAt,
    output,
    matrices,
    checks,
    captures,
    error,
    scope:
      '58 themes per layout/orientation; real held-state screenshots; flat custom idle/pressed/released pixel-color checks. Raised appearance requires visual review.',
  };
  writeFileSync(`${output}/results.json`, JSON.stringify(report, null, 2));
  writeFileSync(
    resolve(`artifacts/customization-layouts/${platform}/latest.json`),
    JSON.stringify({ output, result }, null, 2),
  );
  console.log(
    `${result}: ${matrices.length} matrices, ${checks.length} interaction checks; ${output}`,
  );
  if (result !== 'PASS') process.exitCode = 1;
}
