import { serializeKeyboardTheme } from '../serializeTheme';
import { createKeyboardTheme, transparentKeyboardTheme } from '../theme';
import { resolveInputTheme } from '../inputTheme';

test.each(['ios', 'android'])(
  '%s background and keys can be transparent independently',
  (platform) => {
    const render = (backgroundOpacity: number, keyOpacity: number) =>
      JSON.parse(
        serializeKeyboardTheme(
          resolveInputTheme(platform, false, 'default', {
            keyboard: { backgroundOpacity, keyOpacity },
          }),
        ),
      );
    const solid = render(1, 1);
    const clearPanel = render(0, 1);
    const clearKeys = render(1, 0);
    expect(clearPanel.background.endsWith('00')).toBe(true);
    expect(clearPanel.sections).toEqual(solid.sections);
    expect(clearKeys.background).toBe(solid.background);
    for (const section of Object.keys(clearKeys.sections)) {
      expect(clearKeys.sections[section].background.endsWith('00')).toBe(true);
      expect(clearKeys.sections[section].pressedBackground.endsWith('00')).toBe(
        true,
      );
      expect(clearKeys.sections[section].color).toBe(
        solid.sections[section].color,
      );
      expect(clearKeys.sections[section].pressedColor).toBe(
        solid.sections[section].pressedColor,
      );
      expect(clearKeys.sections[section].iconColor).toBe(
        solid.sections[section].iconColor,
      );
    }
  },
);

test('key opacity composes with global opacity and section alpha without changing reusable colors', () => {
  const theme = createKeyboardTheme({
    keyboard: { backgroundOpacity: 0.5, keyOpacity: 0.5, surfaceOpacity: 0.5 },
    keys: { background: '#FFFFFF80', borderColor: '#AABBCC80', borderWidth: 1 },
    preview: { background: '#FFFFFF80' },
  });
  const before = serializeKeyboardTheme(theme);
  const native = JSON.parse(before);
  expect(native.background).toBe('#E0E2E740');
  expect(native.keyBackground).toBe('#FFFFFF40');
  expect(native.sections.keys.background).toBe('#FFFFFF20');
  expect(native.sections.keys.borderColor).toBe('#AABBCC20');
  expect(native.sectionOverrides.keys.background).toBe('#FFFFFF20');
  expect(native.sections.preview.background).toBe('#FFFFFF20');
  expect(theme.sections?.keys?.background).toBe('#FFFFFF80');
  expect(serializeKeyboardTheme(createKeyboardTheme({}, theme))).toBe(before);
  const backgroundOnly = JSON.parse(
    serializeKeyboardTheme(
      createKeyboardTheme({ keyboard: { backgroundOpacity: 1 } }, theme),
    ),
  );
  expect(backgroundOnly.sections).toEqual(native.sections);
  const keysOnly = JSON.parse(
    serializeKeyboardTheme(
      createKeyboardTheme({ keyboard: { keyOpacity: 1 } }, theme),
    ),
  );
  expect(keysOnly.background).toBe(native.background);
  expect(keysOnly.sections.keys.background).toBe('#FFFFFF40');
});

test.each([-1, 1.01, NaN, Infinity])(
  'rejects invalid key opacity %s',
  (keyOpacity) => {
    expect(() => createKeyboardTheme({ keyboard: { keyOpacity } })).toThrow(
      RangeError,
    );
  },
);

test.each([
  [0, '00'],
  [0.25, '40'],
  [0.5, '80'],
  [0.75, 'bf'],
  [1, 'ff'],
])('panel opacity %s affects only the panel', (opacity, alpha) => {
  const theme = createKeyboardTheme(
    {
      keyboard: { background: '#E0E8EF', backgroundOpacity: opacity as number },
    },
    transparentKeyboardTheme,
  );
  expect(theme.background).toBe(`#E0E8EF${alpha}`);
  expect(theme.keyForeground).toBe(transparentKeyboardTheme.keyForeground);
  expect(theme.keyBackground).toBe(transparentKeyboardTheme.keyBackground);
  expect(theme.material).toEqual({ type: 'flat' });
});
test('opacity replaces color alpha and does not accumulate across theme updates', () => {
  const base = createKeyboardTheme({
    keyboard: { background: '#102D4640', backgroundOpacity: 0.5 },
  });
  const next = createKeyboardTheme(
    { keyboard: { backgroundOpacity: 0.5 } },
    base,
  );
  expect(next.background).toBe('#102D4680');
  expect(createKeyboardTheme({}, next).background).toBe(next.background);
});
test.each([-1, 1.01, NaN, Infinity])('rejects invalid opacity %s', (value) => {
  expect(() =>
    createKeyboardTheme({ keyboard: { backgroundOpacity: value } }),
  ).toThrow();
});

test('surface opacity includes keycaps, popups, selection, borders and shadows while preserving ink', () => {
  const theme = createKeyboardTheme({
    keyboard: { surfaceOpacity: 0.5 },
    keys: { background: '#FFFFFF', borderColor: '#12345680', borderWidth: 1 },
    preview: { background: '#CCDDEEFF' },
    selection: { background: '#225577' },
    toolbar: { background: '#FFFFFF80' },
  });
  const native = JSON.parse(serializeKeyboardTheme(theme));
  expect(native.background).toBe('#E0E2E780');
  expect(native.keyBackground).toBe('#FFFFFF80');
  expect(native.sections.keys.background).toBe('#FFFFFF80');
  expect(native.sections.keys.borderColor).toBe('#12345640');
  expect(native.sections.preview.background).toBe('#CCDDEE80');
  expect(native.sections.selection.background).toBe('#22557780');
  expect(native.sections.toolbar.background).toBe('#FFFFFF40');
  expect(native.sections.specialKeys.background).toBe('#FFFFFF80');
  expect(native.sections.deleteKey.background).toBe('#FFFFFF80');
  expect(native.sections.returnKey.background).toBe('#FFFFFF80');
  expect(native.keyShadow).toBe('#00000000');
  expect(native.keyForeground).toBe(theme.keyForeground);
  expect(native.sections.keys.color).toBe(theme.sections?.keys?.color);
  expect(native.sections.keys.iconColor).toBe(theme.sections?.keys?.iconColor);
});

test('raised shadow opacity is scoped to the raised material object', () => {
  const native = JSON.parse(
    serializeKeyboardTheme(
      createKeyboardTheme({
        keyboard: {
          keyOpacity: 0.5,
          material: {
            type: 'raised',
            depth: 6,
            shadowColor: '#12345680',
          },
        },
      }),
    ),
  );
  expect(native.material).toBe('raised');
  expect(native.keyDepth).toBe(6);
  expect(native.keyShadow).toBe('#12345640');
});

test('surface opacity does not accumulate when reusing, rendering or restyling a theme', () => {
  const theme = createKeyboardTheme({ keyboard: { surfaceOpacity: 0.5 } });
  const before = serializeKeyboardTheme(theme);
  expect(serializeKeyboardTheme(theme)).toBe(before);
  expect(serializeKeyboardTheme(createKeyboardTheme({}, theme))).toBe(before);
  const styled = createKeyboardTheme({ font: { weight: 'bold' } }, theme);
  expect(JSON.parse(serializeKeyboardTheme(styled)).keyBackground).toBe(
    '#FFFFFF80',
  );
  expect(theme.keyBackground).toBe('#FFFFFF');
  expect(
    JSON.parse(
      serializeKeyboardTheme(
        createKeyboardTheme({ keyboard: { surfaceOpacity: 1 } }, theme),
      ),
    ).keyBackground,
  ).toBe('#FFFFFF');
  expect(
    JSON.parse(
      serializeKeyboardTheme(
        createKeyboardTheme({ keyboard: { surfaceOpacity: 0 } }, theme),
      ),
    ).keyBackground,
  ).toBe('#FFFFFF00');
});

test.each([-1, 1.01, NaN, Infinity])(
  'rejects invalid surface opacity %s',
  (surfaceOpacity) => {
    expect(() => createKeyboardTheme({ keyboard: { surfaceOpacity } })).toThrow(
      RangeError,
    );
  },
);
