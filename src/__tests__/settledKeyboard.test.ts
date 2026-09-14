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

test('persistent overlap remains a failure after the bounded settling deadline', async () => {
  const overlapping = { ...metrics, editorBottom: 600 };
  const result = settledKeyboard(async () => ({
    visible: true,
    metrics: overlapping,
  }));
  let finished = false;
  void result.then(() => {
    finished = true;
  });
  await jest.advanceTimersByTimeAsync(4900);
  expect(finished).toBe(false);
  await jest.advanceTimersByTimeAsync(100);
  expect(await result).toEqual(overlapping);
  expect((await result).editorBottom! > (await result).screenY! + 1).toBe(true);
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

test('waits through a stable CI overlap until delayed avoidance settles', async () => {
  let bottom = 584.3333435058594;
  const read = jest.fn(async () => ({
    visible: true,
    metrics: { ...metrics, screenY: 581, editorBottom: bottom },
  }));
  const result = settledKeyboard(read);
  let finished = false;
  void result.then(() => {
    finished = true;
  });
  await jest.advanceTimersByTimeAsync(1200);
  expect(finished).toBe(false);
  bottom = 569;
  await jest.advanceTimersByTimeAsync(200);
  expect(finished).toBe(false);
  await jest.advanceTimersByTimeAsync(200);
  expect((await result).editorBottom).toBe(569);
});

test('one clear sample followed by overlap cannot pass', async () => {
  let bottom = 600;
  const result = settledKeyboard(async () => ({
    visible: true,
    metrics: { ...metrics, editorBottom: bottom },
  }));
  let finished = false;
  void result.then(() => {
    finished = true;
  });
  await jest.advanceTimersByTimeAsync(800);
  bottom = 500;
  await jest.advanceTimersByTimeAsync(100);
  bottom = 600;
  await jest.advanceTimersByTimeAsync(1000);
  expect(finished).toBe(false);
  await jest.advanceTimersByTimeAsync(3100);
  expect((await result).editorBottom).toBe(600);
});
