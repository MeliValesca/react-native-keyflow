import { settledKeyboard } from '../../example/src/testing/settledKeyboard';
import type { KeyflowKeyboardMetrics } from '../testing';

const metrics: KeyflowKeyboardMetrics = {
  focused: true,
  editorBottom: 500,
  screenY: 512,
  width: 400,
  height: 300,
  keyCount: 30,
  violations: [],
  fonts: [],
};
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('waits for presentation and then stable measurements', async () => {
  let visible = false;
  let bottom = 800;
  const result = settledKeyboard(async () => ({
    visible,
    metrics: { ...metrics, editorBottom: bottom },
  }));
  let finished = false;
  void result.then(() => {
    finished = true;
  });
  await jest.advanceTimersByTimeAsync(700);
  expect(finished).toBe(false);
  visible = true;
  await jest.advanceTimersByTimeAsync(200);
  bottom = 500;
  await jest.advanceTimersByTimeAsync(200);
  expect(finished).toBe(false);
  await jest.advanceTimersByTimeAsync(200);
  expect(await result).toEqual(metrics);
});

test('returns stable overlapping geometry so the caller can fail the layout check', async () => {
  const overlapping = { ...metrics, editorBottom: 600 };
  const result = settledKeyboard(async () => ({
    visible: true,
    metrics: overlapping,
  }));
  await jest.advanceTimersByTimeAsync(600);
  expect(await result).toEqual(overlapping);
});

test('fails when no visible keyboard arrives', async () => {
  const result = settledKeyboard(async () => ({ visible: false, metrics }));
  await Promise.all([
    expect(result).rejects.toThrow('Keyboard did not settle'),
    jest.advanceTimersByTimeAsync(5100),
  ]);
});

test('does not finish before the baseline presentation allowance', async () => {
  let finished = false;
  const result = settledKeyboard(async () => ({ visible: true, metrics }));
  void result.then(() => {
    finished = true;
  });
  await jest.advanceTimersByTimeAsync(500);
  expect(finished).toBe(false);
  await jest.advanceTimersByTimeAsync(100);
  expect(await result).toEqual(metrics);
});
