import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

// Compare File > Save Screen exports from the same iPhone 17, iOS 26.5,
// portrait, English QWERTY, default-size example. This measures visible key
// and ink bounds, not animation or full equivalence.
const [referencePath, candidatePath, reportPath] = process.argv.slice(2);
if (!referencePath || !candidatePath) {
  throw new Error(
    'Usage: node scripts/compare-ios-keyboards.mjs apple.png keyflow.png [report.json]',
  );
}
function measure(path) {
  const png = PNG.sync.read(readFileSync(path));
  if (png.width !== 1206 || png.height !== 2622) {
    throw new Error('Use a full-resolution 1206 × 2622 simulator export.');
  }
  const { width, height, data } = png;
  const pixel = (x, y) =>
    Array.from(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 3));
  const faceColor = pixel(40, 1820);
  const dark = faceColor[0] < 128;
  const isFace = (i) =>
    faceColor.every((channel, c) => Math.abs(data[i * 4 + c] - channel) <= 3);
  const isInk = (i) =>
    [0, 1, 2].every((c) =>
      dark ? data[i * 4 + c] >= 200 : data[i * 4 + c] < 128,
    );
  const seen = new Uint8Array(width * height);
  const keys = [];
  for (let y = 1730; y < 2410; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (seen[start] || !isFace(start)) continue;
      const queue = [start];
      seen[start] = 1;
      let left = x,
        top = y,
        right = x,
        bottom = y;
      for (let k = 0; k < queue.length; k++) {
        const at = queue[k],
          px = at % width,
          py = Math.floor(at / width);
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
        for (const next of [at - 1, at + 1, at - width, at + width]) {
          if (
            next >= 1730 * width &&
            next < 2410 * width &&
            !seen[next] &&
            isFace(next)
          ) {
            seen[next] = 1;
            queue.push(next);
          }
        }
      }
      if (queue.length > 4000)
        keys.push({
          x: left,
          y: top,
          width: right - left + 1,
          height: bottom - top + 1,
        });
    }
  }
  keys.sort((a, b) => a.y - b.y || a.x - b.x);
  function ink(rect) {
    let left = Infinity,
      top = Infinity,
      right = -1,
      bottom = -1;
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        if (isInk(y * width + x)) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    return right < 0
      ? null
      : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  }
  return {
    path,
    width,
    height,
    faceColor,
    background: pixel(600, 2430),
    keys: keys.map((face) => ({ face, ink: ink(face) })),
  };
}
const reference = measure(referencePath);
const candidate = measure(candidatePath);
if (
  reference.keys.length < 29 ||
  reference.keys.length !== candidate.keys.length
) {
  throw new Error(
    `Different keyboard states: ${reference.keys.length} reference keys / ${candidate.keys.length} candidate keys`,
  );
}
const delta = (a, b) =>
  Object.fromEntries(
    ['x', 'y', 'width', 'height'].map((key) => [key, b[key] - a[key]]),
  );
const keys = reference.keys.map((a, index) => {
  const b = candidate.keys[index];
  if (!!a.ink !== !!b.ink)
    throw new Error(`Different key content at index ${index}`);
  return {
    index,
    faceDelta: delta(a.face, b.face),
    inkDelta: a.ink ? delta(a.ink, b.ink) : null,
  };
});
const faceErrors = keys.flatMap((key) =>
  Object.values(key.faceDelta).map(Math.abs),
);
const inkErrors = keys.flatMap((key) =>
  key.inkDelta ? Object.values(key.inkDelta).map(Math.abs) : [],
);
const summary = {
  keyCount: keys.length,
  maxFaceErrorPx: Math.max(...faceErrors),
  maxInkErrorPx: Math.max(...inkErrors),
  meanInkErrorPx:
    inkErrors.reduce((sum, value) => sum + value, 0) / inkErrors.length,
};
const report = { reference, candidate, summary, keys };
if (reportPath)
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
// One physical pixel for key faces; two points for ink accommodates the
// documented fallback font and optical differences in system symbols.
if (summary.maxFaceErrorPx > 1 || summary.maxInkErrorPx > 6)
  process.exitCode = 1;
