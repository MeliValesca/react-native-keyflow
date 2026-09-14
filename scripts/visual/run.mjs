/** The example must be running on the Interaction screen in light appearance.
 * Usage: yarn test:features ios|android session device
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [platform, session, device] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !session || !device)
  throw new Error('Supply platform session device');
const commands = [
  ...(platform === 'android'
    ? [['scripts/prepare-android-reference.mjs', device]]
    : []),
  ['scripts/visual/navigate.mjs', platform, session, 'interaction'],
  ['scripts/compare-native-interactions.mjs', platform, session],
  ['scripts/visual/navigate.mjs', platform, session, 'longpress'],
  ['scripts/visual/long-press.mjs', platform, session, device],
  ...(platform === 'ios'
    ? [['scripts/run-ios-qwerty-tests.mjs', device]]
    : [
        ['scripts/visual/navigate.mjs', platform, session, 'interaction'],
        ['scripts/test-android-pages-and-cursor.mjs', platform, session],
        ['scripts/test-android-key-preview.mjs', session, device],
        ['scripts/test-android-accent-drag.mjs', session, device],
      ]),
];
commands.push(
  ['scripts/visual/navigate.mjs', platform, session, 'transitions'],
  ['scripts/visual/transitions.mjs', platform, session, device],
  ['scripts/visual/navigate.mjs', platform, session, 'customization'],
  ['scripts/visual/customization.mjs', platform, session],
  ['scripts/visual/navigate.mjs', platform, session, 'default'],
  ['scripts/capture-qwerty-defaults.mjs', platform, session, device],
  ['scripts/capture-accent-contrast.mjs', platform, session, device],
  ['scripts/visual/navigate.mjs', platform, session, 'default'],
);
const results = [];
mkdirSync(`artifacts/features/${platform}`, { recursive: true });
for (const args of commands) {
  const startedAt = new Date().toISOString();
  const run = spawnSync(process.execPath, args, { stdio: 'inherit' });
  results.push({
    command: args,
    startedAt,
    finishedAt: new Date().toISOString(),
    result: run.status === 0 ? 'PASS' : 'FAIL',
  });
  writeFileSync(
    `artifacts/features/${platform}/run.json`,
    JSON.stringify({ platform, device, results }, null, 2),
  );
  if (run.status !== 0) {
    process.exitCode = 1;
    break;
  }
}
spawnSync(process.execPath, ['scripts/visual/report.mjs'], {
  stdio: 'inherit',
});
