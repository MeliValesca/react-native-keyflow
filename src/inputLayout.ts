type LayoutProbe = {
  ready: () => boolean;
  mounted: () => boolean;
  measure: (callback: (width: number, height: number) => void) => void;
};

/** Resolve from a layout event or measured host bounds; never leave a command hanging. */
export async function waitForInputLayout({
  ready,
  mounted,
  measure,
}: LayoutProbe) {
  const deadline = Date.now() + 5000;
  let measured = false;
  while (!ready() && !measured && mounted()) {
    if (Date.now() >= deadline)
      throw new Error('Keyflow input did not lay out');
    measure((width, height) => {
      measured = width > 0 && height > 0;
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
}
