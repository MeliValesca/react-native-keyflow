import {
  assertFrameProgress,
  assertAnimatedOpening,
  assertKeyboardTransition,
  assertKeyboardSettled,
} from '../../example/src/testing/transitionChecks';
const frames = (heights: number[]) =>
  heights.map((height) => ({
    height,
    screenY: 914 - height,
    visible: height > 0,
    source: 'custom' as const,
  }));

describe('recorded keyboard animation regressions', () => {
  test('accepts native rounded and duplicate presentation frames', () => {
    expect(() =>
      assertFrameProgress(frames([0, 30, 29.5, 120, 300, 300]), 'show'),
    ).not.toThrow();
  });
  test('accepts dismissal ending at zero', () => {
    expect(() =>
      assertFrameProgress(frames([300, 200, 100, 0]), 'hide'),
    ).not.toThrow();
  });
  test('rejects an opening that jumps back down', () => {
    expect(() =>
      assertFrameProgress(frames([0, 180, 40, 300]), 'show'),
    ).toThrow('reversed');
  });
  test('rejects a dismissal that jumps back up', () => {
    expect(() =>
      assertFrameProgress(frames([300, 100, 220, 0]), 'hide'),
    ).toThrow('reversed');
  });
  test('rejects stale visible state after dismissal', () => {
    expect(() => assertFrameProgress(frames([300, 100]), 'hide')).toThrow(
      'final visibility',
    );
  });
  test('rejects negative Keyflow frames even when the keyboard settles correctly', () => {
    expect(() => assertFrameProgress(frames([-24, 0, 300]), 'show')).toThrow(
      'invalid frame',
    );
  });
  test('rejects missing and invalid native telemetry', () => {
    expect(() => assertFrameProgress([], 'show')).toThrow('no keyboard frames');
    expect(() => assertFrameProgress(frames([0, NaN]), 'show')).toThrow(
      'invalid frame',
    );
  });
});

describe('plain RN baseline visibility notifications', () => {
  test('does not interpret notification order as animation frames', () => {
    const notifications = frames([295, 0, 295]);
    expect(() => assertKeyboardSettled(notifications, 'show')).not.toThrow();
    expect(() => assertFrameProgress(notifications, 'show')).toThrow(
      'reversed',
    );
  });
  test('still rejects missing, invalid, and incorrectly settled notifications', () => {
    expect(() => assertKeyboardSettled([], 'show')).toThrow(
      'no keyboard frames',
    );
    expect(() => assertKeyboardSettled(frames([-1, 295]), 'show')).toThrow(
      'invalid frame',
    );
    expect(() => assertKeyboardSettled(frames([295, 0]), 'show')).toThrow(
      'final visibility',
    );
    expect(() => assertKeyboardSettled(frames([0, 295]), 'hide')).toThrow(
      'final visibility',
    );
  });
});

describe('platform transition contracts', () => {
  test('allows Android system re-reporting but rejects the same jump in Keyflow', () => {
    const reported = frames([0, 120, 408, 408, 0, 408]);
    expect(() =>
      assertKeyboardTransition(reported, 'show', 'android', 'system'),
    ).not.toThrow();
    expect(() =>
      assertKeyboardTransition(reported, 'show', 'android', 'custom'),
    ).toThrow('reversed');
    expect(() =>
      assertKeyboardTransition(reported, 'show', 'ios', 'custom'),
    ).toThrow('reversed');
  });
  test('still rejects a system keyboard that never opens or stays visible after blur', () => {
    expect(() =>
      assertKeyboardTransition(frames([408, 0]), 'show', 'android', 'system'),
    ).toThrow('final visibility');
    expect(() =>
      assertKeyboardTransition(frames([0, 408]), 'hide', 'android', 'system'),
    ).toThrow('final visibility');
  });
});

describe('animated opening telemetry', () => {
  test('accepts the CI trace with a genuine partial opening before the final frame', () => {
    expect(() =>
      assertAnimatedOpening(frames([111.3972, 337.90475])),
    ).not.toThrow();
  });
  test.each([[337.9], [0, 337.9], [0, 337.9, 337.9], [337.5, 337.9]])(
    'rejects an instant opening or final-position rounding: %j',
    (...heights) => {
      expect(() => assertAnimatedOpening(frames(heights))).toThrow(
        'no intermediate',
      );
    },
  );
  test('still rejects a reversal even when partial positions exist', () => {
    expect(() => assertAnimatedOpening(frames([0, 150, 30, 337]))).toThrow(
      'reversed',
    );
  });
});
