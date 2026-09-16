/** Run local tests or a shared CI test bundle on an explicit simulator UDID. */
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { runBounded } from './ci/run-bounded.mjs';
const device = process.argv[2];
const tests = process.argv.slice(3);
if (tests.some((test) => !/^test[A-Za-z0-9]+$/.test(test)))
  throw new Error('Supply XCTest method names starting with test');
if (!/^[0-9A-F-]{36}$/i.test(device || ''))
  throw new Error('Pass the iOS simulator UDID reported by stim ios.');
const prebuilt = process.env.KEYFLOW_IOS_XCTESTRUN;
if (prebuilt && !existsSync(prebuilt))
  throw new Error('Missing shared XCTest bundle');
// Wake the display and prevent both idle and AC maintenance sleep while
// simulator input synthesis is running.
const awake = spawn(
  '/usr/bin/caffeinate',
  ['-d', '-i', '-s', '-u', '-w', String(process.pid)],
  {
    stdio: 'ignore',
  },
);
awake.unref();
process.on('exit', () => awake.kill('SIGTERM'));
if (!prebuilt)
  execFileSync('ruby', ['scripts/ios-tests/create-project.rb'], {
    stdio: 'inherit',
  });
mkdirSync('artifacts/ios-qwerty-tests', { recursive: true });
const resultBundle = `artifacts/ios-qwerty-tests/run-${Date.now()}.xcresult`;
const video = `${resultBundle}.mp4`;
const recorder = spawn(
  'xcrun',
  ['simctl', 'io', device, 'recordVideo', '--codec=h264', video],
  { stdio: 'ignore' },
);
const recordingEnded = new Promise((resolve) => recorder.on('exit', resolve));
const result = await runBounded(
  'xcodebuild',
  [
    ...(prebuilt
      ? ['test-without-building', '-xctestrun', prebuilt]
      : [
          'test',
          '-project',
          'artifacts/ios-qwerty-tests/QwertyTests.xcodeproj',
          '-scheme',
          'QwertyTests',
        ]),
    '-destination',
    `platform=iOS Simulator,id=${device}`,
    '-derivedDataPath',
    'artifacts/ios-qwerty-tests/build',
    '-resultBundlePath',
    resultBundle,
    '-parallel-testing-enabled',
    'NO',
    '-test-timeouts-enabled',
    'YES',
    '-default-test-execution-time-allowance',
    '240',
    '-maximum-test-execution-time-allowance',
    '240',
    ...tests.map(
      (test) => `-only-testing:QwertyTests/KeyflowQwertyTests/${test}`,
    ),
  ],
  { stdio: 'inherit', timeoutMs: 30 * 60_000 },
);
recorder.kill('SIGINT');
await Promise.race([
  recordingEnded,
  new Promise((resolve) => setTimeout(resolve, 5000)),
]);
const attachments = `${resultBundle}-attachments`;
if (existsSync(resultBundle)) {
  try {
    execFileSync(
      'xcrun',
      [
        'xcresulttool',
        'export',
        'attachments',
        '--path',
        resultBundle,
        '--output-path',
        attachments,
      ],
      { stdio: 'inherit', timeout: 60_000 },
    );
  } catch (error) {
    writeFileSync(`${resultBundle}-export-error.txt`, String(error));
  }
}
writeFileSync(
  'artifacts/ios-qwerty-tests/latest.json',
  JSON.stringify(
    {
      result: result.status === 0 && !result.error ? 'PASS' : 'FAIL',
      device,
      tests: tests.length ? tests : 'all',
      resultBundle,
      video,
      attachments,
      completedAt: new Date().toISOString(),
      error: result.error?.message,
    },
    null,
    2,
  ),
);
process.exitCode = result.error ? 1 : result.status ?? 1;
