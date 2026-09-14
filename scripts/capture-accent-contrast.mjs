/** Start on the default Keyboard playground, custom keyboard, light appearance.
 * Uses real held touches; preserves captures for visual and pixel inspection.
 * ios: session simulator-UDID; android: session emulator-serial.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [platform, session, device] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !session || !device)
  throw new Error('Supply ios|android session device');
const agent = process.env.AGENT_DEVICE || 'agent-device';
const adb = process.env.ADB || 'adb';
const directory = 'artifacts/pressed-contrast';
mkdirSync(directory, { recursive: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const press = (...args) =>
  execFileSync(agent, ['press', ...args, '--session', session, '--settle']);
const motion = (action) =>
  execFileSync(adb, [
    '-s',
    device,
    'shell',
    'input',
    'motionevent',
    action,
    '102',
    '677',
  ]);
const reports = [];
let dark = false;
try {
  for (const appearance of ['light', 'dark']) {
    if (appearance === 'dark') {
      press('label="Dark keyboard"');
      dark = true;
    }
    const path = `${directory}/${platform}-accent-${appearance}.png`;
    if (platform === 'ios') {
      const hold = spawn(agent, [
        'longpress',
        '102',
        '611',
        '6000',
        '--session',
        session,
      ]);
      const completed = new Promise((resolve, reject) => {
        hold.on('error', reject);
        hold.on('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(`Hold exited ${code}`)),
        );
      });
      await pause(3000);
      execFileSync('xcrun', ['simctl', 'io', device, 'screenshot', path]);
      await completed;
    } else {
      motion('DOWN');
      try {
        await pause(650);
        writeFileSync(
          path,
          execFileSync(adb, ['-s', device, 'exec-out', 'screencap', '-p']),
        );
      } finally {
        motion('UP');
      }
    }
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        ['scripts/verify-accent-contrast.mjs', platform, appearance, path],
        { encoding: 'utf8' },
      ),
    );
    reports.push(report);
    console.log(
      `${platform} ${appearance}: every accent has visible foreground strokes`,
    );
  }
} finally {
  if (dark) press('label="Dark keyboard"');
}
writeFileSync(
  `${directory}/${platform}-results.json`,
  JSON.stringify({ result: 'PASS', reports }, null, 2),
);
