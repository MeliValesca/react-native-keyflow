/** Open Customize fonts & test layouts. Capture boundary states, then run the
 * screen's full 58-theme geometry/font-resolution assertion matrix. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [platform, session] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !session)
  throw new Error('Supply platform session');
const bin = process.env.AGENT_DEVICE || 'agent-device';
const dir = `artifacts/features/${platform}/customization`;
mkdirSync(dir, { recursive: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (...args) =>
  JSON.parse(
    execFileSync(bin, [...args, '--session', session, '--json'], {
      encoding: 'utf8',
    }),
  ).data;
const tap = (label) => run('press', `label="${label}"`, '--settle');
const captures = [];
let result;
try {
  for (const material of ['flat', 'raised']) {
    tap(material);
    for (const font of ['Default', 'Serif', 'Mono']) {
      tap(font);
      for (const size of [12, 32]) {
        tap(`${size} pt`);
        const file = `${material}-${font}-${size}.png`;
        run('screenshot', `${dir}/${file}`);
        captures.push({ material, font, size, file });
      }
    }
  }
  tap('Default');
  tap('22 pt');
  tap('flat');
  tap('Test customization boundaries');
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    await pause(1500);
    const n = run('snapshot').nodes.find((n) =>
      /^PASS: \d+ themes|^FAIL:/.test(n.label || ''),
    );
    if (n) {
      result = {
        result: n.label.startsWith('PASS:') ? 'PASS' : 'FAIL',
        detail: n.label,
        captures,
      };
      break;
    }
  }
  if (!result) throw new Error('Customization fixture timed out');
  run('screenshot', `${dir}/result.png`);
} catch (error) {
  result = { result: 'FAIL', error: String(error), captures };
}
writeFileSync(`${dir}/results.json`, JSON.stringify(result, null, 2));
console.log(result.result, result.detail || result.error);
if (result.result !== 'PASS') process.exitCode = 1;
