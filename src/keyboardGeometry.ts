/** A keyboard's visible frame in screen coordinates, in logical pixels. */
export type KeyflowKeyboardFrame = {
  screenY: number;
  /** Android visible-window origin used by React Native measureInWindow. */
  windowOffsetY?: number;
  /** Native Android window height, which can update before React Native dimensions. */
  windowHeight?: number;
  height: number;
  visible: boolean;
  source: 'custom' | 'system';
};

/** Keep avoidance in the current native/RN window, including during rotation. */
export function keyboardOverlap(
  containerBottom: number,
  frame: KeyflowKeyboardFrame | null,
  extraOffset = 0,
  windowHeight = Infinity,
): number {
  if (!frame?.visible || frame.height <= 0) return 0;
  // Resize and keyboard events arrive independently. Use whichever window
  // has already shrunk, preserving the frame's existing coordinate offset.
  const bottom = Math.min(
    containerBottom,
    windowHeight,
    frame.windowHeight ?? Infinity,
  );
  return Math.max(
    0,
    bottom + (frame.windowOffsetY ?? 0) - frame.screenY + extraOffset,
  );
}
