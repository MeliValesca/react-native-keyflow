/** Theme colors are explicit #RRGGBB or #RRGGBBAA values (alpha last). */
export type KeyboardColor = `#${string}`;

export type KeyboardMaterial =
  | Readonly<{ type: 'flat' }>
  | Readonly<{
      type: 'raised';
      /** Face depth, 0–6 logical pixels. */
      depth: number;
      shadowColor: KeyboardColor;
    }>;

export type KeyboardMaterialOverride =
  | Readonly<{ type: 'flat' }>
  | Readonly<{
      type: 'raised';
      /** Face depth, 0–6 logical pixels. Defaults to 4. */
      depth?: number;
      /** Color of the depth below each key. Defaults to black. */
      shadowColor?: KeyboardColor;
    }>;

export type KeyflowTheme = Readonly<{
  /** Resolved native styles. Prefer the section objects when overriding. */
  sections?: Readonly<Record<string, Required<KeyboardSectionStyle>>>;
  sectionOverrides?: Partial<Record<KeyboardSectionName, KeyboardSectionStyle>>;
  background: KeyboardColor;
  keyBackground: KeyboardColor;
  keyForeground: KeyboardColor;
  pressedKeyBackground: KeyboardColor;
  /** Highlighted long-press choice and keyboard selection colors. */
  selectedKeyBackground: KeyboardColor;
  selectedKeyForeground: KeyboardColor;
  specialKeyBackground: KeyboardColor;
  actionKeyBackground: KeyboardColor;
  actionKeyForeground: KeyboardColor;
  material: KeyboardMaterial;
  /** Multiplies fill, border, and shadow alpha without fading text or icons. */
  surfaceOpacity: number;
  /** Multiplies keycap, control, and popup surface alpha independently of the panel. */
  keyOpacity: number;
  fontWeight: 'regular' | 'medium' | 'bold';
  specialKeyForeground: KeyboardColor;
  deleteKeyBackground: KeyboardColor;
  /** Registered font name or system-rounded / system-serif / system-monospace. Null uses the platform default. */
  fontFamily: string | null;
  /** Preferred letter size, 12–32 logical pixels; native labels shrink to fit. */
  fontSize: number;
  /** 0–24 logical pixels, additionally bounded to half the face size. */
  keyCornerRadius: number;
}>;

export type KeyboardSectionStyle = Readonly<{
  background?: KeyboardColor;
  color?: KeyboardColor;
  placeholderColor?: KeyboardColor;
  iconColor?: KeyboardColor;
  pressedBackground?: KeyboardColor;
  pressedColor?: KeyboardColor;
  borderColor?: KeyboardColor;
  borderWidth?: number;
  cornerRadius?: number;
  fontFamily?: string | null;
  fontSize?: number;
  fontWeight?: 'regular' | 'medium' | 'bold';
  iconSize?: number;
}>;
export type KeyboardSectionName =
  | 'keys'
  | 'specialKeys'
  | 'deleteKey'
  | 'returnKey'
  | 'preview'
  | 'selection'
  | 'toolbar';
export type KeyflowThemeOverrides = Omit<Partial<KeyflowTheme>, 'material'> & {
  keyboard?: {
    background?: KeyboardColor;
    /** Panel alpha, 0–1. Overrides the background color's alpha without fading keys. */
    backgroundOpacity?: number;
    /** Keycaps, controls, and popups, 0–1. Leaves the panel, text, and icons unchanged. */
    keyOpacity?: number;
    /** All keyboard surfaces, including keycaps and popups, 0–1. */
    surfaceOpacity?: number;
    material?: KeyboardMaterialOverride;
  };
  font?: {
    family?: string | null;
    size?: number;
    weight?: 'regular' | 'medium' | 'bold';
  };
  keys?: KeyboardSectionStyle;
  specialKeys?: KeyboardSectionStyle;
  deleteKey?: KeyboardSectionStyle;
  returnKey?: KeyboardSectionStyle;
  preview?: KeyboardSectionStyle;
  selection?: KeyboardSectionStyle;
  toolbar?: KeyboardSectionStyle;
};
