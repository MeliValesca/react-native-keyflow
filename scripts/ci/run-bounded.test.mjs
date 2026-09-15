import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBounded } from './run-bounded.mjs';

test('runner preserves a completed process failure', async () => {
  const result = await runBounded(process.execPath, ['-e', 'process.exit(7)'], {
    timeoutMs: 2000,
    stdio: 'ignore',
  });
  assert.equal(result.status, 7);
  assert.equal(result.error, undefined);
});

test('runner stops a blocked process even when it ignores termination', async () => {
  const start = Date.now();
  const result = await runBounded(
    process.execPath,
    ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 100)"],
    {
      timeoutMs: 1000,
      graceMs: 50,
      stdio: 'ignore',
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.error.message, /Runner exceeded/);
  assert.ok(Date.now() - start < 5000);
});
