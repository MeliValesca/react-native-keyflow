/** Compare stable keyboard pixels, never editor text, status-bar time or caret. */
export function compareKeyboardPixels(
  reference,
  current,
  { channelTolerance = 12, maxChangedFraction = 0.005 } = {},
) {
  if (reference.width !== current.width || reference.height !== current.height)
    throw new Error('Reference and current capture dimensions differ');
  const scale =
    reference.width === 1206 ? 3 : reference.width === 411 ? 1 : null;
  if (!scale || reference.height !== (scale === 3 ? 2622 : 914))
    throw new Error('Unsupported reference viewport');
  const top = (scale === 3 ? 510 : 530) * scale;
  let changed = 0,
    samples = 0;
  const diff = new Uint8Array(reference.data.length);
  for (let y = top; y < reference.height; y++)
    for (let x = 0; x < reference.width; x++) {
      const p = (y * reference.width + x) * 4;
      const mismatch = [0, 1, 2].some(
        (c) =>
          Math.abs(reference.data[p + c] - current.data[p + c]) >
          channelTolerance,
      );
      if (mismatch) changed++;
      samples++;
      diff[p] = mismatch ? 255 : current.data[p] * 0.25;
      diff[p + 1] = mismatch ? 0 : current.data[p + 1] * 0.25;
      diff[p + 2] = mismatch ? 90 : current.data[p + 2] * 0.25;
      diff[p + 3] = 255;
    }
  return {
    pass: changed / samples <= maxChangedFraction,
    changed,
    samples,
    changedFraction: changed / samples,
    channelTolerance,
    maxChangedFraction,
    diff,
  };
}
