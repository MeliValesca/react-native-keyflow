/** Compare light-theme key faces in device points. No image alignment is performed. */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const [platform, nativePath, customPath, output] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !output)
  throw new Error('Supply platform native.png custom.png report.json');
function normalize(path) {
  const input = PNG.sync.read(readFileSync(path));
  const scale =
    platform === 'ios' ? Math.min(input.width, input.height) / 402 : 1;
  if (![1, 3].includes(scale)) throw new Error('Unsupported reference device');
  const wide = path.includes('landscape');
  const rotate = wide && input.height > input.width;
  const width = (rotate ? input.height : input.width) / scale;
  const height = (rotate ? input.width : input.height) / scale;
  if (!Number.isInteger(width) || !Number.isInteger(height))
    throw new Error('Unsupported scale');
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = x * scale + Math.floor(scale / 2),
        dy = y * scale + Math.floor(scale / 2);
      const sx = rotate
        ? path.includes('landscape-left')
          ? input.width - 1 - dy
          : dy
        : dx;
      const sy = rotate
        ? path.includes('landscape-left')
          ? dx
          : input.height - 1 - dx
        : dy;
      for (let c = 0; c < 3; c++)
        data[(y * width + x) * 3 + c] =
          input.data[(sy * input.width + sx) * 4 + c];
    }
  return { width, height, data };
}
function faces(image) {
  const { width, height, data } = image;
  const top =
    width > height ? Math.floor(height * 0.45) : platform === 'ios' ? 580 : 640;
  const white = (i) =>
    data[i * 3] >= 253 && data[i * 3 + 1] >= 253 && data[i * 3 + 2] >= 253;
  const seen = new Uint8Array(width * height),
    found = [];
  for (let i = top * width; i < width * (height - 20); i++) {
    if (seen[i] || !white(i)) continue;
    let left = i % width,
      right = left,
      y = Math.floor(i / width),
      bottom = y;
    const queue = [i];
    seen[i] = 1;
    for (let at = 0; at < queue.length; at++) {
      const next = queue[at],
        x = next % width,
        py = Math.floor(next / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      y = Math.min(y, py);
      bottom = Math.max(bottom, py);
      for (const neighbor of [
        next - width,
        next + width,
        ...(x > 0 ? [next - 1] : []),
        ...(x < width - 1 ? [next + 1] : []),
      ])
        if (
          neighbor >= top * width &&
          neighbor < width * (height - 20) &&
          !seen[neighbor] &&
          white(neighbor)
        ) {
          seen[neighbor] = 1;
          queue.push(neighbor);
        }
    }
    if (
      queue.length > 200 &&
      (width < height || right - left > 45) &&
      bottom - y >= 18 &&
      bottom - y <= 60
    )
      found.push({ left, top: y, right, bottom });
  }
  found.sort((a, b) => a.top - b.top || a.left - b.left);
  if (nativePath.includes('default')) {
    const rows = [...new Set(found.map((f) => f.top))].sort((a, b) => a - b);
    return found.filter((f) => f.top <= rows[2]);
  }
  return found;
}
const a = normalize(nativePath),
  b = normalize(customPath);
if (a.width !== b.width || a.height !== b.height)
  throw new Error('Viewport mismatch');
const native = faces(a),
  custom = faces(b);
const expected = nativePath.includes('default')
  ? platform === 'ios'
    ? 28
    : 26
  : platform === 'ios'
  ? 10
  : 12;
const deltas =
  native.length === custom.length
    ? native.map((face, i) =>
        Math.max(
          ...['left', 'top', 'right', 'bottom'].map((edge) =>
            Math.abs(face[edge] - custom[i][edge]),
          ),
        ),
      )
    : [];
const result = {
  pass:
    native.length === expected &&
    custom.length === expected &&
    deltas.every((delta) => delta <= 3),
  expected,
  nativeCount: native.length,
  customCount: custom.length,
  maxEdgeDifference: deltas.length ? Math.max(...deltas) : null,
  tolerance: 3,
  native,
  custom,
  scope:
    'Light key-face geometry in device points. Excludes QWERTY bottom row/dock, colors, glyph outlines, and animation timing.',
};
writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (!result.pass) process.exitCode = 1;
