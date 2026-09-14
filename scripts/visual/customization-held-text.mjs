/** Independently verify pressed/released foreground colors from saved real holds. */
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { colorCount } from './customization-pixels.mjs';
const platform = process.argv[2];
assert(['ios', 'android'].includes(platform));
const { output } = JSON.parse(
  readFileSync(`artifacts/customization-layouts/${platform}/latest.json`),
);
const data = JSON.parse(readFileSync(`${output}/results.json`));
assert.equal(data.result, 'PASS');
const checks = [];
for (const orientation of ['portrait', 'landscape-left', 'landscape-right'])
  for (const type of ['default', 'number-pad', 'decimal-pad', 'phone-pad'])
    for (const material of ['flat', 'raised']) {
      const prefix = `${orientation}-${type}-${material}`,
        idle = data.captures.find((c) => c.name === `${prefix}-idle`);
      assert(idle);
      const key = idle.metrics.keyFrames.find(
        (k) => k.label === (type === 'default' ? 'Delete' : '2'),
      );
      assert(key);
      for (const state of ['held', 'released']) {
        const capture = data.captures.find(
          (c) => c.name === `${prefix}-${state}`,
        );
        assert(capture);
        const expected =
          state === 'held'
            ? [255, 255, 255]
            : type === 'default'
            ? [255, 221, 51]
            : [240, 229, 255];
        const count = colorCount(
          platform,
          PNG.sync.read(readFileSync(capture.path)),
          orientation,
          key,
          expected,
        );
        checks.push({
          name: `${orientation}/${type}/${material} ${state} foreground`,
          pass: count > 5,
          pixels: count,
          expected,
        });
      }
    }
const result = checks.every((c) => c.pass) ? 'PASS' : 'FAIL';
writeFileSync(
  `${output}/foreground-results.json`,
  JSON.stringify({ result, source: `${output}/results.json`, checks }, null, 2),
);
console.log(
  `${platform}: ${result} ${checks.filter((c) => c.pass).length}/${
    checks.length
  } pressed/released foreground checks`,
);
for (const c of checks.filter((c) => !c.pass)) console.log(c);
if (result !== 'PASS') process.exitCode = 1;
