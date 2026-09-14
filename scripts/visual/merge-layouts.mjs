/** Explicitly combine completed scenarios; never conceal a missing scenario or final failure. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [platform, ...files] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !files.length)
  throw new Error('Supply platform and results.json files, oldest first');
const prefixes = ['portrait', 'landscape-left', 'landscape-right'].flatMap(
  (o) =>
    ['default', 'number-pad', 'decimal-pad', 'phone-pad'].flatMap((t) =>
      ['system', 'custom'].map((m) => `${o}-${t}-${m}`),
    ),
);
const scenarios = new Map(),
  history = [];
let latest;
for (const file of files) {
  const data = JSON.parse(readFileSync(file));
  if (data.platform !== platform) throw new Error('Mixed platforms');
  history.push({
    file: resolve(file),
    result: data.result,
    completedAt: data.completedAt,
    startAt: data.startAt,
  });
  for (const prefix of prefixes) {
    const checks = data.checks.filter((c) => c.startsWith(prefix + ' '));
    if (checks.includes(`${prefix} delete stops on release`))
      scenarios.set(prefix, {
        checks,
        captures: data.captures.filter((c) => c.name.startsWith(prefix + '-')),
      });
  }
  latest = data;
}
const missing = prefixes.filter((p) => !scenarios.has(p));
const result =
  missing.length === 0 && latest.result === 'PASS' ? 'PASS' : 'FAIL';
const output = resolve(`artifacts/layouts/${platform}/verified`);
const { mkdirSync } = await import('node:fs');
mkdirSync(output, { recursive: true });
const report = {
  result,
  platform,
  completedAt: new Date().toISOString(),
  scope: `${scenarios.size}/24 scenarios verified across ${files.length} saved runs. This is not one uninterrupted full run.`,
  history,
  missing,
  checks: [...scenarios.values()]
    .flatMap((s) => s.checks)
    .concat(
      latest.checks.filter(
        (c) => c.startsWith('rotate ') || c.startsWith('switch '),
      ),
    ),
  captures: [...scenarios.values()].flatMap((s) => s.captures),
};
writeFileSync(`${output}/results.json`, JSON.stringify(report, null, 2));
writeFileSync(
  resolve(`artifacts/layouts/${platform}/latest.json`),
  JSON.stringify({ result, output }, null, 2),
);
console.log(result, report.scope);
if (result !== 'PASS') process.exitCode = 1;
