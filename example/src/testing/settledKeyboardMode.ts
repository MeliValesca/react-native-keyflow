import type { KeyflowKeyboardMetrics } from 'react-native-keyflow/testing';

/** Observe a sustained handoff state without replaying focus or mode commands. */
export async function settledKeyboardMode(
  read: () => Promise<KeyflowKeyboardMetrics>,
  mode: 'custom' | 'system',
): Promise<KeyflowKeyboardMetrics> {
  const deadline = Date.now() + 6000;
  let stableSince: number | undefined;
  let last: KeyflowKeyboardMetrics | undefined;
  while (Date.now() < deadline) {
    last = await read();
    const ready =
      last.keyboardMode === mode &&
      last.focused &&
      (mode === 'system'
        ? last.systemKeyboardVisible && !last.popupVisible
        : last.popupVisible &&
          !last.systemKeyboardVisible &&
          last.width > 0 &&
          last.height > 0);
    if (!ready) stableSince = undefined;
    else {
      stableSince ??= Date.now();
      if (Date.now() - stableSince >= 400) return last;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Keyboard handoff did not settle: ${JSON.stringify(last)}`);
}
