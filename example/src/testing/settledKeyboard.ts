import type { KeyflowKeyboardMetrics } from 'react-native-keyflow/testing';

/** Await stable, unobscured input geometry; preserve persistent overlap for diagnosis. */
export async function settledKeyboard(
  read: () => Promise<{ visible: boolean; metrics: KeyflowKeyboardMetrics }>,
): Promise<KeyflowKeyboardMetrics> {
  const started = Date.now();
  const deadline = started + 5000;
  let previous = '';
  let stableSince = Date.now();
  let stable = false;
  let last: Awaited<ReturnType<typeof read>> | undefined;
  while (Date.now() < deadline) {
    last = await read();
    const { metrics, visible } = last;
    const ready =
      visible &&
      metrics.focused === true &&
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
    stable =
      ready && Date.now() - started >= 600 && Date.now() - stableSince >= 300;
    // A temporarily stable overlap can precede a delayed avoiding-view update.
    // Wait within the same deadline; never relax the caller's 1-point tolerance.
    const unobscured = metrics.editorBottom! <= metrics.screenY! + 1;
    if (stable && unobscured) return metrics;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  // Let the caller report the actual persistent overlap, rather than hide it
  // behind a generic synchronization error.
  if (stable && last) return last.metrics;
  throw new Error(`Keyboard did not settle: ${JSON.stringify(last)}`);
}
