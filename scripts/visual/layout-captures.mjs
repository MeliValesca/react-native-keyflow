import { preserveRotationSettings } from './rotation-settings.mjs';
/** Refresh final visual evidence without replaying the entire functional suite. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { layoutDriver, pause } from './layout-driver.mjs';
const [platform, session, refresh, subset] = process.argv.slice(2);
if (subset && (subset !== '--phone-only' || refresh !== '--custom-only'))
  throw new Error('Use --custom-only --phone-only for a phone-only refresh');
if (refresh && refresh !== '--custom-only')
  throw new Error('Unknown refresh option');
if (!['ios', 'android'].includes(platform) || !session)
  throw new Error('Supply platform session');
const driver = layoutDriver(platform, session);
const output = resolve(`artifacts/layouts/${platform}/visual-${Date.now()}`);
mkdirSync(output, { recursive: true });
const captures = [],
  checks = [],
  geometry = [];
let nativeSource, unchangedCustomSource;
if (refresh) {
  const prior = JSON.parse(
    readFileSync(`artifacts/layouts/${platform}/visual-latest.json`),
  );
  assert.equal(
    prior.result,
    'PASS',
    'A completed native capture set is required',
  );
  const native = prior.captures.filter((c) => c.name.includes('-system-'));
  assert.equal(native.length, 15);
  captures.push(...native);
  nativeSource = `${prior.output}/results.json`;
  if (subset) {
    captures.push(
      ...prior.captures.filter(
        (c) => c.name.includes('-custom-') && !c.name.includes('-phone-pad-'),
      ),
    );
    geometry.push(
      ...prior.geometry.filter((g) => !g.name.includes('-phone-pad')),
    );
    unchangedCustomSource = nativeSource;
  }
}
const capturePath = (name) => {
  const capture = captures.find((c) => c.name === name);
  assert(capture, `Missing capture ${name}`);
  return capture.path;
};
const restoreRotation = preserveRotationSettings(platform, session);
let result = 'FAIL',
  error;
try {
  driver.run('orientation', 'portrait');
  await pause(1000);
  driver.open();
  for (const orientation of ['portrait', 'landscape-left', 'landscape-right']) {
    driver.run('orientation', orientation);
    await pause(900);
    for (const [label, type] of [
      ['QWERTY', 'default'],
      ['Number', 'number-pad'],
      ['Decimal', 'decimal-pad'],
      ['Phone', 'phone-pad'],
    ]) {
      if (subset && type !== 'phone-pad') continue;
      driver.control(label);
      await pause(500);
      for (const mode of ['system', 'custom']) {
        if (refresh && mode === 'system') continue;
        driver.control(mode === 'system' ? 'Native' : 'Custom keyboard');
        await pause(700);
        const metrics = await driver.inspect();
        assert.equal(metrics.keyboardType, type);
        assert.equal(metrics.landscape, orientation !== 'portrait');
        if (
          type === 'phone-pad' &&
          platform === 'ios' &&
          mode === 'system' &&
          orientation === 'portrait' &&
          !driver.snapshot().some((n) => n.label === '0')
        ) {
          driver.key(['Shift'], metrics);
          await pause(300);
        }
        const name = `${orientation}-${type}-${mode}-idle`,
          path = `${output}/${name}.png`;
        driver.run('screenshot', path);
        captures.push({ name, path, metrics });
        checks.push(name);
        console.log(`PASS ${name}`);
        if (type === 'phone-pad') {
          driver.key(
            platform === 'ios' ? ['Shift', '+*#'] : ['Symbol keyboard', '* #'],
            metrics,
          );
          await pause(300);
          const symbols = await driver.inspect();
          const symbolName = `${orientation}-${type}-${mode}-phone-symbols`,
            symbolPath = `${output}/${symbolName}.png`;
          driver.run('screenshot', symbolPath);
          captures.push({
            name: symbolName,
            path: symbolPath,
            metrics: symbols,
          });
          driver.key(
            platform === 'ios' ? ['Shift', '123'] : ['Dial keyboard', '123'],
            symbols,
          );
          await pause(300);
        }
      }
      const file = `${output}/${orientation}-${type}-geometry.json`;
      try {
        execFileSync(
          'node',
          [
            'scripts/visual/layout-geometry.mjs',
            platform,
            capturePath(`${orientation}-${type}-system-idle`),
            capturePath(`${orientation}-${type}-custom-idle`),
            file,
          ],
          { stdio: 'ignore' },
        );
      } catch {}
      const measured = JSON.parse(readFileSync(file));
      geometry.push({
        name: `${orientation}-${type}`,
        path: file,
        ...measured,
      });
    }
  }
  for (const orientation of ['portrait', 'landscape-left', 'landscape-right']) {
    const name = `${orientation}-phone-pad-phone-symbols`;
    const file = `${output}/${name}-geometry.json`;
    try {
      execFileSync(
        'node',
        [
          'scripts/visual/layout-geometry.mjs',
          platform,
          capturePath(`${orientation}-phone-pad-system-phone-symbols`),
          capturePath(`${orientation}-phone-pad-custom-phone-symbols`),
          file,
        ],
        { stdio: 'ignore' },
      );
    } catch {}
    geometry.push({ name, path: file, ...JSON.parse(readFileSync(file)) });
  }
  assert(
    geometry.every((g) => g.pass),
    'Key-face geometry differs beyond the recorded tolerance',
  );
  result = 'PASS';
} catch (e) {
  error = String(e.stack || e);
  console.error(error);
} finally {
  try {
    driver.run('orientation', 'portrait');
  } finally {
    restoreRotation();
  }
  const data = {
    result,
    platform,
    completedAt: new Date().toISOString(),
    output,
    nativeSource,
    unchangedCustomSource,
    captures,
    checks,
    geometry,
    error,
  };
  writeFileSync(`${output}/results.json`, JSON.stringify(data, null, 2));
  writeFileSync(
    resolve(`artifacts/layouts/${platform}/visual-latest.json`),
    JSON.stringify(data, null, 2),
  );
  console.log(`${result}: ${output}`);
  if (result !== 'PASS') process.exitCode = 1;
}
