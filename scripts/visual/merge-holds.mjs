/** Combine explicitly selected full/focused evidence without hiding the original
 * failure manifests. Later captures supersede only the same mode/key pair. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const [basePath, ...reruns] = process.argv.slice(2);
if (!basePath || !reruns.length)
  throw new Error(
    'Supply a full results.json followed by focused results.json files',
  );
const records = new Map(),
  sources = [];
let platform, labels;
for (const path of [basePath, ...reruns]) {
  const data = JSON.parse(readFileSync(path));
  if (platform && platform !== data.platform)
    throw new Error('Mixed platforms');
  platform = data.platform;
  labels ??= data.results
    .filter((r) => r.mode === 'native')
    .map((r) => r.label);
  sources.push({ path, result: data.result, error: data.error });
  for (const row of data.results)
    records.set(`${row.mode}:${row.label}`, {
      ...row,
      directory: dirname(path),
    });
}
const results = [...records.values()];
const complete =
  labels.length > 0 &&
  labels.every((label) =>
    ['native', 'custom'].every(
      (mode) => records.get(`${mode}:${label}`)?.status === 'PASS',
    ),
  );
const result = {
  result: complete ? 'PASS' : 'FAIL',
  platform,
  scope: 'Latest per-key evidence across the listed full and focused runs',
  sources,
  results,
};
writeFileSync(
  `${dirname(basePath)}/verification.json`,
  JSON.stringify(result, null, 2),
);
console.log(
  `${result.result}: ${results.length} held states across ${sources.length} runs`,
);
if (!complete) process.exitCode = 1;
