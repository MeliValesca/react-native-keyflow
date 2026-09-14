import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectRuntime, installPrebuiltIos } from './launch-ios-ci.mjs';
const udid = '7049132B-B257-4D3D-9302-30CD428521FA';
const runtime = (version, model = 'iPad', isAvailable = true) => ({
  version,
  identifier: `com.apple.iOS-${version}`,
  isAvailable,
  supportedDeviceTypes: [{ name: model, identifier: `type-${model}` }],
});
test('selects the newest available runtime that supports the exact model', () => {
  assert.deepEqual(
    selectRuntime(
      [
        runtime('26.9'),
        runtime('26.10'),
        runtime('27', 'iPad', false),
        runtime('28', 'iPhone'),
      ],
      'iPad',
    ),
    { runtime: 'com.apple.iOS-26.10', type: 'type-iPad' },
  );
});
test('unavailable or mismatched devices fail instead of selecting another model', () => {
  assert.throws(
    () => selectRuntime([runtime('26', 'iPhone')], 'iPad'),
    /No available/,
  );
});
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'keyflow-prebuilt-ios-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
test('installs shared app without any build command and uses runtime-native readiness', (t) => {
  const calls = [];
  const result = installPrebuiltIos('iPad', '/shared', fixture(t), {
    run: (command, args) => {
      calls.push([command, ...args]);
      if (args[1] === 'list')
        return JSON.stringify({ runtimes: [runtime('26.5')], devices: {} });
      if (args[1] === 'create') return udid;
      return '';
    },
  });
  assert.equal(result, udid);
  assert.ok(
    calls.some(
      (args) =>
        args.includes('install') && args.includes('/shared/Keyflow.app'),
    ),
  );
  assert.ok(calls.some((args) => args.includes('launchctl')));
  assert.ok(calls.every((args) => args[0] === 'xcrun' && args[1] === 'simctl'));
});
test('install failures are not retried or reported as ready', (t) => {
  let installs = 0;
  assert.throws(
    () =>
      installPrebuiltIos('iPad', '/shared', fixture(t), {
        udid,
        run: (_, args) => {
          if (args[1] === 'list')
            return JSON.stringify({
              devices: { runtime: [{ udid, state: 'Booted' }] },
            });
          if (args[1] === 'install') {
            installs++;
            throw new Error('Install failed');
          }
          return '';
        },
      }),
    /Install failed/,
  );
  assert.equal(installs, 1);
});
test('local use cannot silently create or boot a different device', (t) => {
  assert.throws(
    () =>
      installPrebuiltIos('iPad', '/shared', fixture(t), {
        udid,
        run: () => JSON.stringify({ devices: {} }),
      }),
    /already be booted/,
  );
});

test('cold boot has its own bounded migration timeout and preserves progress', (t) => {
  const directory = fixture(t);
  const calls = [];
  installPrebuiltIos('iPad', '/shared', directory, {
    run: (_, args, options) => {
      calls.push({ action: args[1], timeout: options.timeout });
      if (args[1] === 'list')
        return JSON.stringify({ runtimes: [runtime('26.5')], devices: {} });
      if (args[1] === 'create') return udid;
      return args[1] === 'bootstatus'
        ? 'Waiting on Data Migration\nFinished\n'
        : '';
    },
  });
  assert.equal(
    calls.find((call) => call.action === 'bootstatus').timeout,
    600_000,
  );
  assert.ok(
    calls
      .filter((call) => call.action !== 'bootstatus')
      .every((call) => call.timeout === 180_000),
  );
  assert.match(
    readFileSync(join(directory, 'simulator-setup.log'), 'utf8'),
    /Waiting on Data Migration/,
  );
});
test('a boot that exceeds the deadline still fails before install and retains evidence', (t) => {
  const directory = fixture(t);
  const calls = [];
  assert.throws(
    () =>
      installPrebuiltIos('iPad', '/shared', directory, {
        run: (_, args) => {
          calls.push(args[1]);
          if (args[1] === 'list')
            return JSON.stringify({ runtimes: [runtime('26.5')], devices: {} });
          if (args[1] === 'create') return udid;
          if (args[1] === 'bootstatus')
            throw Object.assign(new Error('ETIMEDOUT'), {
              stdout: 'Waiting on Data Migration',
              stderr: 'migration stalled',
            });
          return '';
        },
      }),
    /ETIMEDOUT/,
  );
  assert.equal(calls.filter((action) => action === 'create').length, 1);
  assert.equal(calls.includes('install'), false);
  assert.match(
    readFileSync(join(directory, 'simulator-setup.log'), 'utf8'),
    /migration stalled/,
  );
});
