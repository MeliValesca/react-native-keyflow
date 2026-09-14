import type {
  KeyflowTheme,
  KeyflowThemeOverrides,
  KeyboardSectionStyle,
  KeyboardSectionName,
} from './types';

export const keyboardSections = [
  'keys',
  'specialKeys',
  'deleteKey',
  'returnKey',
  'preview',
  'selection',
  'toolbar',
] as const;
const colors = [
  'background',
  'color',
  'placeholderColor',
  'iconColor',
  'pressedBackground',
  'pressedColor',
  'borderColor',
] as const;
const ranges = {
  fontSize: [10, 32],
  cornerRadius: [0, 24],
  borderWidth: [0, 3],
  iconSize: [12, 28],
} as const;
export function resolveSections(
  theme: KeyflowTheme,
  overrides: KeyflowThemeOverrides,
  base: KeyflowTheme,
) {
  const inherited = overrides.sectionOverrides ?? base.sectionOverrides ?? {};
  const raw: Partial<Record<KeyboardSectionName, KeyboardSectionStyle>> = {
    ...inherited,
  };
  const sections: Record<string, Required<KeyboardSectionStyle>> = {};
  for (const name of keyboardSections) {
    const next = overrides[name];
    const own = { ...raw[name] };
    for (const [key, value] of Object.entries(
      (next as KeyboardSectionStyle | undefined) ?? {},
    )) {
      if (value !== undefined) Object.assign(own, { [key]: value });
    }
    for (const key of colors)
      if (
        own[key] !== undefined &&
        !/^#(?:[\da-f]{6}|[\da-f]{8})$/i.test(own[key]!)
      )
        throw new TypeError(`${name}.${key} must be #RRGGBB or #RRGGBBAA`);
    for (const [key, [min, max]] of Object.entries(ranges)) {
      const value = own[key as keyof typeof ranges];
      if (
        value !== undefined &&
        (!Number.isFinite(value) || value < min || value > max)
      )
        throw new RangeError(
          `${name}.${key} must be between ${min} and ${max}`,
        );
    }
    if (
      own.fontFamily !== undefined &&
      own.fontFamily !== null &&
      (typeof own.fontFamily !== 'string' ||
        !own.fontFamily.trim() ||
        own.fontFamily.length > 128)
    )
      throw new TypeError(`${name}.fontFamily must be a font name or null`);
    if (
      own.fontWeight !== undefined &&
      !['regular', 'medium', 'bold'].includes(own.fontWeight)
    )
      throw new TypeError(`${name}.fontWeight is invalid`);
    if (own.fontFamily) own.fontFamily = own.fontFamily.trim();
    raw[name] = Object.freeze(own);
    const defaults: Required<KeyboardSectionStyle> = {
      background: theme.keyBackground,
      color: theme.keyForeground,
      placeholderColor: theme.keyForeground,
      iconColor: theme.keyForeground,
      pressedBackground: theme.pressedKeyBackground,
      pressedColor: theme.keyForeground,
      borderColor: '#00000000',
      borderWidth: 0,
      cornerRadius: theme.keyCornerRadius,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fontWeight: theme.fontWeight,
      iconSize: 20,
    };
    if (name === 'specialKeys' || name === 'deleteKey')
      Object.assign(defaults, {
        background:
          name === 'deleteKey'
            ? theme.deleteKeyBackground
            : theme.specialKeyBackground,
        color: theme.specialKeyForeground,
        iconColor: theme.specialKeyForeground,
      });
    if (name === 'returnKey')
      Object.assign(defaults, {
        background: theme.actionKeyBackground,
        color: theme.actionKeyForeground,
        iconColor: theme.actionKeyForeground,
      });
    if (name === 'selection')
      Object.assign(defaults, {
        background: theme.selectedKeyBackground,
        color: theme.selectedKeyForeground,
        pressedBackground: theme.selectedKeyBackground,
        pressedColor: theme.selectedKeyForeground,
      });
    if (name === 'preview')
      Object.assign(defaults, {
        background: theme.pressedKeyBackground,
        fontSize: 32,
      });
    if (name === 'toolbar')
      Object.assign(defaults, { background: '#00000000', fontSize: 17 });
    sections[name] = Object.freeze({
      ...defaults,
      ...own,
      ...(own.color && !own.pressedColor ? { pressedColor: own.color } : {}),
      ...(own.color && !own.iconColor ? { iconColor: own.color } : {}),
    });
  }
  return {
    sections: Object.freeze(sections),
    sectionOverrides: Object.freeze(raw),
  };
}
