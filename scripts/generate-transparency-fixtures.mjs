import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

// Deterministic image fixtures: hard edges expose blur/refraction and opaque backing.
mkdirSync('example/assets/backdrops', { recursive: true });
for (const variant of [0, 1]) {
  const png = new PNG({ width: 804, height: 1748 });
  const colors = variant
    ? [
        [251, 188, 113],
        [237, 135, 143],
        [143, 196, 247],
        [228, 208, 255],
      ]
    : [
        [182, 234, 214],
        [108, 208, 165],
        [148, 202, 237],
        [238, 226, 180],
      ];
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const band = Math.floor((x + y * 0.35) / 140) % colors.length;
      const grid = x % 80 < 3 || y % 80 < 3;
      const circle = Math.hypot(x - 470, y - 1340) < 220;
      const color = circle
        ? variant
          ? [157, 169, 236]
          : [54, 191, 91]
        : colors[band];
      for (let c = 0; c < 3; c++)
        png.data[i + c] = grid ? Math.round(color[c] * 0.75) : color[c];
      png.data[i + 3] = 255;
    }
  }
  writeFileSync(
    `example/assets/backdrops/transparency-${variant}.png`,
    PNG.sync.write(png),
  );
}
