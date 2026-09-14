/** Pixel regression for the default E long-press menu on the pinned reference
 * devices. Unlike AX checks, this fails when the letters exist but are invisible.
 * Usage: node scripts/verify-accent-contrast.mjs ios|android light|dark image.png
 */
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const [platform, appearance, path] = process.argv.slice(2);
if (
  !['ios', 'android'].includes(platform) ||
  !['light', 'dark'].includes(appearance) ||
  !path
)
  throw new Error('Supply ios|android light|dark screenshot.png');
const png = PNG.sync.read(readFileSync(path));
const scale = platform === 'ios' ? 3 : 1;
if (
  png.width !== (platform === 'ios' ? 1206 : 411) ||
  png.height !== (platform === 'ios' ? 2622 : 914)
)
  throw new Error(
    'Capture must use the pinned reference device without resizing',
  );
const count = platform === 'ios' ? 10 : 6;
const selected = platform === 'ios' ? 2 : 4;
const results = [];
for (let index = 0; index < count; index++) {
  const cx =
    platform === 'ios' ? 5 + (index + 0.5) * 39.2 : 58 + (index % 3) * 44;
  const cy = platform === 'ios' ? 551 : 570 + Math.floor(index / 3) * 44;
  const bright = appearance === 'dark' || index === selected;
  let ink = 0;
  for (let y = Math.round((cy - 14) * scale); y < (cy + 14) * scale; y++) {
    for (let x = Math.round((cx - 11) * scale); x < (cx + 11) * scale; x++) {
      const offset = (y * png.width + x) * 4;
      const rgb = [...png.data.subarray(offset, offset + 3)];
      if (bright ? rgb.every((v) => v > 210) : rgb.every((v) => v < 85)) ink++;
    }
  }
  // Require actual foreground strokes in every individual cell, including the
  // selected one. Blank white cells and accessibility-only labels cannot pass.
  const visible = ink >= 15 * scale * scale && ink < 500 * scale * scale;
  results.push({ index, inkPixels: ink, visible });
}
console.log(JSON.stringify({ platform, appearance, path, results }, null, 2));
if (results.some((r) => !r.visible))
  throw new Error(
    'Accent foreground is missing or indistinguishable from its background',
  );
