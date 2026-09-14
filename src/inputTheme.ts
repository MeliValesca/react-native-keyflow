import {
  androidDarkKeyflowTheme,
  androidKeyflowTheme,
  createKeyflowTheme,
  darkKeyflowTheme,
  lightKeyflowTheme,
} from './theme';
import type { KeyflowTheme, KeyflowThemeOverrides } from './types';

/** Platform/layout defaults are applied before consumer overrides. */
export function resolveInputTheme(
  platform: string,
  dark: boolean,
  keyboardType: string,
  overrides?: KeyflowThemeOverrides | KeyflowTheme,
  isTablet = false,
) {
  const base =
    platform === 'android'
      ? dark
        ? androidDarkKeyflowTheme
        : androidKeyflowTheme
      : dark
      ? darkKeyflowTheme
      : lightKeyflowTheme;
  // Themes returned by createKeyflowTheme are already resolved. Their
  // top-level material is output data; partial settings still belong under
  // keyboard.material.
  if (
    'material' in (overrides ?? {}) &&
    typeof (overrides as KeyflowTheme).material === 'object'
  )
    return createKeyflowTheme({}, overrides as KeyflowTheme);
  return createKeyflowTheme(
    overrides as KeyflowThemeOverrides | undefined,
    platform === 'ios' && keyboardType !== 'default' && !isTablet
      ? {
          ...base,
          specialKeyBackground: '#00000000',
          deleteKeyBackground: '#00000000',
        }
      : base,
  );
}
