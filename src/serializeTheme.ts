import type { KeyflowTheme } from './types';
import type { KeyflowReturnKeyContent } from './useKeyflow';

const surfaceColors = new Set([
  'background',
  'keyBackground',
  'specialKeyBackground',
  'deleteKeyBackground',
  'actionKeyBackground',
  'pressedKeyBackground',
  'selectedKeyBackground',
  'pressedBackground',
  'borderColor',
  'keyboardBorderColor',
  'keyShadow',
]);
const returnKeyIcons = new Set([
  'return',
  'arrow-right',
  'checkmark',
  'send',
  'search',
]);

/** Apply surface alpha once at the native boundary. The reusable theme keeps
 * its original colors, so repeated renders and partial updates cannot compound it. */
export function serializeKeyflowTheme(
  theme: KeyflowTheme,
  returnKeyContent?: KeyflowReturnKeyContent,
): string {
  if (
    returnKeyContent &&
    'text' in returnKeyContent &&
    (typeof returnKeyContent.text !== 'string' ||
      !returnKeyContent.text.trim() ||
      returnKeyContent.text.length > 32)
  )
    throw new TypeError('returnKeyContent.text must contain 1–32 characters');
  if (
    returnKeyContent &&
    'icon' in returnKeyContent &&
    (typeof returnKeyContent.icon !== 'string' ||
      !returnKeyIcons.has(returnKeyContent.icon))
  )
    throw new TypeError('returnKeyContent.icon is invalid');
  const nativeTheme = {
    ...theme,
    ...(returnKeyContent ? { returnKeyContent } : {}),
    material: theme.material.type,
    keyDepth: theme.material.type === 'raised' ? theme.material.depth : 0,
    keyShadow:
      theme.material.type === 'raised'
        ? theme.material.shadowColor
        : '#00000000',
    // Older native decoders require this field. It is intentionally
    // transparent and is not part of the public customization API.
    keyHighlight: '#00000000',
  };
  return JSON.stringify(
    nativeTheme,
    function (this: unknown, key, value: unknown) {
      if (!surfaceColors.has(key) || typeof value !== 'string') return value;
      // Only the root background is the panel. Section backgrounds belong to
      // keycaps, controls, or popups and follow keyOpacity instead.
      const opacity =
        theme.surfaceOpacity *
        (this === nativeTheme &&
        (key === 'background' || key === 'keyboardBorderColor')
          ? 1
          : theme.keyOpacity);
      if (opacity === 1) return value;
      const alpha = value.length === 9 ? parseInt(value.slice(7), 16) : 255;
      return `${value.slice(0, 7)}${Math.round(alpha * opacity)
        .toString(16)
        .padStart(2, '0')}`;
    },
  );
}
