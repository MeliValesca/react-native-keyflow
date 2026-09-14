import assert from 'node:assert/strict';
export function colorCount(platform, png, orientation, key, rgb, background) {
  const scale = platform === 'ios' ? Math.min(png.width, png.height) / 402 : 1;
  assert([1, 3].includes(scale));
  const rotated =
    platform === 'ios' && orientation !== 'portrait' && png.width < png.height;
  let count = 0;
  for (let y = Math.ceil(key.y + 4); y < key.y + key.height - 4; y++)
    for (let x = Math.ceil(key.x + 5); x < key.x + key.width - 5; x++) {
      const dx = Math.floor(x * scale),
        dy = Math.floor(y * scale);
      const sx = rotated
        ? orientation === 'landscape-left'
          ? png.width - 1 - dy
          : dy
        : dx;
      const sy = rotated
        ? orientation === 'landscape-left'
          ? dx
          : png.height - 1 - dx
        : dy;
      const i = (sy * png.width + sx) * 4;
      if (background) {
        // RippleDrawable composites the supplied tint over the key face.
        const alpha =
          (png.data[i + 2] - background[2]) / (rgb[2] - background[2]);
        if (
          alpha >= 0.1 &&
          alpha <= 1 &&
          rgb.every(
            (v, c) =>
              Math.abs(
                png.data[i + c] - (background[c] + alpha * (v - background[c])),
              ) <= 4,
          )
        )
          count++;
      } else if (rgb.every((v, c) => Math.abs(png.data[i + c] - v) <= 3))
        count++;
    }
  return count;
}
