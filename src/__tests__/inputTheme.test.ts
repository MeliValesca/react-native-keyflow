import { resolveInputTheme } from '../inputTheme';
import {
  createKeyflowTheme,
  lightKeyflowTheme,
  darkKeyflowTheme,
} from '../theme';

test.each(['number-pad', 'decimal-pad', 'phone-pad'])(
  'iOS %s uses unfilled special keys without altering QWERTY',
  (type) => {
    for (const dark of [false, true]) {
      const pad = resolveInputTheme('ios', dark, type);
      expect(pad.deleteKeyBackground).toBe('#00000000');
      expect(pad.specialKeyBackground).toBe('#00000000');
      expect(pad.keyBackground).toBe(
        (dark ? darkKeyflowTheme : lightKeyflowTheme).keyBackground,
      );
      expect(
        resolveInputTheme('ios', dark, 'default').deleteKeyBackground,
      ).toBe((dark ? darkKeyflowTheme : lightKeyflowTheme).deleteKeyBackground);
    }
  },
);
test('consumer colors and section styling win over pad defaults', () => {
  const theme = resolveInputTheme('ios', false, 'decimal-pad', {
    deleteKeyBackground: '#112233',
    specialKeys: { background: '#445566', color: '#123456' },
  });
  expect(theme.deleteKeyBackground).toBe('#112233');
  expect(theme.sections?.specialKeys?.background).toBe('#445566');
});
test('Android pads retain the platform palette', () => {
  expect(resolveInputTheme('android', false, 'number-pad')).toEqual(
    resolveInputTheme('android', false, 'default'),
  );
});

test.each(['number-pad', 'decimal-pad', 'phone-pad'])(
  'iPad %s keeps visible full-keyboard action surfaces',
  (type) => {
    for (const dark of [false, true]) {
      const theme = resolveInputTheme('ios', dark, type, undefined, true);
      const base = dark ? darkKeyflowTheme : lightKeyflowTheme;
      expect(theme.specialKeyBackground).toBe(base.specialKeyBackground);
      expect(theme.deleteKeyBackground).toBe(base.deleteKeyBackground);
      expect(theme.sections?.specialKeys?.background).toBe(
        base.specialKeyBackground,
      );
      expect(theme.sections?.deleteKey?.background).toBe(
        base.deleteKeyBackground,
      );
    }
  },
);

test('accepts a resolved theme while partial material settings stay nested', () => {
  const resolved = createKeyflowTheme({
    keyboard: {
      material: { type: 'raised', depth: 3, shadowColor: '#123456' },
    },
  });
  expect(resolveInputTheme('ios', false, 'default', resolved)).toEqual(
    resolved,
  );
  expect(resolveInputTheme('ios', false, 'default', lightKeyflowTheme)).toEqual(
    createKeyflowTheme({}, lightKeyflowTheme),
  );
});
