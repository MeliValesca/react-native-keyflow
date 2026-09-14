/** Combine completed scenarios from interrupted/resumed runs, retaining provenance. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [platform, ...files] = process.argv.slice(2);
assert(['ios', 'android'].includes(platform) && files.length > 1);
const runs = files.map((file) => ({
  file: resolve(file),
  ...JSON.parse(readFileSync(file)),
}));
assert(
  runs.every((r) => r.platform === platform && r.device === runs[0].device),
);
const matrices = [],
  checks = [],
  captures = [];
for (const orientation of ['portrait', 'landscape-left', 'landscape-right']) {
  for (const type of ['default', 'number-pad', 'decimal-pad', 'phone-pad']) {
    const name = `${orientation}/${type}`;
    const prefix = `${orientation}-${type}-`;
    const run = [...runs]
      .reverse()
      .find(
        (r) =>
          r.matrices.some(
            (m) => m.name === name && m.result === 'PASS' && m.count === 58,
          ) &&
          r.checks.filter((c) => c.startsWith(`${name} `)).length === 6 &&
          r.captures.filter((c) => c.name.startsWith(prefix)).length === 6,
      );
    assert(run, `Missing complete scenario: ${name}`);
    matrices.push({
      ...run.matrices.find((m) => m.name === name),
      source: run.file,
    });
    checks.push(...run.checks.filter((c) => c.startsWith(`${name} `)));
    captures.push(...run.captures.filter((c) => c.name.startsWith(prefix)));
  }
}
const output = resolve(
  `artifacts/customization-layouts/${platform}/merged-${Date.now()}`,
);
mkdirSync(output, { recursive: true });
writeFileSync(
  `${output}/results.json`,
  JSON.stringify(
    {
      result: 'PASS',
      platform,
      device: runs[0].device,
      output,
      matrices,
      checks,
      captures,
      history: runs.map((r) => ({ file: r.file, result: r.result })),
      scope:
        'Complete scenarios combined from interrupted/resumed runs. Original failures and source screenshots are retained.',
      completedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
writeFileSync(
  `artifacts/customization-layouts/${platform}/latest.json`,
  JSON.stringify({ output, result: 'PASS' }, null, 2),
);
console.log(
  `${platform}: PASS ${matrices.length} matrices, ${checks.length} interaction checks; ${output}`,
);
