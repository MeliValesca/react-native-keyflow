/** Run from the example's Native interaction tests screen, with Metro running.
 * AGENT_DEVICE=/path/to/agent-device node scripts/compare-native-interactions.mjs ios keyflow
 * Uses real touch events against both keyboards in the same native editor.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { resolve } from 'node:path';
const [platform, session] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !session)
  throw new Error('Supply ios|android and an existing agent-device session');
const bin = process.env.AGENT_DEVICE || 'agent-device';
const out = resolve(`artifacts/native-parity/${platform}`);
mkdirSync(out, { recursive: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let activeMode = 'native';
// UIAutomator omits the non-focusable custom PopupWindow. These touch points
// are measured from the 411x914 screenshot fixture; reject any other viewport.
const androidPoints = {
  Delete: [377, 794],
  E: [102, 677],
  Letters: [28, 864],
  Shift: [31, 794],
  space: [225, 854],
  numbers: [28, 854],
  symbols: [31, 794],
  1: [22, 677],
  2: [62, 677],
  '@': [22, 735],
};
for (const [row, labels] of ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].entries()) {
  for (const [column, label] of [...labels].entries()) {
    androidPoints[label] = [
      (row === 0 ? 22 : row === 1 ? 43 : 82) + column * 40.7,
      [677, 735, 794][row],
    ];
  }
}
const fallbackPoint = (label) => {
  if (
    platform !== 'android' ||
    activeMode !== 'custom' ||
    !(androidPoints[label] || androidPoints[label.toLowerCase()])
  )
    return null;
  const path = `${out}/viewport.png`;
  run('screenshot', path);
  const { width, height } = PNG.sync.read(readFileSync(path));
  if (width !== 411 || height !== 914)
    throw new Error(
      `Android coordinate fixture requires 411x914, received ${width}x${height}`,
    );
  return androidPoints[label] || androidPoints[label.toLowerCase()];
};
const run = (...args) => {
  let raw;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      raw = execFileSync(
        bin,
        [...args.map(String), '--session', session, '--json'],
        { encoding: 'utf8', timeout: 35000 },
      );
      break;
    } catch (error) {
      // Retry only reads. Replaying a touch could insert duplicate characters.
      if (args[0] !== 'snapshot' || attempt === 2) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
    }
  }
  const response = JSON.parse(raw);
  if (!response.success) throw new Error(JSON.stringify(response.error));
  return response.data;
};
const snapshot = () => run('snapshot').nodes;
const press = (label, keyboard = false, hold = 0, double = false) => {
  if (label === 'Letters' && platform === 'ios') label = 'ABC';
  const aliases = {
    Shift: [
      'shift',
      'Shift on',
      'Shift off',
      'Caps lock on',
      'Shift enabled',
      'Shift disabled',
      'Shift locked',
      'Caps lock enabled',
    ],
    space: ['Space', 'English (US)', ' '],
    numbers: ['123', '?123', 'Symbols', 'Symbol keyboard'],
    symbols: ['#+=', '=\\<', 'More symbols'],
  };
  const findMatches = () =>
    snapshot().filter(
      (n) =>
        (n.label === label ||
          aliases[label]?.includes(n.label) ||
          (/^[a-z]$/i.test(label) &&
            n.label?.toLowerCase() === label.toLowerCase())) &&
        n.rect?.width > 0 &&
        (!keyboard || n.rect.y >= (platform === 'android' ? 650 : 580)) &&
        (label !== 'Keyflow' || n.rect.y > 85),
    );
  if (platform === 'android' && activeMode === 'custom') {
    const point = fallbackPoint(label);
    if (point)
      return run(
        hold ? 'longpress' : 'press',
        ...point,
        ...(hold ? [hold] : []),
        ...(double ? ['--double-tap'] : []),
      );
  }
  let matches = findMatches();
  for (let attempt = 0; !matches.length && attempt < 8; attempt++) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    matches = findMatches();
  }
  const node =
    matches.find((n) => /button|key|group/i.test(n.type)) || matches[0];
  if (!node) {
    const point = fallbackPoint(label);
    if (point)
      return run(
        hold ? 'longpress' : 'press',
        ...point,
        ...(hold ? [hold] : []),
        ...(double ? ['--double-tap'] : []),
      );
    throw new Error(`Missing ${label}`);
  }
  return run(
    hold ? 'longpress' : 'press',
    `@${node.ref}`,
    ...(hold ? [hold] : []),
    ...(double ? ['--double-tap'] : []),
  );
};
const value = () => {
  const field = snapshot().find(
    (n) =>
      (n.editable || /TextField|EditText/.test(n.type)) &&
      n.bundleId !== 'com.google.android.inputmethod.latin' &&
      true,
  );
  if (!field) throw new Error('Test editor missing');
  return field.hintShowing || field.value === 'Start typing…' || !field.value
    ? ''
    : field.value;
};
const results = [];
const check = (name, expected) => {
  const actual = value();
  if (actual !== expected)
    throw new Error(
      `${name}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(
        actual,
      )}`,
    );
  const screenshot = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  run('screenshot', `${out}/${screenshot}`);
  results.push({ name, expected, actual, pass: true, screenshot });
  console.log(`PASS ${name}`);
};
const capture = (name) => run('screenshot', `${out}/${name}.png`);
try {
  for (const mode of ['native', 'custom']) {
    activeMode = mode;
    press(
      mode === 'custom'
        ? 'Keyflow'
        : platform === 'ios'
        ? 'Apple native'
        : 'Android native',
    );
    await pause(900);
    // Independent fixtures: never let a previous assertion seed the next case.
    const reset = async () => {
      press('Reset Empty');
      await pause(750);
    };
    press('Reset Cursor');
    await pause(750);
    press('q', true);
    check(`${mode}: initial text uses cursor capitalization`, 'alpha betaq');
    await reset();
    press('q', true);
    press('w', true);
    check(`${mode}: initial capitalization and lowercase after typing`, 'Qw');
    press('Shift', true);
    press('e', true);
    press('r', true);
    check(`${mode}: one-shot shift`, 'QwEr');
    await reset();
    press('Shift', true, 0, true);
    press('h', true);
    press('h', true);
    check(`${mode}: double-shift caps lock`, 'HH');
    press('Shift', true);
    press('h', true);
    check(`${mode}: caps lock release`, 'HHh');
    await reset();
    press('h', true);
    press('i', true);
    press('space', true, 0, true);
    check(`${mode}: double-space period`, 'Hi. ');
    press('q', true);
    check(`${mode}: sentence capitalization`, 'Hi. Q');
    await reset();
    press('numbers', true);
    press('1', true);
    press('2', true);
    check(`${mode}: numeric page`, '12');
    press('space', true);
    press('q', true);
    check(`${mode}: space returns to letters`, '12 q');
    const del = platform === 'ios' && mode === 'native' ? 'delete' : 'Delete';
    for (const seed of ['Grapheme', 'Tone']) {
      press(`Reset ${seed}`);
      await pause(750);
      press(del, true);
      await pause(150);
      check(`${mode}: delete ${seed} as one grapheme`, 'A');
      press(del, true);
      check(`${mode}: delete preceding letter`, '');
    }
    press('Reset Repeat');
    await pause(700);
    press(del, true, 2100);
    await pause(100);
    const afterHold = value();
    if (afterHold.length >= 15 || !'abcdefghijklmnop'.startsWith(afterHold))
      throw new Error(`Held delete did not repeat: ${afterHold}`);
    await pause(400);
    check(`${mode}: held delete repeats and stops on release`, afterHold);
    results[results.length - 1].removedDuringHold = 16 - afterHold.length;
    if (afterHold) press(del, true, 4500);
    check(`${mode}: continued held delete clears text`, '');
    press('Reset Empty');
    await pause(700);
    capture(`${mode}-letters`);
    // A held E releases its base on Apple and its number hint on Gboard.
    const nodes = snapshot();
    const e = nodes.find(
      (n) => ['e', 'E'].includes(n.label) && n.rect?.y > 450,
    );
    if (!e && !fallbackPoint('E')) throw new Error('E key is missing');
    if (e) run('longpress', `@${e.ref}`, 700);
    else run('longpress', ...androidPoints.E, 700);
    await pause(150);
    check(`${mode}: held E release`, platform === 'ios' ? e.label : '3');
    press('Reset Empty');
    await pause(700);
  }
  press('Reset Cursor');
  await pause(700);
  press('Run switching checks');
  await pause(11000);
  const diagnostic = snapshot().find(
    (n) =>
      n.identifier === 'interaction-state' ||
      n.label?.startsWith('Diagnostic state:'),
  )?.label;
  if (!diagnostic || !diagnostic.includes('"result":"PASS"'))
    throw new Error(`Switching checks did not pass: ${diagnostic}`);
  capture('switching-result');
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        result: 'PASS',
        platform,
        checks: results.length,
        results,
        note: 'Switching result is independently reported by KEYFLOW_SWITCH_TEST. Visual screenshots require comparison; functional PASS does not claim pixel parity.',
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${results.length} functional comparisons. Evidence: ${out}`,
  );
} catch (error) {
  try {
    capture('failure');
  } catch {}
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      { result: 'FAIL', platform, results, error: String(error) },
      null,
      2,
    ),
  );
  throw error;
}
