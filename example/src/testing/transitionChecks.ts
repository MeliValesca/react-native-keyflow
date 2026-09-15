import type { KeyflowKeyboardFrame } from 'react-native-keyflow';

/** Validate notification geometry and the completed show/hide state. */
export function assertKeyboardSettled(
  frames: KeyflowKeyboardFrame[],
  direction: 'show' | 'hide',
) {
  if (!frames.length) throw new Error(`${direction}: no keyboard frames`);
  for (const [index, frame] of frames.entries()) {
    if (
      !Number.isFinite(frame.height) ||
      !Number.isFinite(frame.screenY) ||
      frame.height < 0
    )
      throw new Error(`${direction}: invalid frame ${index}`);
  }
  const last = frames[frames.length - 1]!;
  if (direction === 'show' ? !last.visible : last.visible)
    throw new Error(`${direction}: incorrect final visibility`);
}

/** Validate Keyflow frame telemetry, including every intermediate position. */
export function assertFrameProgress(
  frames: KeyflowKeyboardFrame[],
  direction: 'show' | 'hide',
) {
  assertKeyboardSettled(frames, direction);
  for (const [index, frame] of frames.entries()) {
    const previous = frames[index - 1];
    if (!previous) continue;
    const movement = frame.height - previous.height;
    if (direction === 'show' ? movement < -1 : movement > 1)
      throw new Error(
        `${direction}: keyboard reversed at frame ${index} (${previous.height} → ${frame.height})`,
      );
  }
}

/** System IME motion is observed for comparison, not controlled by Keyflow. */
export function assertKeyboardTransition(
  frames: KeyflowKeyboardFrame[],
  direction: 'show' | 'hide',
  platform: string,
  engine: 'baseline' | 'custom' | 'system',
) {
  // Android system mode exposes IME events; the plain RN baseline reads
  // OS-inset snapshots. Neither guarantees one monotonic opening sequence.
  // Require valid, settled geometry for both, and retain strict motion checks
  // for our custom keyboard and the iOS baseline timing reference.
  if (
    engine === 'system' ||
    (platform === 'android' && engine === 'baseline')
  ) {
    assertKeyboardSettled(frames, direction);
  } else {
    assertFrameProgress(frames, direction);
  }
}

/** Require an actual partial opening, not a device-speed-dependent event count. */
export function assertAnimatedOpening(frames: KeyflowKeyboardFrame[]) {
  assertFrameProgress(frames, 'show');
  const finalHeight = frames[frames.length - 1]!.height;
  if (
    !frames.some(
      (frame) =>
        frame.visible && frame.height > 1 && frame.height < finalHeight - 1,
    )
  )
    throw new Error(
      `show: no intermediate keyboard position: ${JSON.stringify(frames)}`,
    );
}
