import { waitForInputLayout } from '../inputLayout';
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('recovers a missing layout event using actual native bounds', async () => {
  const result = waitForInputLayout({
    ready: () => false,
    mounted: () => true,
    measure: (callback) => callback(320, 48),
  });
  await jest.advanceTimersByTimeAsync(50);
  await expect(result).resolves.toBeUndefined();
});

test('does not treat zero-sized bounds as ready', async () => {
  let width = 0;
  let complete = false;
  const result = waitForInputLayout({
    ready: () => false,
    mounted: () => true,
    measure: (callback) => callback(width, 48),
  }).then(() => {
    complete = true;
  });
  await jest.advanceTimersByTimeAsync(200);
  expect(complete).toBe(false);
  width = 320;
  await jest.advanceTimersByTimeAsync(100);
  await result;
  expect(complete).toBe(true);
});

test('rejects instead of hanging if measurement and events never arrive', async () => {
  const result = waitForInputLayout({
    ready: () => false,
    mounted: () => true,
    measure: () => {},
  });
  await Promise.all([
    expect(result).rejects.toThrow('Keyflow input did not lay out'),
    jest.advanceTimersByTimeAsync(5100),
  ]);
});

test('releases pending commands when the input unmounts', async () => {
  let mounted = true;
  const result = waitForInputLayout({
    ready: () => false,
    mounted: () => mounted,
    measure: () => {},
  });
  await jest.advanceTimersByTimeAsync(100);
  mounted = false;
  await jest.advanceTimersByTimeAsync(50);
  await expect(result).resolves.toBeUndefined();
});
