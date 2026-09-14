import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

/** agent-device orientation locks Android auto-rotate. Restore the user's policy in finally. */
export function preserveRotationSettings(platform, session, device) {
  if (platform !== 'android') return () => {};
  if (!device) {
    const response = JSON.parse(
      execFileSync(
        process.env.AGENT_DEVICE || 'agent-device',
        ['session', 'list', '--json'],
        { encoding: 'utf8' },
      ),
    );
    const target = response.data.sessions.find(
      (s) => s.name === session && s.platform === 'android',
    );
    assert(target?.id, `No Android device for session ${session}`);
    device = target.id;
  }
  const shell = (...args) =>
    execFileSync(process.env.ADB || 'adb', ['-s', device, 'shell', ...args], {
      encoding: 'utf8',
    }).trim();
  const policy = shell('wm', 'user-rotation');
  assert(
    /^(free|lock)( \d)?$/.test(policy),
    `Unknown rotation policy: ${policy}`,
  );
  const values = ['accelerometer_rotation', 'user_rotation'].map((key) => [
    key,
    shell('settings', 'get', 'system', key),
  ]);
  return () => {
    shell('wm', 'user-rotation', ...policy.split(' '));
    for (const [key, value] of values)
      shell(
        'settings',
        value === 'null' ? 'delete' : 'put',
        'system',
        key,
        ...(value === 'null' ? [] : [value]),
      );
  };
}
