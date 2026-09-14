import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
// Captures from the same 1206x2622 iPhone 17, light English keyboard, held Q.
const directory = 'artifacts/press-opening';
const samples = ['apple-light-press', 'keyflow-light-press'].map((name) => {
  const png = PNG.sync.read(readFileSync(`${directory}/${name}.png`));
  if (png.width !== 1206 || png.height !== 2622)
    throw new Error('Wrong reference device size');
  const sum = [0, 0, 0];
  let count = 0;
  // Interior beside the popup legend, excluding text, contour, and shadow.
  for (let y = 1640; y < 1670; y++)
    for (let x = 45; x < 60; x++) {
      for (let c = 0; c < 3; c++)
        sum[c] += png.data[(y * png.width + x) * 4 + c];
      count++;
    }
  return { name, rgb: sum.map((n) => n / count) };
});
const difference = samples[0].rgb.map((c, i) =>
  Math.abs(c - samples[1].rgb[i]),
);
if (difference.some((n) => n > 3))
  throw new Error(`Pressed color differs: ${JSON.stringify(samples)}`);
const result = {
  result: 'PASS',
  samples,
  difference,
  scope: 'Light iOS popup fill only; not shape or full visual parity.',
};
writeFileSync(
  `${directory}/press-color-results.json`,
  JSON.stringify(result, null, 2),
);
console.log(result);
