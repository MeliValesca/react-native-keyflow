/** Open Your app. Your type. in portrait, then run:
 * AGENT_DEVICE=/path/to/agent-device node scripts/visual/custom-fonts.mjs ios|android session
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [platform, session] = process.argv.slice(2);
assert(
  ['ios', 'android'].includes(platform) && session,
  'Supply platform session',
);
const bin = process.env.AGENT_DEVICE || 'agent-device';
const dir = `artifacts/features/${platform}/custom-font`;
mkdirSync(dir, { recursive: true });
const run = (...args) =>
  JSON.parse(
    execFileSync(bin, [...args.map(String), '--session', session, '--json'], {
      encoding: 'utf8',
      timeout: 35000,
      maxBuffer: 16 * 1024 * 1024,
    }),
  ).data;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const capture = (name) => {
  const path = `${dir}/${name}.png`;
  run('screenshot', path);
  return PNG.sync.read(readFileSync(path));
};
const check = async () => {
  const since = Date.now();
  run('press', 'label="Check custom font"', '--settle');
  for (let attempt = 0; attempt < 8; attempt++) {
    await pause(400);
    const output = execFileSync(
      'stim',
      ['logs', '--since', '1m', '--grep', 'KEYFLOW_CUSTOM_FONT_TEST', '--json'],
      { cwd: 'example', encoding: 'utf8' },
    );
    const records = output.trim().split('\n').filter(Boolean).map(JSON.parse);
    const record = records
      .reverse()
      .find(
        (record) =>
          record.ts >= since && record.msg.includes(`"platform":"${platform}"`),
      );
    if (!record) continue;
    const result = JSON.parse(record.msg.slice(record.msg.indexOf('{')));
    assert.equal(result.result, 'PASS', result.error);
    assert.equal(result.avoidance, 'keyflow');
    assert.equal(result.metrics.landscape, false);
    assert.deepEqual(result.metrics.violations, []);
    assert(result.metrics.editorBottom <= result.metrics.screenY - 1);
    return result;
  }
  throw new Error('No fresh custom-font result');
};
const changedKeyPixels = (a, b, metrics) => {
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  const scale = a.width / metrics.width;
  let changed = 0;
  for (const key of metrics.keyFrames.filter((key) =>
    /^[a-z]$/i.test(key.label),
  )) {
    for (
      let y = Math.ceil((key.y + 8) * scale);
      y < (key.y + key.height - 8) * scale;
      y++
    ) {
      for (
        let x = Math.ceil((key.x + 6) * scale);
        x < (key.x + key.width - 6) * scale;
        x++
      ) {
        const p = (y * a.width + x) * 4;
        if ([0, 1, 2].some((c) => Math.abs(a.data[p + c] - b.data[p + c]) > 45))
          changed++;
      }
    }
  }
  return changed / (scale * scale);
};
const checks = [];
try {
  let baseline, previous;
  for (const label of ['System', 'Regular', 'Semibold', 'Bold']) {
    run('press', `label="${label}"`, '--settle');
    const result = await check();
    assert.equal(result.choice, label.toLowerCase());
    baseline ??= result.metrics;
    assert.deepEqual(result.metrics.keyFrames, baseline.keyFrames);
    assert.equal(
      result.metrics.text,
      baseline.text,
      'Changing fonts lost input',
    );
    const png = capture(result.choice);
    const changed = previous
      ? changedKeyPixels(previous, png, result.metrics)
      : null;
    if (changed !== null)
      assert(changed > 150, `${label}: actual glyphs did not change`);
    checks.push({ ...result, changedKeyPixels: changed });
    previous = png;
  }
  const metrics = checks.at(-1).metrics;
  const q = metrics.keyFrames.find((key) => key.label.toLowerCase() === 'q');
  assert(q);
  run('press', q.x + q.width / 2, q.y + q.height / 2);
  const typed = await check();
  assert.equal(typed.metrics.text.length, metrics.text.length + 1);
  // The input's submit handler dismisses the keyboard. Then Check reopens it.
  const submit = typed.metrics.keyFrames.find((key) =>
    /^(return|Submit)$/.test(key.label),
  );
  assert(submit);
  run('press', submit.x + submit.width / 2, submit.y + submit.height / 2);
  await pause(700);
  capture('dismissed');
  const reopened = await check();
  assert.equal(reopened.metrics.text, typed.metrics.text);
  assert.deepEqual(reopened.metrics.keyFrames, typed.metrics.keyFrames);
  capture('reopened');
  run('press', 'label="Semibold"', '--settle');
  await check();
  capture('default');
  writeFileSync(
    `${dir}/results.json`,
    JSON.stringify({ result: 'PASS', platform, checks, reopened }, null, 2),
  );
  console.log(
    `${platform}: PASS four fonts, visible glyph changes, stable geometry, typing and avoidance after reopen`,
  );
} catch (error) {
  writeFileSync(
    `${dir}/results.json`,
    JSON.stringify(
      { result: 'FAIL', platform, checks, error: String(error) },
      null,
      2,
    ),
  );
  throw error;
}
