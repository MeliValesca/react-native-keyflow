import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, eligible, reusableRun } from './ci-reuse.mjs';

const tree = '100644 blob abc\tsrc/index.ts\0';
test('documentation-only updates preserve the merged input fingerprint', () => {
  assert.equal(
    fingerprint(tree + '100644 blob a\tREADME.md\0'),
    fingerprint(tree + '100644 blob b\tdocs/media/android.gif\0'),
  );
});
for (const path of [
  'ios/View.swift',
  'android/View.kt',
  'yarn.lock',
  '.github/workflows/native.yml',
  'scripts/ci-reuse.mjs',
  'example/App.tsx',
  'docs/package.json',
]) {
  test(`changes to ${path} invalidate reuse`, () => {
    assert.notEqual(
      fingerprint(tree + `100644 blob a\t${path}\0`),
      fingerprint(tree + `100644 blob b\t${path}\0`),
    );
  });
}
test('file deletion, modes and PR titles invalidate reuse', () => {
  assert.notEqual(fingerprint(tree), fingerprint(''));
  assert.notEqual(
    fingerprint(tree),
    fingerprint(tree.replace('100644', '100755')),
  );
  assert.notEqual(fingerprint(tree, 'valid'), fingerprint(tree, 'invalid'));
});
const current = { id: 20, repository: { id: 1 }, workflow_id: 2 };
const run = {
  ...current,
  id: 19,
  event: 'pull_request',
  pull_requests: [{ number: 3 }],
  status: 'completed',
  conclusion: 'success',
};
test('only older matching PR/repository/workflow runs are eligible', () => {
  assert.equal(eligible(run, current, 3), true);
  for (const patch of [
    { id: 20 },
    { id: 21 },
    { repository: { id: 9 } },
    { workflow_id: 9 },
    { event: 'push' },
    { pull_requests: [] },
    { conclusion: 'failure' },
    { conclusion: 'cancelled' },
    { conclusion: 'skipped' },
    { status: 'queued' },
    { status: 'in_progress' },
  ]) {
    assert.equal(Boolean(eligible({ ...run, ...patch }, current, 3)), false);
  }
});
test('base branch updates require new checks even with an identical final tree', () => {
  assert.notEqual(
    fingerprint(tree, 'title', 'base1'),
    fingerprint(tree, 'title', 'base2'),
  );
});

function fakeApi(artifacts, previous = run) {
  return (path) => {
    if (path === 'actions/runs/20') return current;
    if (path.startsWith('actions/workflows/'))
      return { workflow_runs: [previous] };
    if (path.includes('/artifacts?')) return { artifacts };
    if (path === 'actions/runs/19') return previous;
    throw new Error(`Unexpected request ${path}`);
  };
}

test('a published matching fingerprint plus successful completion permits reuse', async () => {
  assert.equal(
    await reusableRun(
      fakeApi([{ name: 'ci-inputs-key', expired: false }]),
      20,
      3,
      'key',
    ),
    run,
  );
});
for (const artifacts of [
  [],
  [{ name: 'ci-inputs-other', expired: false }],
  [{ name: 'ci-inputs-key', expired: true }],
]) {
  test(`missing/mismatched/expired evidence does not skip tests: ${JSON.stringify(
    artifacts,
  )}`, async () => {
    assert.equal(await reusableRun(fakeApi(artifacts), 20, 3, 'key'), null);
  });
}
for (const status of ['queued', 'in_progress']) {
  test(`matching ${status} runs never delay or skip the current tests`, async () => {
    const api = fakeApi([{ name: 'ci-inputs-key', expired: false }], {
      ...run,
      status,
    });
    assert.equal(await reusableRun(api, 20, 3, 'key'), null);
  });
}

test('API unavailability falls back to tests rather than granting reuse', () => {
  const result = spawnSync(process.execPath, ['scripts/ci-reuse.mjs'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      EVENT_NAME: 'pull_request',
      PATH: '/nonexistent-keyflow-path',
    },
  });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Could not verify earlier checks; running tests/);
  assert.doesNotMatch(result.stdout, /reused=true/);
});
