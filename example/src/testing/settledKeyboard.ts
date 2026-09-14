import type { KeyflowKeyboardMetrics } from 'react-native-keyflow/testing';

/** Wait for presentation and stable geometry, independently of layout correctness. */
export async function settledKeyboard(
  read: () => Promise<{ visible: boolean; metrics: KeyflowKeyboardMetrics }>,
): Promise<KeyflowKeyboardMetrics> {
  const started = Date.now();
  const deadline = started + 5000;
  let previous = '';
  let stableSince = Date.now();
  let last: Awaited<ReturnType<typeof read>> | undefined;
  while (Date.now() < deadline) {
    last = await read();
    const { metrics, visible } = last;
    const ready =
      visible &&
      metrics.focused &&
      Number.isFinite(metrics.editorBottom) &&
      Number.isFinite(metrics.screenY);
    const signature = JSON.stringify([
      metrics.editorBottom,
      metrics.screenY,
      metrics.width,
      metrics.height,
    ]);
    if (!ready || signature !== previous) stableSince = Date.now();
    previous = signature;
    // Preserve the 600 ms presentation allowance from the green 08d1802
    // transparency check; stable geometry alone can be sampled too early.
    if (ready && Date.now() - started >= 600 && Date.now() - stableSince >= 300)
      return metrics;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Keyboard did not settle: ${JSON.stringify(last)}`);
}
