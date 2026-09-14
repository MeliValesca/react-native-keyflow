import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareKeyboardPixels } from './pixels.mjs';
const image = () => ({
  width: 411,
  height: 914,
  data: Buffer.alloc(411 * 914 * 4, 255),
});
test('identical keyboard passes', () => {
  assert.equal(compareKeyboardPixels(image(), image()).pass, true);
});
test('status bar and editor changes do not count', () => {
  const current = image();
  current.data.fill(0, 0, 411 * 500 * 4);
  assert.equal(compareKeyboardPixels(image(), current).pass, true);
});
test('missing keyboard foreground fails and produces diff pixels', () => {
  const reference = image(),
    current = image();
  for (let y = 600; y < 630; y++)
    for (let x = 0; x < 100; x++) {
      const p = (y * 411 + x) * 4;
      reference.data[p] = reference.data[p + 1] = reference.data[p + 2] = 0;
    }
  const result = compareKeyboardPixels(reference, current);
  assert.equal(result.pass, false);
  assert.equal(result.changed, 3000);
  assert.equal(result.diff[600 * 411 * 4], 255);
});
test('wrong device size cannot silently pass', () => {
  assert.throws(
    () => compareKeyboardPixels(image(), { ...image(), width: 412 }),
    /dimensions/,
  );
});
