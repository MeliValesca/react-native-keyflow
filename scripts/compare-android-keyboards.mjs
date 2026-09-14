import fs from 'node:fs';
import { PNG } from 'pngjs';

// Usage: node scripts/compare-android-keyboards.mjs reference.png candidate.png report.json
// Uses actual screen coordinates, with no translation or rescaling of the candidate.
const [referencePath, candidatePath, outputPath] = process.argv.slice(2);
if (!outputPath)
  throw new Error('Provide reference.png candidate.png report.json');
const read = (path) => PNG.sync.read(fs.readFileSync(path));
const reference = read(referencePath),
  candidate = read(candidatePath);
if (
  reference.width !== candidate.width ||
  reference.height !== candidate.height
)
  throw new Error(
    'Reference and candidate must have identical screen dimensions',
  );
const dark = referencePath.includes('dark');
const faceColor = dark ? [51, 52, 58] : [255, 255, 255];
function faces(image) {
  const { width, height, data } = image;
  const visited = new Uint8Array(width * height),
    found = [];
  const match = (i) =>
    faceColor.every((value, channel) => data[i * 4 + channel] === value);
  for (let y = Math.floor(height * 0.57); y < height - 24; y++) {
    for (let x = 0; x < width; x++) {
      const origin = y * width + x;
      if (visited[origin] || !match(origin)) continue;
      let left = x,
        right = x,
        top = y,
        bottom = y,
        count = 0;
      const queue = [origin];
      visited[origin] = 1;
      while (queue.length) {
        const index = queue.pop(),
          px = index % width,
          py = Math.floor(index / width);
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
        count++;
        for (const next of [
          index - width,
          index + width,
          ...(px ? [index - 1] : []),
          ...(px < width - 1 ? [index + 1] : []),
        ]) {
          if (
            next >= 0 &&
            next < width * height &&
            !visited[next] &&
            match(next)
          ) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
      if (
        count > 150 &&
        right - left < width * 0.5 &&
        bottom - top < 80 &&
        bottom - top > 35
      )
        found.push({ left, top, right, bottom });
    }
  }
  return found.sort((a, b) =>
    Math.abs(a.top - b.top) > 5 ? a.top - b.top : a.left - b.left,
  );
}
function ink(image, box) {
  const points = [];
  // Exclude number hints in the top-right corner, and antialiased key edges.
  for (let y = box.top + 10; y <= box.bottom - 3; y++)
    for (let x = box.left + 2; x <= box.right - 2; x++) {
      if (y < box.top + 16 && x > box.right - 10) continue;
      const i = (y * image.width + x) * 4;
      const values = [...image.data.slice(i, i + 3)];
      if (dark ? Math.min(...values) > 155 : Math.max(...values) < 125)
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
const a = faces(reference),
  b = faces(candidate);
const differences = a.map((face, index) => {
  const other = b[index];
  return {
    reference: face,
    candidate: other,
    faceError: other
      ? Math.max(...Object.keys(face).map((k) => Math.abs(face[k] - other[k])))
      : null,
    referenceInk: ink(reference, face),
    candidateInk: other ? ink(candidate, other) : null,
  };
});
const errors = differences.map((d) => d.faceError).filter((v) => v !== null);
const inkErrors = differences
  .slice(0, 26)
  .flatMap((item) =>
    item.referenceInk && item.candidateInk
      ? item.referenceInk.map((value, i) =>
          Math.abs(value - item.candidateInk[i]),
        )
      : [],
  );
const row = a[19];
const firstLetter = a[19];
const lastLetter = a[25];
const bottom = a[a.length - 1];
const actionRegions = referencePath.includes('numbers')
  ? []
  : [
      {
        name: 'shift',
        left: 2,
        right: firstLetter.left - 4,
        top: row.top,
        bottom: row.bottom,
      },
      {
        name: 'delete',
        left: lastLetter.right + 4,
        right: reference.width - 3,
        top: row.top,
        bottom: row.bottom,
      },
      {
        name: 'submit',
        left: lastLetter.right + 4,
        right: reference.width - 3,
        top: bottom.top,
        bottom: bottom.bottom,
      },
    ];
const icons = actionRegions.map((region) => ({
  name: region.name,
  reference: ink(reference, region),
  candidate: ink(candidate, region),
}));
const sample = (image, x, y) => {
  const index = (Math.round(y) * image.width + Math.round(x)) * 4;
  return [...image.data.slice(index, index + 3)];
};
const palettePoints = [
  ['panel', 0, reference.height - 50],
  ['navigation', 0, reference.height - 12],
  ['special', firstLetter.left / 4, (row.top + row.bottom) / 2],
  ['submit', reference.width - 12, (bottom.top + bottom.bottom) / 2],
];
const palette = palettePoints.map(([name, x, y]) => {
  const expected = sample(reference, x, y),
    actual = sample(candidate, x, y);
  return {
    name,
    expected,
    actual,
    maxChannelError: Math.max(
      ...expected.map((c, i) => Math.abs(c - actual[i])),
    ),
  };
});
const report = {
  referencePath,
  candidatePath,
  width: reference.width,
  height: reference.height,
  referenceFaces: a.length,
  candidateFaces: b.length,
  maxFaceError: Math.max(...errors),
  meanFaceError: errors.reduce((x, y) => x + y, 0) / errors.length,
  maxInkError: Math.max(...inkErrors),
  meanInkError: inkErrors.reduce((a, b) => a + b, 0) / inkErrors.length,
  icons,
  palette,
  differences,
};
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    referenceFaces: a.length,
    candidateFaces: b.length,
    maxFaceError: report.maxFaceError,
    meanFaceError: report.meanFaceError,
  }),
);
if (
  a.length < 28 ||
  a.length !== b.length ||
  report.maxFaceError > 2 ||
  icons.some((icon) => !icon.candidate) ||
  palette.some((color) => color.maxChannelError > 3)
)
  process.exitCode = 1;
