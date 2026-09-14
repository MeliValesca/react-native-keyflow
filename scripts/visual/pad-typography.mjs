/** Compare rendered iOS pad glyph bounds against recorded native captures. */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
const source = process.argv[2] || 'artifacts/layouts/ios/visual-latest.json';
const data = JSON.parse(readFileSync(source));
assert.equal(data.platform, 'ios');
assert.equal(data.result, 'PASS');
function raster(path, orientation) {
  const png = PNG.sync.read(readFileSync(path));
  const scale = Math.min(png.width, png.height) / 402;
  assert([1, 3].includes(scale), 'Reference iPhone viewport required');
  const rotate = orientation !== 'portrait' && png.height > png.width;
  return (x, y) => {
    const dx = Math.floor(x * scale),
      dy = Math.floor(y * scale);
    const sx = rotate
      ? orientation === 'landscape-left'
        ? png.width - 1 - dy
        : dy
      : dx;
    const sy = rotate
      ? orientation === 'landscape-left'
        ? dx
        : png.height - 1 - dx
      : dy;
    const i = (sy * png.width + sx) * 4;
    return png.data[i] < 160 && png.data[i + 1] < 160 && png.data[i + 2] < 160;
  };
}
function ink(read, face, wide, legend) {
  const center = (face.left + face.right) / 2;
  const left = Math.ceil(wide ? center + (legend ? 13 : -13) : face.left + 10);
  const right = Math.floor(
    wide ? (legend ? face.right - 8 : center + 13) : face.right - 10,
  );
  const top = face.top + (wide ? 2 : legend ? 32 : 2);
  const bottom = wide
    ? face.bottom - 1
    : legend
    ? face.bottom - 1
    : face.top + 32;
  const points = [];
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++) if (read(x, y)) points.push([x, y]);
  assert(points.length, 'Missing rendered glyph');
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...ys) - Math.min(...ys) + 1,
    top: Math.min(...ys) - face.top,
  };
}
const checks = [];
for (const orientation of ['portrait', 'landscape-left', 'landscape-right']) {
  const pair = data.geometry.find((g) => g.name === `${orientation}-phone-pad`);
  assert(pair?.pass);
  const readers = ['system', 'custom'].map((mode) =>
    raster(
      data.captures.find(
        (c) => c.name === `${orientation}-phone-pad-${mode}-idle`,
      ).path,
      orientation,
    ),
  );
  for (let index = 0; index < 10; index++)
    for (const legend of [false, true]) {
      if (legend && (index === 0 || index === 9)) continue;
      const a = ink(
        readers[0],
        pair.native[index],
        orientation !== 'portrait',
        legend,
      );
      const b = ink(
        readers[1],
        pair.custom[index],
        orientation !== 'portrait',
        legend,
      );
      const pass =
        Math.abs(a.width - b.width) <= 1 &&
        Math.abs(a.height - b.height) <= 1 &&
        Math.abs(a.top - b.top) <= 2;
      checks.push({
        name: `${orientation} ${index === 9 ? '0' : index + 1} ${
          legend ? 'alphabet' : 'digit'
        }`,
        native: a,
        custom: b,
        pass,
      });
    }
}
const result = checks.every((c) => c.pass) ? 'PASS' : 'FAIL';
const report = {
  result,
  source: `${data.output}/results.json`,
  checks,
  scope:
    'Rendered light-theme iOS phone-pad digit/alphabet ink bounds. Width/height tolerance 1pt; vertical position tolerance 2pt. Not a font-outline or weight identity check.',
};
writeFileSync(
  `${data.output}/typography.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  `${result}: ${checks.filter((c) => c.pass).length}/${
    checks.length
  } glyph-bound comparisons`,
);
for (const c of checks.filter((c) => !c.pass)) console.log(JSON.stringify(c));
if (result !== 'PASS') process.exitCode = 1;
