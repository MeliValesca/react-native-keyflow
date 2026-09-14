/** Tablet-only native/custom smoke and visual suite.
 * Usage: node scripts/visual/tablets.mjs ios|android <agent-device-session> [device-id]
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const [platform, session, device] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !session)
  throw new Error('Supply ios|android and an agent-device tablet session');
if (platform === 'android' && !/^emulator-\d+$/.test(device || ''))
  throw new Error(
    'Supply the Android tablet emulator serial so Gboard can be prepared',
  );
const agent = process.env.AGENT_DEVICE || 'agent-device';
const output = resolve(`artifacts/tablets/${platform}/run-${Date.now()}`);
mkdirSync(output, { recursive: true });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const run = (...args) =>
  JSON.parse(
    execFileSync(agent, [...args.map(String), '--session', session, '--json'], {
      encoding: 'utf8',
      maxBuffer: 24 * 1024 * 1024,
    }),
  ).data;
const nodes = () => run('snapshot').nodes;
const press = (selector) => run('press', selector, '--settle');
let currentOrientation = 'portrait';
const setOrientation = async (orientation, initial = false) => {
  if (platform !== 'android' || initial) {
    run('orientation', orientation);
    currentOrientation = orientation;
    await pause(900);
    return;
  }
  if (orientation === currentOrientation) return;
  // The agent orientation command writes the final display rotation directly.
  // Emulator sensor rotation exercises Android's visible transition instead.
  const turns =
    orientation !== 'portrait' && currentOrientation !== 'portrait' ? 2 : 1;
  for (let turn = 0; turn < turns; turn++) {
    execFileSync('adb', ['-s', device, 'emu', 'rotate']);
    await pause(900);
  }
  currentOrientation = orientation;
};
const pressLayout = (label) => {
  const candidates = nodes()
    .filter((item) => item.label === label && item.rect)
    .sort(
      (a, b) =>
        Number(Boolean(b.hittable)) - Number(Boolean(a.hittable)) ||
        a.rect.width * a.rect.height - b.rect.width * b.rect.height,
    );
  const target = candidates[0];
  assert(target, `Missing tablet layout control: ${label}`);
  run('press', `@${target.ref}`, '--settle');
};
const pressKeyboardKey = (label) => {
  const target = nodes()
    .filter((item) => item.label === label && item.rect)
    .sort((a, b) => b.rect.y - a.rect.y)[0];
  assert(target, `Missing tablet keyboard key: ${label}`);
  run('press', `@${target.ref}`, '--settle');
};
const dismissNativeOverlay = () => {
  const tree = nodes();
  const cancel = tree.find(
    (item) =>
      item.label === 'Cancel' &&
      item.bundleId === 'com.google.android.inputmethod.latin',
  );
  if (cancel) press(`@${cancel.ref}`);
};
const assertAndroidNativeKeyboardVisible = (type) => {
  if (platform !== 'android') return;
  const gboard = nodes().filter(
    (item) => item.bundleId === 'com.google.android.inputmethod.latin',
  );
  const labels = new Set(gboard.map((item) => item.label));
  const expected = type === 'default' ? ['Q', 'q'] : ['1'];
  assert(
    expected.some((label) => labels.has(label)),
    'Android native mode opened without visible keys. Enable “Show on-screen keyboard” in the emulator’s physical-keyboard settings and leave Gboard in its docked keyboard mode.',
  );
};
const ensureLayoutScreen = (mode) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const tree = nodes();
    if (tree.some((item) => item.identifier === 'check-layout')) {
      const desired = mode === 'custom' ? 'Custom keyboard' : 'Native';
      const control = tree.find((item) => item.label === desired);
      if (control) press(`@${control.ref}`);
      return;
    }
    const navigationTarget = tree
      .filter((item) => item.label === 'Compare layouts & rotation')
      .sort((a, b) => Number(b.type === 'Cell') - Number(a.type === 'Cell'))[0];
    if (!navigationTarget) continue;
    const child = tree.find(
      (item) =>
        item.parentIndex === navigationTarget.index && item.type === 'Button',
    );
    press(`@${(child ?? navigationTarget).ref}`);
  }
  assert.fail('Unable to restore tablet layout screen after rotation');
};
const captures = [];
const layouts = [
  ['QWERTY', 'default'],
  ['Number', 'number-pad'],
  ['Decimal', 'decimal-pad'],
  ['Phone', 'phone-pad'],
];
const capture = (name, metrics = null) => {
  const path = `${output}/${name}.png`;
  const shot = run('screenshot', path);
  captures.push({
    name,
    path,
    width: shot.width,
    height: shot.height,
    metrics,
  });
};
const solidComponents = (path, rgb) => {
  const png = PNG.sync.read(readFileSync(path));
  const { width, height, data } = png;
  const seen = new Uint8Array(width * height);
  const matches = (pixel) =>
    data[pixel * 4] === rgb[0] &&
    data[pixel * 4 + 1] === rgb[1] &&
    data[pixel * 4 + 2] === rgb[2] &&
    data[pixel * 4 + 3] === 255;
  const result = [];
  for (let y = Math.floor(height * 0.55); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (seen[start] || !matches(start)) continue;
      const queue = [start];
      seen[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const pixel = queue[cursor];
        const px = pixel % width;
        const py = Math.floor(pixel / width);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
        for (const next of [pixel - 1, pixel + 1, pixel - width, pixel + width])
          if (
            next >= 0 &&
            next < width * height &&
            !seen[next] &&
            matches(next)
          ) {
            seen[next] = 1;
            queue.push(next);
          }
      }
      if (queue.length > 1000)
        result.push({
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        });
    }
  }
  return { png, result };
};
const assertAndroidLandscapeFaces = (orientation) => {
  if (platform !== 'android') return;
  const customPath = captures.find(
    ({ name }) => name === `${orientation}-default-keyflow`,
  )?.path;
  const nativePath = captures.find(
    ({ name }) => name === `${orientation}-default-native`,
  )?.path;
  assert(customPath && nativePath, `Missing ${orientation} QWERTY pair`);
  const custom = solidComponents(customPath, [255, 255, 255]);
  const native = solidComponents(nativePath, [255, 255, 255]);
  const keyHeight = native.result
    .map(({ height }) => height)
    .sort((a, b) => a - b)
    .at(-1);
  const faces = ({ result }) =>
    result
      .filter(({ height, width }) => height === keyHeight && width > keyHeight)
      .sort((a, b) => a.y - b.y || a.x - b.x);
  const customFaces = faces(custom);
  const nativeFaces = faces(native);
  assert.equal(
    customFaces.length,
    nativeFaces.length,
    'QWERTY face count differs',
  );
  customFaces.forEach((face, index) => {
    const reference = nativeFaces[index];
    for (const property of ['x', 'y', 'width', 'height'])
      assert(
        Math.abs(face[property] - reference[property]) <= 1,
        `${orientation} face ${index} ${property}: ${face[property]} vs ${reference[property]}`,
      );
  });
  const topSpan = ({ png }, face) => {
    let count = 0;
    for (let x = face.x; x < face.x + face.width; x++) {
      const offset = (face.y * png.width + x) * 4;
      if (
        png.data[offset] === 255 &&
        png.data[offset + 1] === 255 &&
        png.data[offset + 2] === 255
      )
        count++;
    }
    return count;
  };
  assert.equal(
    topSpan(custom, customFaces[0]),
    topSpan(native, nativeFaces[0]),
    `${orientation} default corner radius differs`,
  );
};
const readMetrics = async () => {
  const tree = nodes();
  const button = tree.find((item) => item.identifier === 'check-layout');
  assert(button, 'Missing layout diagnostics');
  // iPadOS may center a resizable app window while its keyboard spans the
  // display. XCTest reports app-local rectangles, so derive the window offset
  // from the current screenshot instead of assuming a device coordinate.
  const size = run('screenshot', `${output}/.viewport.png`);
  const root = tree
    .map((item) => item.rect)
    .filter(Boolean)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  run(
    'press',
    button.rect.x + button.rect.width / 2 + (size.width - root.width) / 2,
    button.rect.y + button.rect.height / 2 + (size.height - root.height) / 2,
    '--settle',
  );
  await pause(250);
  const node = nodes().find((item) => item.identifier === 'check-layout');
  assert(node, 'Missing layout diagnostics');
  const jsonStart = node.label.indexOf('{');
  assert(jsonStart >= 0, 'Layout diagnostics did not update');
  const metrics = JSON.parse(node.label.slice(jsonStart));
  assert.deepEqual(metrics.failures, []);
  assert.equal(metrics.focused, true);
  assert(
    metrics.width >= 600,
    `Expected tablet keyboard width, got ${metrics.width}`,
  );
  const keyHeights = metrics.keyFrames
    .map((frame) => frame.height)
    .sort((a, b) => a - b);
  const medianKeyHeight = keyHeights[Math.floor(keyHeights.length / 2)];
  assert(medianKeyHeight > 0, 'Tablet keys must have measurable height');
  assert(
    metrics.height >= medianKeyHeight * 4,
    `Keyboard frame does not contain four rows: ${metrics.height}`,
  );
  const labels = new Set(metrics.keyFrames.map((frame) => frame.label));
  for (const unsupported of ['Emoji', 'Dictate', 'Microphone'])
    assert(
      !labels.has(unsupported),
      `Unsupported tablet control rendered: ${unsupported}`,
    );
  if (platform === 'ios' && metrics.keyboardType === 'default') {
    for (const required of ['Tab', 'Caps Lock', 'Delete', 'return', '123'])
      assert(labels.has(required), `Missing native iPad key: ${required}`);
    assert.equal(
      metrics.keyFrames.filter((frame) => frame.label === 'Shift').length,
      2,
      'The iPad layout requires both Shift keys',
    );
  }
  if (platform === 'android' && metrics.keyboardType === 'default') {
    for (const required of ['Tab', 'Caps Lock', 'Delete', 'Submit'])
      assert(
        labels.has(required),
        `Missing native Android tablet key: ${required}`,
      );
    if (metrics.keyboardPage === 'letters') {
      assert(labels.has('?123'), 'The letters page requires ?123');
      assert.equal(
        metrics.keyFrames.filter((frame) => frame.label === 'Shift').length,
        2,
        'The Android tablet letters page requires both Shift keys',
      );
    } else {
      assert(labels.has('ABC'), `${metrics.keyboardPage} requires ABC`);
      assert(
        labels.has(metrics.keyboardPage === 'numbers' ? '=\\<' : '?123'),
        `Missing ${metrics.keyboardPage} page switch`,
      );
    }
  }
  return metrics;
};

let result = 'FAIL';
let error;
try {
  if (platform === 'android') {
    execFileSync(
      process.execPath,
      ['scripts/prepare-android-reference.mjs', device],
      { stdio: 'inherit' },
    );
  }
  await setOrientation('portrait', true);
  const viewport = run('screenshot', `${output}/.initial-viewport.png`);
  assert(
    viewport.width >= 600,
    `Expected tablet viewport, got ${viewport.width}`,
  );
  ensureLayoutScreen('custom');
  for (const orientation of ['portrait', 'landscape-left', 'landscape-right']) {
    await setOrientation(orientation);
    ensureLayoutScreen('custom');
    dismissNativeOverlay();
    for (const [label, type] of layouts) {
      // Rotation can briefly recreate the navigation tree on iPadOS. Restore
      // the fixture before every independent case, not only per orientation.
      ensureLayoutScreen('custom');
      dismissNativeOverlay();
      // Each case establishes its own layout so a prior run or interrupted
      // rotation cannot leak the last selected pad into this assertion.
      pressLayout(label);
      await pause(350);
      const metrics = await readMetrics();
      assert.equal(metrics.landscape, orientation !== 'portrait');
      assert.equal(metrics.keyboardType, type);
      assert(
        metrics.keyFrames.length >= (type === 'default' ? 30 : 10),
        `Incomplete ${type} layout`,
      );
      if (type !== 'default')
        for (const digit of '0123456789')
          assert(
            metrics.keyFrames.some((frame) => frame.label === digit),
            `${type} is missing ${digit}`,
          );
      capture(`${orientation}-${type}-keyflow`, metrics);
      if (platform === 'android' && type === 'default') {
        pressKeyboardKey('?123');
        await pause(150);
        const numbers = await readMetrics();
        assert.equal(numbers.keyboardPage, 'numbers');
        capture(`${orientation}-default-numbers-keyflow`, numbers);
        pressKeyboardKey('=\\<');
        await pause(150);
        const symbols = await readMetrics();
        assert.equal(symbols.keyboardPage, 'symbols');
        capture(`${orientation}-default-symbols-keyflow`, symbols);
        pressKeyboardKey('ABC');
      }
    }
  }
  // Switch modes in portrait. Native iPad keyboard accessibility rectangles
  // are transposed in landscape on current Simulator runtimes.
  await setOrientation('portrait');
  ensureLayoutScreen('system');
  await pause(700);
  for (const orientation of ['portrait', 'landscape-left', 'landscape-right']) {
    await setOrientation(orientation);
    ensureLayoutScreen('system');
    dismissNativeOverlay();
    for (const [label, type] of layouts) {
      dismissNativeOverlay();
      pressLayout(label);
      await pause(350);
      assertAndroidNativeKeyboardVisible(type);
      capture(`${orientation}-${type}-native`);
    }
  }
  assertAndroidLandscapeFaces('landscape-left');
  assertAndroidLandscapeFaces('landscape-right');
  result = 'PASS';
} catch (caught) {
  error = caught instanceof Error ? caught.stack : String(caught);
  throw caught;
} finally {
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ platform, session, result, error, captures }, null, 2),
  );
  console.log(
    `${result}: tablet layouts, bounds, rotation and native/custom captures (${output})`,
  );
}
