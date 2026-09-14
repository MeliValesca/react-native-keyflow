import {
  androidDarkKeyboardTheme,
  androidKeyboardTheme,
  createKeyboardTheme,
  darkKeyboardTheme,
  lightKeyboardTheme,
} from './theme';
import type { KeyboardTheme, KeyboardThemeOverrides } from './types';

/** Platform/layout defaults are applied before consumer overrides. */
export function resolveInputTheme(
  platform: string,
  dark: boolean,
  keyboardType: string,
  overrides?: KeyboardThemeOverrides | KeyboardTheme,
  isTablet = false,
) {
  const base =
    platform === 'android'
      ? dark
        ? androidDarkKeyboardTheme
        : androidKeyboardTheme
      : dark
      ? darkKeyboardTheme
      : lightKeyboardTheme;
  // Themes returned by createKeyboardTheme are already resolved. Their
  // top-level material is output data; partial settings still belong under
  // keyboard.material.
  if (
    'material' in (overrides ?? {}) &&
    typeof (overrides as KeyboardTheme).material === 'object'
  )
    return createKeyboardTheme({}, overrides as KeyboardTheme);
  return createKeyboardTheme(
    overrides as KeyboardThemeOverrides | undefined,
    platform === 'ios' && keyboardType !== 'default' && !isTablet
      ? {
          ...base,
          specialKeyBackground: '#00000000',
          deleteKeyBackground: '#00000000',
        }
      : base,
  );
}
