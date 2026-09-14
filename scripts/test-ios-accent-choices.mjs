/** Open Transparency in an iOS agent-device session. Compare native
 * rendered accent rows with the independently captured Apple reference.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const session = process.argv[2];
if (!session) throw new Error('Supply the iOS agent-device session');
const bin = process.env.AGENT_DEVICE || 'agent-device';
const run = (...args) =>
  JSON.parse(
    execFileSync(bin, [...args.map(String), '--session', session, '--json'], {
      encoding: 'utf8',
      timeout: 30000,
    }),
  ).data;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const nodes = () => run('snapshot').nodes;
function tap(label, hold = 0, key = false) {
  const n = nodes().find(
    (n) => n.label === label && (!key || n.type === 'Key'),
  );
  if (!n) throw new Error(`Missing ${label}`);
  return run(
    hold ? 'longpress' : 'press',
    n.rect.x + n.rect.width / 2,
    n.rect.y + n.rect.height / 2,
    ...(hold ? [hold] : []),
  );
}
const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/apple-letter-reference.json', import.meta.url),
  ),
);
const results = [];
try {
  tap('Run transparency checks');
  await pause(700);
  const q = nodes().find(
    (n) => n.type === 'Key' && n.label?.toLowerCase() === 'q',
  );
  tap(q.label, 0, true); // Establish lowercase without remounting the image scene.
  for (const [letterCase, rows] of Object.entries({
    lowercase: fixture.lowercase,
    uppercase: fixture.uppercase,
  })) {
    for (const [base, row] of Object.entries(rows)) {
      const label = letterCase === 'uppercase' ? base.toUpperCase() : base;
      if (!nodes().some((n) => n.type === 'Key' && n.label === label))
        tap('Shift', 0, true);
      tap(label, 750, true);
      tap('Run transparency checks');
      await pause(850);
      const logs = execFileSync(
        'stim',
        [
          'logs',
          '--source',
          'metro',
          '--grep',
          'KEYFLOW_TRANSPARENCY_TEST',
          '--since',
          '30s',
        ],
        { cwd: 'example', encoding: 'utf8' },
      );
      const line = logs
        .trim()
        .split('\n')
        .filter((l) => l.includes('KEYFLOW_TRANSPARENCY_TEST'))
        .at(-1);
      const data = JSON.parse(line.slice(line.indexOf('{')));
      const actual = data.metrics?.lastAccentChoices;
      if (
        data.result !== 'PASS' ||
        JSON.stringify(actual) !== JSON.stringify([...row])
      )
        throw new Error(`${label}: ${JSON.stringify(data)}`);
      results.push({
        label,
        expected: [...row],
        actual,
        violations: data.metrics.lastAccentViolations,
        pass: true,
      });
      console.log('PASS', label, actual.join(' '));
    }
  }
  writeFileSync(
    'artifacts/accent-parity/choices-results.json',
    JSON.stringify({ result: 'PASS', results }, null, 2),
  );
} catch (error) {
  writeFileSync(
    'artifacts/accent-parity/choices-results.json',
    JSON.stringify({ result: 'FAIL', results, error: String(error) }, null, 2),
  );
  throw error;
}
