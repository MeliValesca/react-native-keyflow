/** Run on the example home/language screen; uses actual key touches, never text injection. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { preserveRotationSettings } from './rotation-settings.mjs';
const [platform, session] = process.argv.slice(2);
assert(
  ['ios', 'android'].includes(platform) && session,
  'Supply ios|android and session',
);
const output = resolve(
  `artifacts/latin-languages/${platform}/run-${Date.now()}`,
);
mkdirSync(output, { recursive: true });
const run = (...args) =>
  JSON.parse(
    execFileSync(
      process.env.AGENT_DEVICE || 'agent-device',
      [...args.map(String), '--session', session, '--json'],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    ),
  ).data;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const nodes = () => run('snapshot').nodes;
const control = (label) =>
  run('press', `label=${JSON.stringify(label)}`, '--settle');
let state;
const inspect = async () => {
  run('press', 'id="check-language"', '--settle');
  await pause(150);
  const snapshot = nodes();
  const node = snapshot.find(
    (n) =>
      n.identifier === 'check-language' ||
      n.label?.startsWith('Check language:'),
  );
  assert(node, 'Language inspector is accessible');
  state = JSON.parse(node.label.slice(node.label.indexOf('{')));
  writeFileSync(`${output}/last-state.json`, JSON.stringify(state, null, 2));
  if (state.keyboardMode === 'custom')
    assert(
      !snapshot.some((n) => /^(Complete |Replace with )/.test(n.label ?? '')),
      'No custom word suggestions are visible',
    );
  assert(state.focused, 'Editor stays focused');
  assert.deepEqual(state.violations, [], 'No key overflow or overlap');
  return state;
};
const touch = (label, hold = 0) => {
  const key = state.keyFrames.find(
    (k) => k.label.toLowerCase() === label.toLowerCase(),
  );
  assert(key, `Key is present: ${label}`);
  run(
    hold ? 'longpress' : 'press',
    key.x + key.width / 2,
    key.y + key.height / 2,
    ...(hold ? [hold] : []),
  );
};
const checks = [],
  captures = [];
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name);
  checks.push(name);
};
const capture = (name) => {
  const path = `${output}/${name}.png`;
  run('screenshot', path);
  captures.push({ name, path });
};
const restoreRotation = preserveRotationSettings(platform, session);
let result = 'FAIL',
  error;
try {
  run('orientation', 'portrait');
  await pause(700);
  for (
    let attempt = 0;
    attempt < 3 &&
    !nodes().some((n) => n.label === 'English & French keyboards');
    attempt++
  ) {
    run('back');
    await pause(700);
  }
  control('English & French keyboards');
  await pause(700);
  const field = nodes().find(
    (n) => n.label === 'Language input' || n.type?.includes('EditText'),
  );
  assert(field, 'Example editor exists');
  run('press', `@${field.ref}`, '--settle');
  await pause(700);
  await inspect();
  check('Explicit supported languages', state.availableKeyboardLanguages, [
    'en',
    'fr',
  ]);
  check('English default', state.keyboardLanguage, 'en');
  check('Initial text', state.text, '');
  for (const letter of 'hello') touch(letter);
  await inspect();
  check('Sentence capitalization', state.text, 'Hello');
  const caret = state.selectionStart;
  touch('Next language');
  await inspect();
  check('French selected', state.keyboardLanguage, 'fr');
  check('French template', state.keyboardLayout, 'azerty');
  check('Switch preserves text', state.text, 'Hello');
  check('Switch preserves cursor', state.selectionStart, caret);
  const top = state.keyFrames
    .filter((k) => /^[a-z]$/i.test(k.label))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, 10)
    .map((k) => k.label.toLowerCase())
    .join('');
  check('AZERTY first row', top, 'azertyuiop');
  touch(platform === 'ios' ? 'space' : '');
  for (const letter of 'bonjour') touch(letter);
  await inspect();
  check('French typing', state.text, 'Hello bonjour');
  capture('french-azerty');
  touch('c', 700);
  await inspect();
  if (platform === 'ios') {
    assert(
      state.lastAccentChoices.includes('ç'),
      'French cedilla is available',
    );
    check('Accent row fits', state.lastAccentViolations, []);
    check('Held base letter inserts once', state.text, 'Hello bonjourc');
  } else check('Held cedilla inserts once', state.text, 'Hello bonjourç');
  touch('Delete');
  await inspect();
  check('Delete removes held character', state.text, 'Hello bonjour');
  touch(platform === 'ios' ? '123' : '?123');
  await inspect();
  touch('1');
  await inspect();
  check('French number page', state.text, 'Hello bonjour1');
  touch('€');
  await inspect();
  check('French currency key', state.text, 'Hello bonjour1€');
  capture('french-number-page');
  touch('Delete');
  await inspect();
  touch('ABC');
  await inspect();
  control('French QWERTY');
  await inspect();
  check('Explicit French QWERTY', state.keyboardLayout, 'qwerty');
  check('Layout override keeps French language', state.keyboardLanguage, 'fr');
  check('Layout override preserves text', state.text, 'Hello bonjour1');
  capture('french-qwerty');
  control('French AZERTY');
  await inspect();
  for (const orientation of ['landscape-left', 'landscape-right', 'portrait']) {
    const before = { text: state.text, cursor: state.selectionStart };
    run('orientation', orientation);
    await pause(1000);
    await inspect();
    check(
      `${orientation} geometry`,
      state.landscape,
      orientation !== 'portrait',
    );
    check(`${orientation} preserves text`, state.text, before.text);
    check(
      `${orientation} preserves cursor`,
      state.selectionStart,
      before.cursor,
    );
    touch('a');
    await inspect();
    check(`${orientation} typing`, state.text, before.text + 'a');
    touch('Delete');
    await inspect();
    capture(`french-${orientation}`);
  }
  for (let pass = 0; pass < 2; pass++) {
    const before = state.text;
    control('Native');
    await pause(700);
    await inspect();
    check(`Native handoff ${pass}`, state.keyboardMode, 'system');
    if (platform === 'android')
      check(
        `Real Android IME visible ${pass}`,
        state.systemKeyboardVisible,
        true,
      );
    check(`Native handoff text ${pass}`, state.text, before);
    capture(`native-handoff-${pass}`);
    control('Custom keyboard');
    await pause(700);
    await inspect();
    check(`Custom handoff ${pass}`, state.keyboardMode, 'custom');
    check(`Custom handoff text ${pass}`, state.text, before);
    check(
      `Custom handoff restores French ${pass}`,
      state.keyboardLanguage,
      'fr',
    );
  }
  touch('Next language');
  await inspect();
  check('Cycle returns to English', state.keyboardLanguage, 'en');
  check('Cycle restores QWERTY', state.keyboardLayout, 'qwerty');
  control('Device languages');
  await inspect();
  assert(
    state.availableKeyboardLanguages.every((tag) =>
      /^(en|fr)([-_]|$)/.test(tag),
    ),
  );
  check(
    'One supported preference hides switcher',
    state.keyFrames.some((k) => k.label === 'Next language'),
    state.availableKeyboardLanguages.length > 1,
  );
  capture('device-preferences');
  control('English + French');
  await inspect();
  if (state.keyboardLanguage !== 'fr') {
    touch('Next language');
    await inspect();
  }
  capture('final-french');
  result = 'PASS';
} catch (failure) {
  error = failure.stack;
  try {
    capture('failure');
  } catch {}
} finally {
  try {
    run('orientation', 'portrait');
    restoreRotation();
  } catch {}
}
const summary = { result, platform, output, checks, captures, error };
writeFileSync(`${output}/results.json`, JSON.stringify(summary, null, 2));
writeFileSync(
  `artifacts/latin-languages/${platform}/latest.json`,
  JSON.stringify(summary, null, 2),
);
console.log(
  JSON.stringify({ result, checks: checks.length, output, error }, null, 2),
);
if (result !== 'PASS') process.exitCode = 1;
