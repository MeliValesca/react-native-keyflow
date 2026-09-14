import { studioTheme } from '../themes/studio';
import { Platform } from 'react-native';
import {
  createKeyflowTheme,
  androidKeyflowTheme,
  lightKeyflowTheme,
} from 'react-native-keyflow';
import type { KeyboardSectionStyle } from 'react-native-keyflow';
export const customizationFonts = [
  { label: 'Default', family: null },
  { label: 'Rounded', family: 'system-rounded' },
  { label: 'Serif', family: 'system-serif' },
  { label: 'Mono', family: 'system-monospace' },
  { label: 'Bundled font', family: 'KeyflowDemoMono' },
];
export const customizationBase =
  Platform.OS === 'android' ? androidKeyflowTheme : lightKeyflowTheme;
export const customizationMaterials = {
  flat: customizationBase,
  raised: studioTheme,
};
export function colorSections(size: number, radius: number) {
  const section: KeyboardSectionStyle = {
    color: '#F0E5FF',
    background: '#18334B',
    iconColor: '#FFDD33',
    pressedBackground: '#A35CEA',
    pressedColor: '#FFFFFF',
    fontFamily: 'system-monospace',
    fontSize: size,
    iconSize: size === 12 ? 12 : 28,
    borderWidth: 3,
    borderColor: '#CC88FF',
    cornerRadius: radius,
  };
  return {
    keys: section,
    specialKeys: section,
    deleteKey: section,
    returnKey: section,
    toolbar: section,
    preview: section,
    selection: {
      ...section,
      background: '#FFDD33' as const,
      color: '#18334B' as const,
      iconColor: '#18334B' as const,
    },
  };
}
export const customizationCases = [
  ...[
    ...customizationFonts,
    { label: 'Missing font fallback', family: 'KeyflowFontThatDoesNotExist' },
  ].flatMap((font) =>
    (['flat', 'raised'] as const).flatMap((material) =>
      [12, 32].flatMap((fontSize) =>
        [0, 24].map((radius) => ({
          name: `${font.label}/${material}/${fontSize}/${radius}`,
          bundled: font.family === 'KeyflowDemoMono',
          theme: createKeyflowTheme(
            {
              fontFamily: font.family,
              fontSize,
              fontWeight: 'bold',
              keyCornerRadius: radius,
              ...(material === 'raised'
                ? {
                    keyboard: {
                      material: {
                        type: 'raised' as const,
                        depth: 6,
                        shadowColor: '#00304C' as const,
                      },
                    },
                  }
                : {}),
            },
            customizationMaterials[material],
          ),
        })),
      ),
    ),
  ),
  ...[12, 32].flatMap((size) =>
    [0, 24].map((radius) => ({
      name: `sections/${size}/${radius}`,
      bundled: false,
      theme: createKeyflowTheme(colorSections(size, radius), customizationBase),
    })),
  ),
  ...(['flat', 'raised'] as const).flatMap((material) =>
    [0, 0.35, 1].map((opacity) => ({
      name: `opacity/${material}/${opacity}`,
      bundled: false,
      theme: createKeyflowTheme(
        {
          keyboard: { background: '#16324F', backgroundOpacity: opacity },
          font: { family: 'system-serif', size: 32, weight: 'bold' },
        },
        customizationMaterials[material],
      ),
    })),
  ),
];
export const customizationVisuals = (['flat', 'raised'] as const).map(
  (material) => ({
    name: material,
    theme: createKeyflowTheme(
      {
        ...colorSections(32, 24),
        keyboard: {
          background: '#16324F',
          backgroundOpacity: material === 'flat' ? 1 : 0.35,
        },
      },
      customizationMaterials[material],
    ),
  }),
);
