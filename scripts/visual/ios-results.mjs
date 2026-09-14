/** Explicitly combine a full XCTest run with focused reruns, preserving each
 * attempt. This reports verification across runs, never a fictitious full pass. */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Supply xcresult bundles, oldest first');
const cases = new Map(),
  runs = [];
let device;
for (const path of paths) {
  const data = JSON.parse(
    execFileSync(
      'xcrun',
      ['xcresulttool', 'get', 'test-results', 'tests', '--path', path],
      { encoding: 'utf8' },
    ),
  );
  if (device && device !== data.devices[0].deviceId)
    throw new Error('Cannot combine different test devices');
  device = data.devices[0].deviceId;
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (node.nodeType === 'Test Case') {
        const attempts = cases.get(node.nodeIdentifier)?.attempts || [];
        cases.set(node.nodeIdentifier, {
          name: node.nodeIdentifier,
          result: node.result,
          attempts: [...attempts, { result: node.result, bundle: path }],
        });
      }
      walk(node.children);
    }
  };
  walk(data.testNodes);
  runs.push({
    resultBundle: path,
    attachments: `${path}-attachments`,
    video: `${path}.mp4`,
  });
}
const tests = [...cases.values()];
const result = {
  result:
    tests.length && tests.every((t) => t.result === 'Passed') ? 'PASS' : 'FAIL',
  scope:
    'Latest result per test across the explicitly listed full and focused runs',
  device,
  completedAt: new Date().toISOString(),
  tests,
  runs,
};
writeFileSync(
  'artifacts/ios-qwerty-tests/verification.json',
  JSON.stringify(result, null, 2),
);
console.log(
  `${result.result}: ${tests.length} tests verified across ${runs.length} runs`,
);
if (result.result !== 'PASS') process.exitCode = 1;
