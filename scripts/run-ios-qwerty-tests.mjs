/** Run local tests or a shared CI test bundle on an explicit simulator UDID. */
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
const device = process.argv[2];
const tests = process.argv.slice(3);
if (tests.some((test) => !/^test[A-Za-z0-9]+$/.test(test)))
  throw new Error('Supply XCTest method names starting with test');
if (!/^[0-9A-F-]{36}$/i.test(device || ''))
  throw new Error('Pass the iOS simulator UDID reported by stim ios.');
const prebuilt = process.env.KEYFLOW_IOS_XCTESTRUN;
if (prebuilt && !existsSync(prebuilt))
  throw new Error('Missing shared XCTest bundle');
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
const result = spawnSync(
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
  { stdio: 'inherit' },
);
recorder.kill('SIGINT');
await Promise.race([
  recordingEnded,
  new Promise((resolve) => setTimeout(resolve, 5000)),
]);
const attachments = `${resultBundle}-attachments`;
if (existsSync(resultBundle))
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
    { stdio: 'inherit' },
  );
writeFileSync(
  'artifacts/ios-qwerty-tests/latest.json',
  JSON.stringify(
    {
      result: result.status === 0 ? 'PASS' : 'FAIL',
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
process.exitCode = result.status ?? 1;
