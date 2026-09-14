/** Start on the flat Transition screen. Saves a video and the fixture's actual
 * layout/timing assertions; a video alone is never treated as a test pass. */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg, cpus } from 'node:os';
const [platform, session, device] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !session || !device)
  throw new Error('Supply platform session device');
const agent = process.env.AGENT_DEVICE || 'agent-device',
  adb = process.env.ADB || 'adb';
const dir = `artifacts/features/${platform}/transitions`;
mkdirSync(dir, { recursive: true });
const path = `${dir}/transitions-${Date.now()}.mp4`;
const remote = `/sdcard/keyflow-transitions-${Date.now()}.mp4`;
const args =
  platform === 'ios'
    ? ['simctl', 'io', device, 'recordVideo', '--codec=h264', path]
    : ['-s', device, 'shell', 'screenrecord', '--time-limit', '180', remote];
const recorder = spawn(platform === 'ios' ? 'xcrun' : adb, args, {
  stdio: 'ignore',
});
const ended = new Promise((resolve) => recorder.on('exit', resolve));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const hostAtStart = { loadAverage: loadavg(), logicalCpuCount: cpus().length };
let result;
try {
  await pause(1000);
  execFileSync(agent, [
    'press',
    'label="Run transition tests"',
    '--session',
    session,
  ]);
  const deadline = Date.now() + 170000;
  while (Date.now() < deadline) {
    await pause(2000);
    const logs = execFileSync(
      'stim',
      [
        'logs',
        '--source',
        'metro',
        '--grep',
        `KEYFLOW_TRANSITION_TEST material=flat`,
        '--since',
        '5s',
      ],
      { cwd: 'example', encoding: 'utf8' },
    );
    const line = logs
      .split('\n')
      .find((l) => l.includes(`PASS: ${platform}:`) || l.includes('FAIL:'));
    if (line) {
      result = {
        result: line.includes(`PASS: ${platform}:`) ? 'PASS' : 'FAIL',
        platform,
        video: path,
        detail: line,
      };
      break;
    }
  }
  if (!result) throw new Error('Transition fixture timed out');
  execFileSync(agent, [
    'screenshot',
    `${dir}/result.png`,
    '--session',
    session,
  ]);
} catch (error) {
  result = { result: 'FAIL', platform, video: path, error: String(error) };
} finally {
  if (platform === 'android') {
    // Stop only this recording process, located by its unique output path.
    const ps = execFileSync(
      adb,
      ['-s', device, 'shell', 'ps', '-A', '-o', 'PID,ARGS'],
      { encoding: 'utf8' },
    );
    const pid = ps
      .split('\n')
      .find((l) => l.includes(remote))
      ?.trim()
      .split(/\s+/)[0];
    if (pid && /^\d+$/.test(pid))
      execFileSync(adb, ['-s', device, 'shell', 'kill', '-2', pid]);
  } else recorder.kill('SIGINT');
  await Promise.race([ended, pause(5000)]);
  if (platform === 'android')
    execFileSync(adb, ['-s', device, 'pull', remote, path]);
  result.hostAtStart = hostAtStart;
  writeFileSync(
    path.replace(/\.mp4$/, '.json'),
    JSON.stringify(result, null, 2),
  );
  writeFileSync(`${dir}/results.json`, JSON.stringify(result, null, 2));
}
console.log(result);
if (result.result !== 'PASS') process.exitCode = 1;
