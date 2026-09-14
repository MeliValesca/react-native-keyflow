import { keyboardOverlap } from '../keyboardGeometry';
import type { KeyflowKeyboardFrame } from '../keyboardGeometry';
const shown: KeyflowKeyboardFrame = {
  screenY: 500,
  height: 300,
  visible: true,
  source: 'custom',
};
describe('keyboard avoidance geometry', () => {
  it('converts Android window measurements to screen coordinates', () =>
    expect(
      keyboardOverlap(866, { ...shown, screenY: 600, windowOffsetY: 24 }),
    ).toBe(290));
  it('does not double-count the window origin after resize', () =>
    expect(
      keyboardOverlap(576, { ...shown, screenY: 600, windowOffsetY: 24 }),
    ).toBe(0));
  it('keeps a bottom composer above a shown panel', () =>
    expect(keyboardOverlap(780, shown)).toBe(280));
  it('does not count a safe-area inset twice', () =>
    expect(keyboardOverlap(746, shown)).toBe(246));
  it('does not add padding when adjustResize already moved the container', () =>
    expect(keyboardOverlap(500, shown)).toBe(0));
  it('ignores a keyboard outside the container', () =>
    expect(keyboardOverlap(400, shown)).toBe(0));
  it('returns to the original layout after dismissal', () =>
    expect(keyboardOverlap(780, { ...shown, visible: false, height: 0 })).toBe(
      0,
    ));
  it('supports an explicit extra clearance', () =>
    expect(keyboardOverlap(780, shown, 12)).toBe(292));
  it('uses the native window when its frame arrives before React dimensions', () =>
    expect(
      keyboardOverlap(900, {
        ...shown,
        screenY: 180,
        height: 220,
        windowHeight: 400,
      }),
    ).toBe(220));
  it('ignores the old portrait keyboard after the window becomes landscape', () =>
    expect(
      keyboardOverlap(
        900,
        { ...shown, screenY: 600, windowHeight: 900 },
        0,
        400,
      ),
    ).toBe(0));
  it('uses the landscape window before measureInWindow catches up', () =>
    expect(
      keyboardOverlap(900, { ...shown, screenY: 200, height: 240 }, 0, 400),
    ).toBe(200));
  it('preserves coordinate offsets and explicit clearance for ordinary frames', () =>
    expect(keyboardOverlap(900, shown, 12)).toBe(412));
  it('follows intermediate animation frames monotonically', () => {
    expect(
      [800, 700, 600, 500].map((screenY) =>
        keyboardOverlap(780, { ...shown, screenY }),
      ),
    ).toEqual([0, 80, 180, 280]);
  });
});
