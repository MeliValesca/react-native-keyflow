import { settledKeyboardMode } from '../../example/src/testing/settledKeyboardMode';
import type { KeyflowKeyboardMetrics } from '../diagnostics';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const metrics = (overrides: Partial<KeyflowKeyboardMetrics> = {}) =>
  ({
    keyboardMode: 'system',
    focused: true,
    systemKeyboardVisible: true,
    popupVisible: false,
    width: 400,
    height: 300,
    ...overrides,
  } as KeyflowKeyboardMetrics);

test('does not accept a transient visible IME during handoff', async () => {
  const start = Date.now();
  let finished = false;
  const read = jest.fn(async () =>
    metrics({
      systemKeyboardVisible:
        Date.now() - start < 200 || Date.now() - start >= 900,
    }),
  );
  const result = settledKeyboardMode(read, 'system').then((value) => {
    finished = true;
    return value;
  });
  await jest.advanceTimersByTimeAsync(1200);
  expect(finished).toBe(false);
  await jest.advanceTimersByTimeAsync(100);
  expect((await result).systemKeyboardVisible).toBe(true);
});

test('requires the custom popup without a remaining system IME', async () => {
  let ime = true;
  let finished = false;
  const result = settledKeyboardMode(
    async () =>
      metrics({
        keyboardMode: 'custom',
        popupVisible: true,
        systemKeyboardVisible: ime,
      }),
    'custom',
  ).then(() => {
    finished = true;
  });
  await jest.advanceTimersByTimeAsync(500);
  expect(finished).toBe(false);
  ime = false;
  await jest.advanceTimersByTimeAsync(500);
  await result;
  expect(finished).toBe(true);
});

test('still fails if the requested keyboard never appears', async () => {
  const result = settledKeyboardMode(
    async () => metrics({ systemKeyboardVisible: false }),
    'system',
  );
  await Promise.all([
    expect(result).rejects.toThrow('Keyboard handoff did not settle'),
    jest.advanceTimersByTimeAsync(6000),
  ]);
});
