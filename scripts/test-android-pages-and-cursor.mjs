/** Independent symbol, cursor and submit comparisons on the Interaction screen.
 * AGENT_DEVICE=/path/to/agent-device node scripts/test-android-pages-and-cursor.mjs android session
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const [platform, session] = process.argv.slice(2);
if (platform !== 'android' || !session)
  throw new Error(
    'Supply android and session; iOS continuous gestures use scripts/ios-tests instead.',
  );
const bin = process.env.AGENT_DEVICE || 'agent-device';
const dir = `artifacts/native-parity/${platform}`;
mkdirSync(dir, { recursive: true });
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
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nodes = () => run('snapshot').nodes;
const control = (label) => {
  const node = nodes().find(
    (n) => n.label === label && n.rect?.y > 90 && n.rect?.y < 450,
  );
  if (!node) throw new Error(`Missing control ${label}`);
  run('press', `@${node.ref}`);
};
const readText = () => {
  const field = nodes().find(
    (n) =>
      (n.editable || /TextField|EditText/.test(n.type)) &&
      n.bundleId !== 'com.google.android.inputmethod.latin',
  );
  if (!field) throw new Error('Editor missing');
  return field.hintShowing || field.value === 'Start typing…'
    ? ''
    : field.value || '';
};
const points = {
  page: [30, 854],
  more: [30, 794],
  first: [22, 677],
  space: [225, 854],
  submit: [377, 854],
  x: [123, 794],
};
const expected = {};
const results = [];
const check = (mode, name, actual, fixed) => {
  if (mode === 'native') expected[name] = fixed ?? actual;
  const wanted = fixed ?? expected[name];
  const result = {
    mode,
    name,
    expected: wanted,
    actual,
    pass: actual === wanted,
    screenshot: `${mode}-${name
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()}.png`,
  };
  run('screenshot', `${dir}/${result.screenshot}`);
  results.push(result);
  if (!result.pass) throw new Error(JSON.stringify(result));
  console.log('PASS', mode, name, JSON.stringify(actual));
};
try {
  run('screenshot', `${dir}/gesture-viewport.png`);
  const png = PNG.sync.read(readFileSync(`${dir}/gesture-viewport.png`));
  if (png.width !== 411 || png.height !== 914)
    throw new Error('Wrong reference viewport');
  for (const mode of ['native', 'custom']) {
    control(mode === 'custom' ? 'Keyflow' : 'Android native');
    await pause(900);
    control('Reset Empty');
    await pause(800);
    run('press', ...points.page);
    await pause(250);
    run('press', ...points.more);
    await pause(250);
    run('screenshot', `${dir}/${mode}-symbols.png`);
    run('press', ...points.first);
    await pause(200);
    check(mode, 'secondary symbol page', readText(), '~');
    run('press', ...points.page);
    await pause(250);
    run('press', ...points.first);
    await pause(200);
    check(mode, 'ABC restores letters', readText(), '~q');
    control('Reset Cursor');
    await pause(800);
    run('gesture', 'pan', ...points.space, -180, 0, 500);
    await pause(250);
    check(
      mode,
      'cursor gesture does not insert space',
      readText(),
      'alpha beta',
    );
    run('press', ...points.x);
    await pause(250);
    const moved = readText();
    if (mode === 'native' && !/^[Xx]alpha beta$/.test(moved))
      throw new Error(`Native cursor did not reach start: ${moved}`);
    check(mode, 'cursor gesture insertion position and case', moved);
    control('Reset Cursor');
    await pause(800);
    run('press', ...points.submit);
    await pause(900);
    check(mode, 'submit preserves text', readText(), 'alpha beta');
    control('Inspect keyboard state');
    await pause(300);
    const diagnostic = nodes().find(
      (n) =>
        n.identifier === 'interaction-state' ||
        n.label?.startsWith('Diagnostic state:'),
    )?.label;
    if (!diagnostic) throw new Error('Submit diagnostic missing');
    const metrics = JSON.parse(diagnostic.replace(/^Diagnostic state:/, ''));
    check(mode, 'submit resigns focus', metrics.focused, false);
  }
  writeFileSync(
    `${dir}/gesture-results.json`,
    JSON.stringify({ result: 'PASS', results }, null, 2),
  );
} catch (error) {
  run('screenshot', `${dir}/gesture-failure.png`);
  writeFileSync(
    `${dir}/gesture-results.json`,
    JSON.stringify({ result: 'FAIL', results, error: String(error) }, null, 2),
  );
  throw error;
}
