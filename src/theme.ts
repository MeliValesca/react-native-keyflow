import { resolveSections } from './sections';
import type { KeyboardTheme, KeyboardThemeOverrides } from './types';

/** Supported ranges keep customization inside the fixed native key geometry. */
export const keyboardThemeLimits = Object.freeze({
  fontSize: Object.freeze({ min: 12, max: 32 }),
  keyCornerRadius: Object.freeze({ min: 0, max: 24 }),
  materialDepth: Object.freeze({ min: 0, max: 6 }),
  surfaceOpacity: Object.freeze({ min: 0, max: 1 }),
  keyOpacity: Object.freeze({ min: 0, max: 1 }),
});

/** Initial design tokens, not a pixel-exact copy of any system keyboard. */
export const lightKeyboardTheme: KeyboardTheme = Object.freeze({
  background: '#E0E2E7',
  keyBackground: '#FFFFFF',
  keyForeground: '#000000',
  pressedKeyBackground: '#C1C3C6',
  sectionOverrides: Object.freeze({
    preview: Object.freeze({ background: '#FFFFFF' as const }),
  }),
  selectedKeyBackground: '#008FFF',
  selectedKeyForeground: '#FFFFFF',
  specialKeyBackground: '#FFFFFF',
  actionKeyBackground: '#FFFFFF',
  actionKeyForeground: '#000000',
  material: Object.freeze({ type: 'flat' }),
  surfaceOpacity: 1,
  keyOpacity: 1,
  fontWeight: 'regular',
  specialKeyForeground: '#000000',
  deleteKeyBackground: '#FFFFFF',
  fontFamily: null,
  fontSize: 22,
  keyCornerRadius: 8,
});

export const darkKeyboardTheme: KeyboardTheme = Object.freeze({
  ...lightKeyboardTheme,
  specialKeyForeground: '#FFFFFF',
  deleteKeyBackground: '#5E5F61',
  background: '#404143',
  keyBackground: '#5E5F61',
  keyForeground: '#FFFFFF',
  pressedKeyBackground: '#8E8E93',
  sectionOverrides: Object.freeze({
    preview: Object.freeze({ background: '#8E8E93' as const }),
  }),
  specialKeyBackground: '#5E5F61',
  actionKeyBackground: '#5E5F61',
  actionKeyForeground: '#FFFFFF',
});

/** Resolve and validate tokens before crossing the native boundary. */
export function createKeyboardTheme(
  overrides: KeyboardThemeOverrides = {},
  base: KeyboardTheme = lightKeyboardTheme,
): KeyboardTheme {
  for (const deviceScope of [
    'phone',
    'tablet',
    'portrait',
    'landscape',
    'ios',
    'android',
  ])
    if (Object.prototype.hasOwnProperty.call(overrides, deviceScope))
      throw new TypeError(
        `${deviceScope} theme overrides are not supported; pass one keyboardTheme and Keyflow will adapt its native geometry automatically`,
      );
  for (const legacy of ['material', 'keyDepth', 'keyShadow', 'keyHighlight'])
    if (Object.prototype.hasOwnProperty.call(overrides, legacy))
      throw new TypeError(
        `${legacy} belongs in keyboard.material; use { type: 'flat' } or { type: 'raised', depth, shadowColor }`,
      );
  const theme = { ...base };
  for (const key of Object.keys(
    lightKeyboardTheme,
  ) as (keyof KeyboardTheme)[]) {
    if (key === 'material') continue;
    const value = overrides[key];
    if (value !== undefined) Object.assign(theme, { [key]: value });
  }

  if (overrides.keyboard?.background !== undefined)
    theme.background = overrides.keyboard.background;
  if (
    overrides.keyboard?.material !== undefined &&
    !['flat', 'raised'].includes(overrides.keyboard.material.type)
  )
    throw new TypeError('keyboard.material.type must be flat or raised');
  if (overrides.keyboard?.material !== undefined)
    theme.material =
      overrides.keyboard.material.type === 'raised'
        ? Object.freeze({
            type: 'raised' as const,
            depth: overrides.keyboard.material.depth ?? 4,
            shadowColor: overrides.keyboard.material.shadowColor ?? '#000000',
          })
        : Object.freeze({ type: 'flat' as const });
  if (overrides.keyboard?.surfaceOpacity !== undefined)
    theme.surfaceOpacity = overrides.keyboard.surfaceOpacity;
  if (overrides.keyboard?.keyOpacity !== undefined)
    theme.keyOpacity = overrides.keyboard.keyOpacity;
  if (overrides.font?.family !== undefined)
    theme.fontFamily = overrides.font.family;
  if (overrides.font?.size !== undefined) theme.fontSize = overrides.font.size;
  if (overrides.font?.weight !== undefined)
    theme.fontWeight = overrides.font.weight;
  for (const key of [
    'specialKeyForeground',
    'deleteKeyBackground',
    'background',
    'keyBackground',
    'keyForeground',
    'pressedKeyBackground',
    'selectedKeyBackground',
    'selectedKeyForeground',
    'specialKeyBackground',
    'actionKeyBackground',
    'actionKeyForeground',
  ] as const) {
    if (!/^#(?:[\da-f]{6}|[\da-f]{8})$/i.test(theme[key])) {
      throw new TypeError(`${key} must be #RRGGBB or #RRGGBBAA`);
    }
  }
  const backgroundOpacity = overrides.keyboard?.backgroundOpacity;
  if (backgroundOpacity !== undefined) {
    if (
      !Number.isFinite(backgroundOpacity) ||
      backgroundOpacity < 0 ||
      backgroundOpacity > 1
    )
      throw new RangeError(
        'keyboard.backgroundOpacity must be between 0 and 1',
      );
    theme.background = `#${theme.background.slice(1, 7)}${Math.round(
      backgroundOpacity * 255,
    )
      .toString(16)
      .padStart(2, '0')}`;
  }
  for (const key of [
    'fontSize',
    'keyCornerRadius',
    'surfaceOpacity',
    'keyOpacity',
  ] as const) {
    const { min, max } = keyboardThemeLimits[key];
    if (!Number.isFinite(theme[key]) || theme[key] < min || theme[key] > max)
      throw new RangeError(`${key} must be between ${min} and ${max}`);
  }
  if (
    theme.fontFamily !== null &&
    (typeof theme.fontFamily !== 'string' ||
      !theme.fontFamily.trim() ||
      theme.fontFamily.length > 128)
  ) {
    throw new TypeError(
      'fontFamily must be a font name of 1–128 characters or null',
    );
  }
  if (theme.material.type === 'raised') {
    const { min, max } = keyboardThemeLimits.materialDepth;
    if (
      !Number.isFinite(theme.material.depth) ||
      theme.material.depth < min ||
      theme.material.depth > max
    )
      throw new RangeError(`material.depth must be between ${min} and ${max}`);
    if (!/^#(?:[\da-f]{6}|[\da-f]{8})$/i.test(theme.material.shadowColor))
      throw new TypeError('material.shadowColor must be #RRGGBB or #RRGGBBAA');
  }
  if (!['regular', 'medium', 'bold'].includes(theme.fontWeight))
    throw new TypeError('Invalid fontWeight');
  if (theme.fontFamily) theme.fontFamily = theme.fontFamily.trim();
  return Object.freeze({
    ...theme,
    ...resolveSections(theme, overrides, base),
  });
}

/** Gboard 15.1 default Material palette on the Android reference emulator. */
export const androidKeyboardTheme = createKeyboardTheme({
  background: '#EEEDF4',
  keyBackground: '#FFFFFF',
  keyForeground: '#1A1B21',
  pressedKeyBackground: '#C1C6DD',
  preview: { background: '#FFFFFF', fontSize: 28 },
  selectedKeyBackground: '#C0C6DD',
  selectedKeyForeground: '#414659',
  specialKeyBackground: '#DDE2F9',
  specialKeyForeground: '#414659',
  deleteKeyBackground: '#DDE2F9',
  actionKeyBackground: '#B2C5FF',
  actionKeyForeground: '#414659',
  keyCornerRadius: 6,
});
export const androidDarkKeyboardTheme = createKeyboardTheme(
  {
    background: '#1E1F25',
    keyBackground: '#33343A',
    keyForeground: '#E3E2E9',
    pressedKeyBackground: '#5B6074',
    preview: { background: '#33343A' },
    specialKeyBackground: '#414659',
    specialKeyForeground: '#DDE2F9',
    deleteKeyBackground: '#414659',
    actionKeyBackground: '#414659',
    actionKeyForeground: '#DDE2F9',
  },
  androidKeyboardTheme,
);
/** Defined translucent keycaps over the app's background, including the space bar. */
export const transparentKeyboardTheme = createKeyboardTheme({
  keyOpacity: 0.7,
  keyboard: {
    background: '#D9E9F2',
    backgroundOpacity: 0.35,
    material: { type: 'flat' },
  },
  keyBackground: '#FFFFFF',
  specialKeyBackground: '#D8E6EF',
  deleteKeyBackground: '#D8E6EF',
  actionKeyBackground: '#B8D5E8',
  keyForeground: '#102D46',
  specialKeyForeground: '#102D46',
  actionKeyForeground: '#102D46',
  pressedKeyBackground: '#B8D5E8',
  selectedKeyBackground: '#38749C',
  selectedKeyForeground: '#FFFFFF',
  keyCornerRadius: 8,
  keys: { borderColor: '#FFFFFFB3', borderWidth: 0.75 },
  specialKeys: { borderColor: '#FFFFFFB3', borderWidth: 0.75 },
  deleteKey: { borderColor: '#FFFFFFB3', borderWidth: 0.75 },
  returnKey: { borderColor: '#FFFFFFB3', borderWidth: 0.75 },
  preview: {
    background: '#FFFFFF',
    borderColor: '#FFFFFFB3',
    borderWidth: 0.75,
  },
});
