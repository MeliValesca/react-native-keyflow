import test from 'node:test';
import assert from 'node:assert/strict';
import { colorCount } from './customization-pixels.mjs';
const key = { x: 10, y: 20, width: 20, height: 20 };
const tint = [163, 92, 234],
  background = [24, 51, 75];
function image(width, height, x, y, rgb) {
  const data = Buffer.alloc(width * height * 4);
  rgb.forEach((v, c) => {
    data[(y * width + x) * 4 + c] = v;
  });
  return { width, height, data };
}
test('iOS ROI maps logical key coordinates through both rotated screenshot axes', () => {
  for (const scale of [1, 3]) {
    const width = 402 * scale,
      height = 874 * scale;
    for (const [orientation, x, y] of [
      ['portrait', 16 * scale, 25 * scale],
      ['landscape-left', width - 1 - 25 * scale, 16 * scale],
      ['landscape-right', 25 * scale, height - 1 - 16 * scale],
    ]) {
      assert.equal(
        colorCount(
          'ios',
          image(width, height, x, y, tint),
          orientation,
          key,
          tint,
        ),
        1,
      );
    }
  }
});
test('Android ripple check accepts composited tint and rejects untouched background', () => {
  const composite = tint.map((v, c) =>
    Math.round(background[c] + 0.6 * (v - background[c])),
  );
  assert.equal(
    colorCount(
      'android',
      image(411, 914, 16, 25, composite),
      'portrait',
      key,
      tint,
      background,
    ),
    1,
  );
  assert.equal(
    colorCount(
      'android',
      image(411, 914, 16, 25, background),
      'portrait',
      key,
      tint,
      background,
    ),
    0,
  );
  assert.equal(
    colorCount(
      'android',
      image(411, 914, 16, 25, [255, 255, 255]),
      'portrait',
      key,
      tint,
      background,
    ),
    0,
  );
});
