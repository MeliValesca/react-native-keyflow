/** Open Make room for your style with Wallpaper selected in portrait.
 * AGENT_DEVICE=/path/to/agent-device node scripts/visual/transparency.mjs ios|android session
 * Checks independent panel/key alpha, actual pixels, native geometry and space input.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [platform, session] = process.argv.slice(2);
assert(
  ['ios', 'android'].includes(platform) && session,
  'Supply platform session',
);
const bin = process.env.AGENT_DEVICE || 'agent-device';
const dir = `artifacts/features/${platform}/transparency/independent`;
mkdirSync(dir, { recursive: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (...args) =>
  JSON.parse(
    execFileSync(bin, [...args.map(String), '--session', session, '--json'], {
      encoding: 'utf8',
      timeout: 35000,
      maxBuffer: 16 * 1024 * 1024,
    }),
  ).data;
const capture = (name) => {
  const path = `${dir}/${name}.png`;
  run('screenshot', path);
  return PNG.sync.read(readFileSync(path));
};
const check = async () => {
  const since = Date.now();
  run('press', 'label="Run transparency checks"', '--settle');
  for (let attempt = 0; attempt < 8; attempt++) {
    await pause(400);
    const output = execFileSync(
      'stim',
      [
        'logs',
        '--since',
        '1m',
        '--grep',
        'KEYFLOW_TRANSPARENCY_TEST',
        '--json',
      ],
      { cwd: 'example', encoding: 'utf8' },
    );
    const records = output.trim().split('\n').filter(Boolean).map(JSON.parse);
    const record = records
      .reverse()
      .find(
        (record) =>
          record.ts >= since && record.msg.includes(`"platform":"${platform}"`),
      );
    if (!record) continue;
    const result = JSON.parse(record.msg.slice(record.msg.indexOf('{')));
    assert.equal(result.result, 'PASS', result.error);
    assert(result.metrics.focused, 'Keyboard must stay focused');
    assert.equal(result.metrics.keyboardMode, 'custom');
    assert.equal(
      result.metrics.landscape,
      false,
      'Use portrait for this fixture',
    );
    assert.equal(result.backdrop, 0, 'Select Wallpaper for pixel comparisons');
    assert(result.metrics.keyCount >= 31);
    assert.deepEqual(result.metrics.violations, []);
    assert(result.metrics.editorBottom <= result.metrics.screenY + 1);
    return result;
  }
  throw new Error('No fresh transparency check result');
};
const setOpacity = async (target, opacity) => {
  const slider = run('snapshot').nodes.find((node) =>
    node.label?.startsWith(`Keyboard ${target} opacity`),
  );
  assert(slider?.rect, 'Open Make room for your style first');
  const r = slider.rect;
  run('press', r.x + 14 + (r.width - 28) * opacity, r.y + r.height / 2);
  await pause(250);
};
const spaceKey = (metrics) =>
  metrics.keyFrames.find((key) =>
    platform === 'ios' ? key.label === 'space' : key.label === '',
  );
// Sample only blank surfaces: glyphs and the caret cannot change these pixels.
const sampleColor = (png, metrics, rect) => {
  const scale = png.width / metrics.width;
  const color = [0, 0, 0];
  let count = 0;
  for (
    let y = Math.ceil(rect.y * scale);
    y < (rect.y + rect.height) * scale;
    y++
  ) {
    for (
      let x = Math.ceil(rect.x * scale);
      x < (rect.x + rect.width) * scale;
      x++
    ) {
      const offset = (y * png.width + x) * 4;
      for (let c = 0; c < 3; c++) color[c] += png.data[offset + c];
      count++;
    }
  }
  assert(count > 0);
  return color.map((value) => value / count);
};
const colors = (png, metrics) => {
  const key = spaceKey(metrics);
  assert(key && key.width > 100, 'Space-bar touch target is missing');
  return {
    space: sampleColor(png, metrics, {
      x: key.x + key.width * 0.3,
      y: key.y + key.height * 0.3,
      width: key.width * 0.4,
      height: key.height * 0.4,
    }),
    panel: sampleColor(png, metrics, {
      x: metrics.width * 0.45,
      y: metrics.screenY + 1,
      width: metrics.width * 0.1,
      height: 2,
    }),
    bottom: sampleColor(png, metrics, {
      x: metrics.width * 0.4,
      y: metrics.height - 2,
      width: metrics.width * 0.2,
      height: 1,
    }),
  };
};
const delta = (a, b) =>
  Math.max(...a.map((value, i) => Math.abs(value - b[i])));
const checks = [];
try {
  let initial;
  const cases = [
    { name: 'background-only', background: 0, keys: 1 },
    { name: 'solid', background: 1, keys: 1 },
    { name: 'keys-only', background: 1, keys: 0 },
    { name: 'clear', background: 0, keys: 0 },
    { name: 'half-keys', background: 0, keys: 0.5 },
    { name: 'half-background', background: 0.5, keys: 1 },
    { name: 'both', background: 0.35, keys: 0.7 },
  ];
  for (const config of cases) {
    await setOpacity('background', config.background);
    await setOpacity('key', config.keys);
    const result = await check();
    // Capture after the native state check has focused and settled the panel;
    // React state can be visible to JS before Expo applies the prop to the
    // already-open Android native view.
    const png = capture(config.name);
    assert.equal(result.backgroundOpacity, config.background);
    assert.equal(result.keyOpacity, config.keys);
    initial ??= result.metrics;
    assert.deepEqual(result.metrics.keyFrames, initial.keyFrames);
    assert.equal(
      result.metrics.inputReloadCount,
      initial.inputReloadCount,
      'Opacity changes must not reload the focused iOS keyboard host',
    );
    checks.push({
      ...result,
      name: config.name,
      colors: colors(png, result.metrics),
    });
  }
  const samples = Object.fromEntries(
    checks.map((check) => [check.name, check.colors]),
  );
  assert(
    delta(samples['background-only'].space, samples.solid.space) < 1,
    'Background opacity changed opaque keycaps',
  );
  assert(
    delta(samples['background-only'].panel, samples.solid.panel) > 40,
    'Background slider did not change the keyboard panel',
  );
  assert(
    delta(samples['keys-only'].panel, samples.solid.panel) < 1,
    'Key opacity changed the keyboard panel',
  );
  assert(
    delta(samples['keys-only'].space, samples.solid.space) > 20,
    'Key slider did not change the space-bar fill',
  );
  assert(
    delta(samples.clear.panel, samples['half-keys'].panel) < 1,
    'Key alpha leaked into the transparent panel',
  );
  assert(
    Math.min(...samples.clear.bottom) < 220,
    'Transparent iOS input host left a white seam below the keyboard',
  );
  assert(delta(samples.clear.space, samples['half-keys'].space) > 40);
  assert(
    delta(samples['half-keys'].space, samples['background-only'].space) > 40,
  );
  assert(delta(samples['half-background'].space, samples.solid.space) < 1);
  assert(delta(samples['half-background'].panel, samples.solid.panel) > 20);
  const metrics = checks.at(-1).metrics;
  const q = metrics.keyFrames.find((key) => key.label.toLowerCase() === 'q');
  const space = spaceKey(metrics);
  assert(q && space);
  for (const key of [q, space, q])
    run('press', key.x + key.width / 2, key.y + key.height / 2);
  const typed = await check();
  const start = metrics.selectionStart;
  const end = metrics.selectionEnd;
  assert.equal(
    typed.metrics.text.toLowerCase(),
    `${metrics.text.slice(0, start)}q q${metrics.text.slice(
      end,
    )}`.toLowerCase(),
    'Space-bar input failed',
  );
  capture('space-input');
  writeFileSync(
    `${dir}/results.json`,
    JSON.stringify(
      {
        result: 'PASS',
        platform,
        checks,
        typed: typed.metrics.text,
      },
      null,
      2,
    ),
  );
  console.log(
    `${platform}: PASS independent background/key opacity, pixel isolation, space input and editor clearance`,
  );
} catch (error) {
  writeFileSync(
    `${dir}/results.json`,
    JSON.stringify(
      {
        result: 'FAIL',
        platform,
        checks,
        error: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
}
