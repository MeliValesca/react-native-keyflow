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
    assert.deepEqual(changeScope([path]), {
      ios: true,
      android: false,
      library: true,
    }));
}
for (const path of [
  'android/src/Keyboard.kt',
  'scripts/android-tests/instrumentation.py',
  'example/android/build.gradle',
  '.github/workflows/android-ui.yml',
]) {
  test(`Android only: ${path}`, () =>
    assert.deepEqual(changeScope([path]), {
      ios: false,
      android: true,
      library: true,
    }));
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
    assert.deepEqual(changeScope([path]), {
      ios: true,
      android: true,
      library: true,
    }));
}
test('Mixed platform changes run both', () =>
  assert.deepEqual(changeScope(['ios/A.swift', 'android/B.kt']), {
    ios: true,
    android: true,
    library: true,
  }));
test('Empty diff runs both conservatively', () =>
  assert.deepEqual(changeScope([]), {
    ios: true,
    android: true,
    library: true,
  }));
for (const event of ['schedule', 'workflow_dispatch']) {
  test(`${event} always runs both`, () =>
    assert.deepEqual(detectScope(event), {
      ios: true,
      android: true,
      library: true,
    }));
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
  assert.deepEqual(scope, { ios: true, android: true, library: true });
});

for (const path of [
  'README.md',
  'docs/api.md',
  'ios/README.md',
  'docs/media/ios-trackpad.gif',
  'docs/media/android-accents.mp4',
]) {
  test(`Documentation skips all suites: ${path}`, () =>
    assert.deepEqual(changeScope([path]), {
      ios: false,
      android: false,
      library: false,
    }));
}
for (const [path, ios, android] of [
  ['ios/Key.swift', true, false],
  ['android/Key.kt', false, true],
]) {
  test(`Documentation does not broaden ${path}`, () =>
    assert.deepEqual(changeScope(['README.md', path, 'docs/media/demo.gif']), {
      ios,
      android,
      library: true,
    }));
}
for (const path of [
  'docs/package.json',
  'example/assets/image.png',
  'docs/media/script.js',
]) {
  test(`Non-documentation still runs everything: ${path}`, () =>
    assert.deepEqual(changeScope([path]), {
      ios: true,
      android: true,
      library: true,
    }));
}
for (const [paths, expected] of [
  [
    'README.md\0docs/media/demo.gif\0',
    { ios: false, android: false, library: false },
  ],
  ['android/Key.kt\0', { ios: false, android: true, library: true }],
  ['ios/Key.swift\0', { ios: true, android: false, library: true }],
]) {
  test(`Main push uses before/after trees: ${paths}`, () => {
    const base = 'a'.repeat(40),
      head = 'b'.repeat(40);
    assert.deepEqual(
      detectScope('push', base, head, (args) => {
        assert.equal(args.at(-1), `${base}..${head}`);
        assert.ok(args.includes('--no-renames'));
        return paths;
      }),
      expected,
    );
  });
}
test('Initial push runs everything', () =>
  assert.deepEqual(detectScope('push', '0'.repeat(40), 'b'.repeat(40)), {
    ios: true,
    android: true,
    library: true,
  }));
test('Diff failure cannot silently skip checks', () =>
  assert.throws(() =>
    detectScope('push', 'a'.repeat(40), 'b'.repeat(40), () => {
      throw new Error('Missing base');
    }),
  ));
