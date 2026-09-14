/** Compare real key-down preview geometry, then assert cleanup on release.
 * ADB=/path/to/adb AGENT_DEVICE=/path/to/agent-device node scripts/test-android-key-preview.mjs session emulator-5568
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const [session, serial] = process.argv.slice(2);
if (!session || !/^emulator-\d+$/.test(serial || ''))
  throw new Error('Supply session and reference emulator');
const bin = process.env.AGENT_DEVICE || 'agent-device';
const adb = process.env.ADB || 'adb';
const dir = 'artifacts/native-parity/android';
mkdirSync(dir, { recursive: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (...args) => {
  const result = JSON.parse(
    execFileSync(bin, [...args, '--session', session, '--json'], {
      encoding: 'utf8',
      timeout: 35000,
    }),
  );
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data;
};
const control = (label) => {
  const node = run('snapshot').nodes.find(
    (n) => n.label === label && n.rect.y > 90 && n.rect.y < 450,
  );
  if (!node) throw new Error(`Missing ${label}`);
  run('press', `@${node.ref}`);
};
const motion = (action) =>
  execFileSync(adb, [
    '-s',
    serial,
    'shell',
    'input',
    'motionevent',
    action,
    '22',
    '677',
  ]);
const capture = (name) => {
  const bytes = execFileSync(adb, [
    '-s',
    serial,
    'exec-out',
    'screencap',
    '-p',
  ]);
  writeFileSync(`${dir}/${name}.png`, bytes);
  const image = PNG.sync.read(bytes);
  if (image.width !== 411 || image.height !== 914)
    throw new Error('Requires 411x914 reference emulator');
  return image;
};
function preview(image) {
  const points = [];
  for (let y = 589; y < 651; y++)
    for (let x = 0; x < 65; x++) {
      const i = (y * image.width + x) * 4;
      if ([0, 1, 2].every((c) => image.data[i + c] >= 253)) points.push([x, y]);
    }
  return {
    pixels: points.length,
    bounds: points.length
      ? [
          Math.min(...points.map((p) => p[0])),
          Math.min(...points.map((p) => p[1])),
          Math.max(...points.map((p) => p[0])),
          Math.max(...points.map((p) => p[1])),
        ]
      : null,
  };
}
const results = [];
try {
  let reference;
  for (const mode of ['native', 'custom']) {
    control(mode === 'native' ? 'Android native' : 'Keyflow');
    await pause(700);
    control('Reset Empty');
    await pause(800);
    motion('DOWN');
    let held;
    try {
      held = preview(capture(`${mode}-pressed-q`));
    } finally {
      motion('UP');
    }
    await pause(250);
    const released = preview(capture(`${mode}-released-q`));
    if (held.pixels < 1800 || !held.bounds)
      throw new Error(`${mode}: key preview missing`);
    if (released.pixels > held.pixels * 0.1)
      throw new Error(`${mode}: preview did not dismiss`);
    if (mode === 'native') reference = held;
    const error = Math.max(
      ...held.bounds.map((v, i) => Math.abs(v - reference.bounds[i])),
    );
    if (error > 2)
      throw new Error(`${mode}: preview bounds differ by ${error}px`);
    const field = run('snapshot').nodes.find(
      (n) => n.editable && n.bundleId === 'com.keyflow.example',
    );
    if (field?.value !== 'Q')
      throw new Error(
        `${mode}: preview must produce one Q, received ${field?.value}`,
      );
    results.push({ mode, held, released, maxBoundsErrorPx: error, pass: true });
    console.log(
      'PASS',
      mode,
      'preview bounds, release cleanup, and single insertion',
    );
  }
  writeFileSync(
    `${dir}/preview-results.json`,
    JSON.stringify({ result: 'PASS', results }, null, 2),
  );
} catch (error) {
  writeFileSync(
    `${dir}/preview-results.json`,
    JSON.stringify({ result: 'FAIL', results, error: String(error) }, null, 2),
  );
  throw error;
}
