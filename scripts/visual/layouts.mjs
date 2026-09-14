import { preserveRotationSettings } from './rotation-settings.mjs';
/** Start on Layouts & rotation. Real touches; no text injection or automatic baseline approval. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const [platform, session, startAt] = process.argv.slice(2);
const orientations = ['portrait', 'landscape-left', 'landscape-right'];
const layoutTypes = [
  ['QWERTY', 'default'],
  ['Number', 'number-pad'],
  ['Decimal', 'decimal-pad'],
  ['Phone', 'phone-pad'],
];
const scenarioOrder = orientations.flatMap((orientation) =>
  layoutTypes.map(([, type]) => `${orientation}/${type}`),
);
if (startAt && !scenarioOrder.includes(startAt))
  throw new Error('Invalid starting scenario');
if (!['ios', 'android'].includes(platform) || !session)
  throw new Error('Supply ios|android and agent-device session');
const agent = process.env.AGENT_DEVICE || 'agent-device';
const output = resolve(`artifacts/layouts/${platform}/run-${Date.now()}`);
mkdirSync(output, { recursive: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (...args) =>
  JSON.parse(
    execFileSync(agent, [...args.map(String), '--session', session, '--json'], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }),
  ).data;
const snapshot = () => run('snapshot').nodes;
const press = (label) =>
  run(
    'press',
    label === 'Check layout'
      ? 'id="check-layout"'
      : `label=${JSON.stringify(
          label === 'Keyflow' ? 'Custom keyboard' : label,
        )}`,
    '--settle',
  );
let mode = 'custom';
let metrics;
const checks = [];
const captures = [];
const inspect = async () => {
  press('Check layout');
  await pause(200);
  const state = snapshot().find((n) => n.identifier === 'check-layout');
  assert(state, 'Missing diagnostic state');
  const raw = state.label;
  metrics = JSON.parse(raw.slice(raw.indexOf('{')));
  assert.deepEqual(metrics.failures, [], 'Layout violations');
  assert.equal(metrics.focused, true, 'Focus lost');
  return metrics;
};
const text = async () => {
  const field = snapshot().find(
    (n) => n.label === 'Layout input' || n.type?.includes('EditText'),
  );
  assert(field, 'Missing editor');
  const value = field.value === 'Try this layout…' ? '' : field.value ?? '';
  metrics = { ...metrics, text: value };
  return value;
};
const touchKey = (labels, hold = 0) => {
  const nodes = snapshot();
  // Apple's remote keyboard AX rectangles are rotated and clipped to 402pt in
  // landscape on this simulator. The app tree remains correct. Use the measured
  // iPhone 17 layout only for that broken native surface; assert the viewport.
  if (platform === 'ios' && mode === 'custom' && metrics.landscape) {
    assert.equal(nodes[0].rect.width, 874);
    assert.equal(nodes[0].rect.height, 402);
    const key = metrics.keyFrames.find((k) => labels.includes(k.label));
    assert(key, `Missing custom landscape key ${labels}`);
    run(
      hold ? 'longpress' : 'press',
      key.x + key.width / 2,
      key.y + key.height / 2,
      ...(hold ? [hold] : []),
    );
    return;
  }
  if (platform === 'ios' && mode === 'system' && metrics.landscape) {
    assert.equal(nodes[0].rect.width, 874);
    assert.equal(nodes[0].rect.height, 402);
    let point;
    if (metrics.keyboardType === 'default') {
      point = labels.some((l) => l.toLowerCase() === 'h')
        ? [510, 296]
        : labels.some((l) => l.toLowerCase() === 'i')
        ? [618, 261]
        : labels.some((l) => l.toLowerCase() === 'delete')
        ? [750, 331]
        : undefined;
    } else {
      const digit = labels.find((l) => /^[0-9]$/.test(l));
      if (digit) {
        const n = Number(digit);
        point =
          n === 0
            ? [437, 363]
            : [197 + ((n - 1) % 3) * 239.5, 258 + Math.floor((n - 1) / 3) * 35];
      } else if (labels.includes('pause')) point = [197, 293];
      else if (labels.includes('wait')) point = [676, 293];
      else if (labels.includes('+')) point = [437, 363];
      else if (labels.some((l) => l.toLowerCase() === 'delete'))
        point = [676, 363];
      else if (
        labels.some((l) => ['Shift', '123', '+*#', '.', ','].includes(l))
      )
        point = [197, 363];
    }
    assert(point, `Uncalibrated Apple landscape target ${labels}`);
    run(hold ? 'longpress' : 'press', ...point, ...(hold ? [hold] : []));
    return;
  }
  const field = nodes.find(
    (n) => n.label === 'Layout input' || n.type?.includes('EditText'),
  );
  const candidates = nodes.filter(
    (n) =>
      labels.includes(n.label) &&
      n.rect?.y >= (field?.rect?.y ?? 100) + (field?.rect?.height ?? 44),
  );
  const node = candidates.sort((a, b) => b.rect.y - a.rect.y)[0];
  if (node)
    run(
      hold ? 'longpress' : 'press',
      `label=${JSON.stringify(node.label)}`,
      ...(hold ? [hold] : []),
    );
  else {
    assert.equal(mode, 'custom', `Missing native key ${labels}`);
    const key = metrics?.keyFrames?.find((k) => labels.includes(k.label));
    assert(key, `Missing custom key ${labels}`);
    // Use actual reported screen-space target only after AX has no key.
    run(
      hold ? 'longpress' : 'press',
      key.x + key.width / 2,
      key.y + key.height / 2,
      ...(hold ? [hold] : []),
    );
  }
};
const capture = (name) => {
  const path = `${output}/${name}.png`;
  run('screenshot', path);
  captures.push({ name, path, metrics });
};
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name);
  checks.push(name);
  console.log(`PASS ${name}`);
};
const restoreRotation = preserveRotationSettings(platform, session);
let result = 'FAIL',
  error;
try {
  run('orientation', 'portrait');
  await pause(1000);
  const nodes = snapshot();
  if (nodes.some((n) => n.label === 'Compare layouts & rotation'))
    press('Compare layouts & rotation');
  for (const orientation of ['portrait', 'landscape-left', 'landscape-right']) {
    run('orientation', orientation);
    await pause(1000);
    for (const [label, type] of layoutTypes) {
      if (
        startAt &&
        scenarioOrder.indexOf(`${orientation}/${type}`) <
          scenarioOrder.indexOf(startAt)
      )
        continue;
      press(label);
      await pause(700);
      for (const nextMode of ['system', 'custom']) {
        mode = nextMode;
        press(mode === 'system' ? 'Native' : 'Keyflow');
        await pause(900);
        await inspect();
        const prefix = `${orientation}-${type}-${mode}`;
        const before = metrics.text;
        if (
          type === 'phone-pad' &&
          platform === 'ios' &&
          orientation === 'portrait' &&
          mode === 'system' &&
          !snapshot().some((n) => n.label === '0')
        ) {
          touchKey(['Shift']);
          await pause(300);
        }
        await inspect();
        capture(`${prefix}-idle`);
        if (mode === 'custom') {
          check(
            `${prefix} orientation`,
            metrics.landscape,
            orientation !== 'portrait',
          );
          check(`${prefix} type`, metrics.keyboardType, type);
          assert(metrics.width > 0 && metrics.height > 0);
          assert(metrics.height < (orientation === 'portrait' ? 400 : 250));
          if (type !== 'default')
            for (const digit of '0123456789')
              assert(
                metrics.keyFrames.some((k) => k.label === digit),
                `Missing ${digit}`,
              );
        }
        const sequence = type === 'default' ? 'hi' : '1234567890';
        for (const char of sequence) touchKey([char, char.toUpperCase()]);
        const expected =
          before + (type === 'default' && !before ? 'Hi' : sequence);
        check(`${prefix} typing`, await text(), expected);
        touchKey(['Delete', 'delete']);
        check(`${prefix} delete`, await text(), expected.slice(0, -1));
        if (type === 'decimal-pad') {
          const prior = metrics.text;
          touchKey(['.', ',', 'Period']);
          const current = await text();
          assert(current === prior + '.' || current === prior + ',');
          checks.push(`${prefix} decimal separator`);
        }
        if (type === 'phone-pad') {
          const prior = metrics.text;
          touchKey(['0'], 800);
          check(
            `${prefix} hold zero`,
            await text(),
            prior + (platform === 'ios' ? '0' : '+'),
          );
          if (platform === 'android') {
            touchKey(['Symbol keyboard', '* #']);
            await pause(300);
            await inspect();
            capture(`${prefix}-phone-symbols`);
            touchKey(['Plus', '+']);
            check(`${prefix} phone plus`, await text(), prior + '++');
            touchKey(['Pause']);
            check(`${prefix} phone pause`, await text(), prior + '++,');
            touchKey(['Wait']);
            check(`${prefix} phone wait`, await text(), prior + '++,;');
            touchKey(['Dial keyboard', '123']);
            await pause(300);
            await inspect();
          }
          if (platform === 'ios') {
            touchKey(['Shift', '+*#']);
            await pause(300);
            await inspect();
            capture(`${prefix}-phone-symbols`);
            touchKey(['+']);
            check(`${prefix} phone plus`, await text(), prior + '0+');
            await inspect();
            touchKey(['Shift', '+*#']);
            await pause(300);
            await inspect();
            touchKey([',', 'pause']);
            check(`${prefix} phone pause`, await text(), prior + '0+,');
            await inspect();
            touchKey(['Shift', '+*#']);
            await pause(300);
            await inspect();
            touchKey([';', 'wait']);
            check(`${prefix} phone wait`, await text(), prior + '0+,;');
            await pause(300);
            await inspect();
            if (mode === 'custom')
              check(
                `${prefix} phone symbols return to digits`,
                metrics.keyboardPage,
                'letters',
              );
          }
        }
        capture(`${prefix}-typed`);
        touchKey(['Delete', 'delete'], 2400);
        check(`${prefix} held delete clears`, await text(), '');
        touchKey(type === 'default' ? ['h', 'H'] : ['1']);
        await pause(800);
        check(
          `${prefix} delete stops on release`,
          await text(),
          type === 'default' ? 'H' : '1',
        );
        touchKey(['Delete', 'delete']);
        await inspect();
      }
    }
  }
  // Rotation and layout changes on the same focused editor preserve text/caret.
  mode = 'custom';
  press('Number');
  await pause(600);
  await inspect();
  touchKey(['1']);
  touchKey(['2']);
  await inspect();
  const selection = [metrics.selectionStart, metrics.selectionEnd];
  for (const orientation of ['portrait', 'landscape-left', 'portrait']) {
    run('orientation', orientation);
    await pause(900);
    await inspect();
    check(`rotate ${orientation} preserves text`, metrics.text, '12');
    check(
      `rotate ${orientation} preserves selection`,
      [metrics.selectionStart, metrics.selectionEnd],
      selection,
    );
  }
  for (const label of ['Decimal', 'Phone', 'QWERTY', 'Number']) {
    press(label);
    await pause(600);
    check(`switch ${label} preserves text`, await text(), '12');
  }
  result = 'PASS';
} catch (e) {
  error = String(e.stack || e);
  console.error(error);
  try {
    capture('failure');
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
    session,
    startAt,
    completedAt: new Date().toISOString(),
    checks,
    captures,
    error,
    scope:
      'Phone layouts, both landscape directions, real typing/holds, rotation and same-editor type changes. Screenshots require visual review.',
  };
  writeFileSync(`${output}/results.json`, JSON.stringify(report, null, 2));
  writeFileSync(
    resolve(`artifacts/layouts/${platform}/latest.json`),
    JSON.stringify({ result, output }, null, 2),
  );
  console.log(`${result}: ${checks.length} checks; ${output}`);
  if (result !== 'PASS') process.exitCode = 1;
}
