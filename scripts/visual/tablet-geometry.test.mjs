import assert from 'node:assert/strict';
import test from 'node:test';

const android = (shortEdge) => {
  const row = Math.round(shortEdge * 0.0825);
  return {
    row,
    toolbar: Math.round(shortEdge * 0.06),
    bottom: Math.round(shortEdge * 0.0275),
  };
};

const ios = (shortEdge, safeBottom, landscape) => ({
  row: shortEdge * (landscape ? 0.10252 : 0.07734),
  top: shortEdge * (landscape ? 0.0132 : 0.0084),
  assistant: shortEdge * 0.06595,
  bottom: Math.max(safeBottom, shortEdge * 0.024),
});

const tabletSizes = [
  [600, 960],
  [720, 1280],
  [768, 1024],
  [800, 1280],
  [834, 1194],
  [1024, 1366],
  [1280, 1600],
];

test('Android tablet keyboard scales from the device short edge', () => {
  for (const dimensions of tabletSizes) {
    for (const [width, height] of [dimensions, dimensions.toReversed()]) {
      const metrics = android(Math.min(width, height));
      const panel = metrics.toolbar + metrics.row * 4 + metrics.bottom;
      assert(panel > metrics.row * 4);
      assert(panel < height);
      assert(metrics.row > 0);
    }
  }
});

test('iOS tablet keyboard scales in both orientations and clears safe area', () => {
  for (const dimensions of tabletSizes) {
    for (const [width, height] of [dimensions, dimensions.toReversed()]) {
      const metrics = ios(Math.min(width, height), 20, width > height);
      const panel =
        metrics.assistant + metrics.top + metrics.row * 4 + metrics.bottom;
      assert(panel >= metrics.row * 4 + 20);
      assert(panel < height);
      assert(metrics.row > 0);
    }
  }
});

test('rotation follows each native tablet orientation profile', () => {
  for (const [width, height] of tabletSizes) {
    assert.equal(
      android(Math.min(width, height)).row,
      android(Math.min(height, width)).row,
    );
    const portrait = ios(Math.min(width, height), 20, false);
    const landscape = ios(Math.min(height, width), 20, true);
    assert(landscape.row > portrait.row);
    assert(Math.abs(landscape.row / portrait.row - 0.10252 / 0.07734) < 1e-12);
  }
});
