/** Open Customize fonts & test layouts in portrait, with QWERTY selected.
 * Checks the shared raised preset's actual colors, including special keys.
 * AGENT_DEVICE=/path/to/agent-device node scripts/visual/raised-surface.mjs ios|android session
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const [platform, session] = process.argv.slice(2);
assert(['ios', 'android'].includes(platform) && session);
const agent = process.env.AGENT_DEVICE || 'agent-device';
const dir = `artifacts/features/${platform}/raised-surface`;
mkdirSync(dir, { recursive: true });
const run = (...args) =>
  JSON.parse(
    execFileSync(agent, [...args, '--session', session, '--json'], {
      encoding: 'utf8',
      maxBuffer: 16000000,
    }),
  ).data;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const inspect = async () => {
  run('press', 'id="customization-probe"', '--settle');
  const node = run('snapshot').nodes.find(
    (n) => n.identifier === 'customization-probe',
  );
  assert(node);
  const result = JSON.parse(node.label.slice(node.label.indexOf('{')));
  assert.equal(result.result, 'PASS', result.error);
  assert.equal(result.keyboardType, 'default');
  assert.equal(result.landscape, false);
  return result;
};
try {
  run('press', 'label="raised"', '--settle');
  await pause(400);
  const raised = await inspect();
  const path = `${dir}/raised.png`;
  run('screenshot', path);
  const png = PNG.sync.read(readFileSync(path));
  const scale = png.width / raised.width;
  const samples = [];
  for (const [name, labels, rgb] of [
    ['space', ['space', ''], [0, 60, 105]],
    ['delete', ['Delete'], [248, 210, 64]],
    ['return', ['return', 'Submit'], [255, 69, 34]],
  ]) {
    const key = raised.keyFrames.find((k) => labels.includes(k.label));
    assert(key, `Missing ${name}`);
    // Blank strip near the top of each face, below its rounded corners.
    // Android's old highlight gradient contaminated this strip on all keys.
    let matching = 0,
      total = 0;
    for (
      let y = Math.ceil((key.y + 9) * scale);
      y < (key.y + 11) * scale;
      y++
    ) {
      for (
        let x = Math.ceil((key.x + key.width * 0.3) * scale);
        x < (key.x + key.width * 0.7) * scale;
        x++
      ) {
        const i = (y * png.width + x) * 4;
        if (rgb.every((v, c) => Math.abs(png.data[i + c] - v) <= 2)) matching++;
        total++;
      }
    }
    assert(total > 0);
    samples.push({ name, rgb, matching, total });
    assert(
      matching / total > 0.98,
      `${name}: raised material changed the configured face color (${matching}/${total} pixels)`,
    );
  }
  run('press', 'label="flat"', '--settle');
  const flat = await inspect();
  const geometry = (metrics) =>
    metrics.keyFrames.map(({ label, ...rect }) => rect);
  assert.deepEqual(
    geometry(raised),
    geometry(flat),
    'Material changed key layout',
  );
  run('press', 'label="raised"', '--settle');
  writeFileSync(
    `${dir}/results.json`,
    JSON.stringify(
      { result: 'PASS', platform, samples, raised, flat },
      null,
      2,
    ),
  );
  console.log(
    `${platform}: PASS solid raised colors for space/delete/return and unchanged layout`,
  );
} catch (error) {
  writeFileSync(
    `${dir}/results.json`,
    JSON.stringify({ result: 'FAIL', platform, error: String(error) }, null, 2),
  );
  throw error;
}
