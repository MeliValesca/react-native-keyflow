/** Compare pinned portrait QWERTY captures. No alignment or rescaling is applied.
 * node scripts/compare-qwerty-defaults.mjs ios|android native.png custom.png report.json
 * The toolbar and absent dock controls are reported exclusions, never pixel-parity claims.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const [platform, referencePath, candidatePath, output] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !output)
  throw new Error('Supply platform, native.png, custom.png, report.json');
const reference = PNG.sync.read(readFileSync(referencePath));
const candidate = PNG.sync.read(readFileSync(candidatePath));
const width = platform === 'ios' ? 402 : 411;
const height = platform === 'ios' ? 874 : 914;
if (
  reference.width !== width ||
  reference.height !== height ||
  candidate.width !== width ||
  candidate.height !== height
)
  throw new Error(
    `Requires ${width}x${height} captures from the same reference device`,
  );
const rgb = (image, x, y) => [
  ...image.data.slice((y * width + x) * 4, (y * width + x) * 4 + 3),
];
const dark = rgb(reference, 20, platform === 'ios' ? 600 : 660)[0] < 128;
const color =
  platform === 'ios'
    ? dark
      ? [94, 95, 97]
      : [255, 255, 255]
    : dark
    ? [51, 52, 58]
    : [255, 255, 255];
const startY = platform === 'ios' ? 580 : 650;
function measure(image) {
  const seen = new Uint8Array(width * height);
  const match = (i) =>
    color.every((channel, c) => Math.abs(image.data[i * 4 + c] - channel) <= 2);
  const faces = [];
  for (let y = startY; y < height - 25; y++)
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (seen[index] || !match(index)) continue;
      const queue = [index];
      seen[index] = 1;
      let left = x,
        right = x,
        top = y,
        bottom = y;
      for (let at = 0; at < queue.length; at++) {
        const i = queue[at],
          px = i % width,
          py = Math.floor(i / width);
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
        for (const next of [
          i - width,
          i + width,
          ...(px > 0 ? [i - 1] : []),
          ...(px < width - 1 ? [i + 1] : []),
        ]) {
          if (
            next >= startY * width &&
            next < (height - 25) * width &&
            !seen[next] &&
            match(next)
          ) {
            seen[next] = 1;
            queue.push(next);
          }
        }
      }
      if (queue.length > 500 && bottom - top >= 35 && bottom - top < 60)
        faces.push({ left, top, right, bottom });
    }
  faces.sort((a, b) => a.top - b.top || a.left - b.left);
  // Gboard's removed emoji key gives its space key a different width. Compare
  // all 26 letters, and evaluate the remaining action keys separately below.
  return platform === 'android' ? faces.filter((f) => f.top < 820) : faces;
}
function ink(image, face) {
  const points = [];
  for (let y = face.top + 3; y <= face.bottom - 3; y++)
    for (let x = face.left + 2; x <= face.right - 2; x++) {
      const channels = rgb(image, x, y);
      if (
        dark ? channels.every((c) => c > 180) : channels.every((c) => c < 125)
      )
        points.push([x, y]);
    }
  return points.length
    ? [
        Math.min(...points.map((p) => p[0])),
        Math.min(...points.map((p) => p[1])),
        Math.max(...points.map((p) => p[0])),
        Math.max(...points.map((p) => p[1])),
      ]
    : null;
}
const a = measure(reference),
  b = measure(candidate);
const expectedCount = platform === 'ios' ? 31 : 26;
const failures = [];
if (a.length !== expectedCount || b.length !== expectedCount)
  failures.push(
    `Expected ${expectedCount} faces; native=${a.length}, custom=${b.length}`,
  );
const keys = a.map((face, i) => {
  const other = b[i];
  if (!other) return { index: i, missing: true };
  const faceError = Math.max(
    ...Object.keys(face).map((k) => Math.abs(face[k] - other[k])),
  );
  const nativeInk = ink(reference, face),
    customInk = ink(candidate, other);
  const inkError =
    nativeInk && customInk
      ? Math.max(...nativeInk.map((v, i) => Math.abs(v - customInk[i])))
      : nativeInk === customInk
      ? 0
      : Infinity;
  if (faceError > 1) failures.push(`Key ${i}: face differs by ${faceError}px`);
  if (inkError > 2)
    failures.push(`Key ${i}: ink bounds differ by ${inkError}px`);
  return {
    index: i,
    native: face,
    custom: other,
    faceError,
    nativeInk,
    customInk,
    inkError,
  };
});
const actions =
  platform === 'android'
    ? [
        { name: 'shift', left: 5, right: 58, top: 772, bottom: 817 },
        { name: 'delete', left: 353, right: 404, top: 772, bottom: 817 },
        { name: 'return', left: 353, right: 404, top: 831, bottom: 877 },
      ]
    : [];
for (const face of actions) {
  const a = ink(reference, face),
    b = ink(candidate, face);
  if (!a || !b || Math.max(...a.map((v, i) => Math.abs(v - b[i]))) > 2)
    failures.push(`${face.name}: action icon bounds differ`);
}
const palette = [
  ['background', Math.floor(width / 2), height - 55],
  ['key', 20, platform === 'ios' ? 600 : 660],
].map(([name, x, y]) => {
  const native = rgb(reference, x, y),
    custom = rgb(candidate, x, y);
  const maxError = Math.max(...native.map((v, i) => Math.abs(v - custom[i])));
  if (maxError > 3) failures.push(`${name}: color differs by ${maxError}`);
  return { name, native, custom, maxError };
});
const report = {
  result: failures.length ? 'FAIL' : 'PASS',
  platform,
  dark,
  referencePath,
  candidatePath,
  tolerance: { facePx: 1, inkBoundsPx: 2, colorChannel: 3 },
  exclusions: [
    'Suggestions/toolbar content: separate functional checks; proprietary prediction unavailable',
    'Missing emoji/microphone controls',
    ...(platform === 'android'
      ? ['Widened space key after removing emoji key']
      : []),
  ],
  failures,
  palette,
  keys,
};
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({ result: report.result, checkedKeys: keys.length, failures }),
);
if (failures.length) process.exitCode = 1;
