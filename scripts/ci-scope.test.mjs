import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeScope, detectScope } from './ci-scope.mjs';

for (const path of [
  'ios/Keyboard.swift',
  'scripts/ios-tests/Test.swift',
  'scripts/launch-ios-ci.test.mjs',
  'scripts/ci/build-ios.sh',
  'scripts/ci/run-ios.sh',
  '.github/workflows/ios-ui.yml',
  '.swift-format',
]) {
  test(`iOS only: ${path}`, () =>
    assert.deepEqual(changeScope([path]), { ios: true, android: false }));
}
for (const path of [
  'android/src/Keyboard.kt',
  'scripts/android-tests/instrumentation.py',
  'example/android/build.gradle',
  '.github/workflows/android-ui.yml',
]) {
  test(`Android only: ${path}`, () =>
    assert.deepEqual(changeScope([path]), { ios: false, android: true }));
}
for (const path of [
  'src/index.ts',
  'example/src/App.tsx',
  'package.json',
  'yarn.lock',
  '.github/workflows/native.yml',
  '.github/actions/setup-js/action.yml',
  'scripts/ci/startup.py',
  'unknown.file',
]) {
  test(`Shared or unknown: ${path}`, () =>
    assert.deepEqual(changeScope([path]), { ios: true, android: true }));
}
test('Mixed platform changes run both', () =>
  assert.deepEqual(changeScope(['ios/A.swift', 'android/B.kt']), {
    ios: true,
    android: true,
  }));
test('Empty diff runs both conservatively', () =>
  assert.deepEqual(changeScope([]), { ios: true, android: true }));
for (const event of ['push', 'workflow_dispatch']) {
  test(`${event} always runs both`, () =>
    assert.deepEqual(detectScope(event), { ios: true, android: true }));
}
test('Invalid revisions fail instead of skipping checks', () =>
  assert.throws(() => detectScope('pull_request', '--bad', 'invalid')));
test('PR compares the full branch diff and handles deleted/renamed paths', () => {
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const scope = detectScope('pull_request', base, head, (args) => {
    assert.deepEqual(args, [
      'diff',
      '--name-only',
      '--no-renames',
      '-z',
      `${base}...${head}`,
    ]);
    return 'ios/old.swift\0android/new.kt\0';
  });
  assert.deepEqual(scope, { ios: true, android: true });
});
