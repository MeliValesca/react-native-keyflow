/** Compare full-size screenshots from Transparency with both Background and Keys at 0%,
 * with its keyboard shown/hidden and both backgrounds. This fails on an opaque
 * OR blurred backdrop. The default 70% preset intentionally has visible fills.
 * node scripts/verify-transparency.mjs ios|android
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const platform = process.argv[2];
if (!['ios', 'android'].includes(platform))
  throw new Error('Supply ios or android');
const read = (name, index) =>
  PNG.sync.read(
    readFileSync(`artifacts/${name}-${platform}-image${index}.png`),
  );
const transparent = [read('transparent', 0), read('transparent', 1)];
const background = [read('background', 0), read('background', 1)];
const reference = transparent[0];
for (const frame of [...transparent, ...background])
  if (frame.width !== reference.width || frame.height !== reference.height)
    throw new Error('Capture sizes must match');
const logicalWidth = platform === 'ios' ? 402 : 411;
const scale = reference.width / logicalWidth;
const region = platform === 'ios' ? [8, 600, 394, 790] : [8, 657, 403, 818];
let count = 0,
  clear = [0, 0],
  changed = 0;
const delta = (a, b, p) =>
  Math.max(...[0, 1, 2].map((c) => Math.abs(a.data[p + c] - b.data[p + c])));
for (let y = Math.round(region[1] * scale); y < region[3] * scale; y++)
  for (let x = Math.round(region[0] * scale); x < region[2] * scale; x++) {
    const p = (y * reference.width + x) * 4;
    count++;
    for (let i = 0; i < 2; i++)
      if (delta(transparent[i], background[i], p) <= 5) clear[i]++;
    if (delta(transparent[0], transparent[1], p) > 15) changed++;
  }
const sharpBackgroundFraction = clear.map((n) => n / count);
const imageSwapFraction = changed / count;
const pass =
  sharpBackgroundFraction.every((n) => n > 0.85) && imageSwapFraction > 0.75;
const result = {
  result: pass ? 'PASS' : 'FAIL',
  platform,
  region,
  sharpBackgroundFraction,
  imageSwapFraction,
  note: 'Sharp-match threshold allows only key glyphs and controls to obscure the reference.',
};
writeFileSync(
  `artifacts/native-parity/${platform}/transparency.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
if (!pass) process.exitCode = 1;
