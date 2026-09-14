import { registerDiagnostics } from './diagnostics';
import type { KeyflowKeyboardMetrics } from './diagnostics';
import { serializeKeyboardLanguages } from './languages';
import type { KeyflowLanguage } from './languages';
import type { KeyflowKeyboardFrame } from './keyboardGeometry';
import { requireNativeModule } from 'expo';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  findNodeHandle,
  Platform,
  useColorScheme,
} from 'react-native';
import type { RefObject } from 'react';
import type { TextInput, TextInputProps } from 'react-native';
import { resolveInputTheme } from './inputTheme';
import { serializeKeyflowTheme } from './serializeTheme';
import type { KeyflowTheme, KeyflowThemeOverrides } from './types';

/** Supported native layouts. Keyboard type is a layout hint, not input validation. */
export type KeyflowKeyboardType =
  | 'default'
  | 'number-pad'
  | 'decimal-pad'
  | 'phone-pad';

export type KeyflowOptions = {
  /** Disable native attachment while retaining stable hook order. Default true. */
  enabled?: boolean;
  hapticsEnabled?: boolean;
  /** Show Android's 1–0 secondary legends above the top letter row. Default true. */
  showSecondaryKeyLabels?: boolean;
  keyboardMode?: 'custom' | 'system';
  keyboardType?: KeyflowKeyboardType;
  keyboardAppearance?: 'light' | 'dark';
  keyflowTheme?: KeyflowThemeOverrides | KeyflowTheme;
  /** Omit to discover supported device languages. Explicit entries also choose layout. */
  keyboardLanguages?: readonly KeyflowLanguage[];
  /** Android custom panel height in logical pixels; zero when hidden. */
  onKeyboardHeightChange?: (height: number) => void;
  /** Custom and system keyboard frames on both platforms. */
  onKeyboardFrameChange?: (frame: KeyflowKeyboardFrame) => void;
  onKeyboardModeChange?: (mode: 'custom' | 'system') => void;
  onKeyboardLanguageChange?: (selection: {
    language: string;
    layout: 'qwerty' | 'azerty';
  }) => void;
};

export type KeyflowBindings = Pick<
  TextInputProps,
  'showSoftInputOnFocus' | 'onFocus' | 'onSelectionChange'
>;

type KeyflowEvents = {
  onKeyflowFrameChange(event: KeyflowKeyboardFrame & { id: string }): void;
  onKeyflowHeightChange(event: { id: string; height: number }): void;
  onKeyflowModeChange(event: { id: string; mode: 'custom' | 'system' }): void;
  onKeyflowLanguageChange(event: {
    id: string;
    language: string;
    layout: 'qwerty' | 'azerty';
  }): void;
};
type KeyflowNativeModule = {
  addListener<Name extends keyof KeyflowEvents>(
    name: Name,
    listener: KeyflowEvents[Name],
  ): { remove(): void };
  attachInput(id: string, tag: number): Promise<void>;
  configure(
    id: string,
    mode: string,
    type: string,
    appearance: string,
    theme: string,
    languages: string,
    haptics: boolean,
    secondaryLabels: boolean,
  ): Promise<void>;
  updateInputContext(id: string): Promise<void>;
  getKeyboardMetrics(id: string): Promise<KeyflowKeyboardMetrics>;
  destroy(id: string): Promise<void>;
};

const KeyflowNative =
  Platform.OS === 'ios' || Platform.OS === 'android'
    ? requireNativeModule<KeyflowNativeModule>('Keyflow')
    : null;
let nextKeyflowId = 0;

/** Attach a native Keyflow keyboard to an app-owned single-line TextInput. */
export function useKeyflow(
  inputRef: RefObject<TextInput | null>,
  options: KeyflowOptions = {},
): KeyflowBindings {
  if (!KeyflowNative)
    throw new Error(
      'useKeyflow supports iOS and Android. Use a native build with Expo modules installed.',
    );
  const [id] = useState(() => `keyflow-${++nextKeyflowId}`);
  const colorScheme = useColorScheme();
  const mounted = useRef(true);
  const [error, setError] = useState<Error | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const {
    enabled = true,
    keyboardMode = 'custom',
    keyboardType = 'default',
    keyboardAppearance,
    keyflowTheme,
    keyboardLanguages,
    hapticsEnabled = false,
    showSecondaryKeyLabels = true,
    onKeyboardHeightChange,
    onKeyboardFrameChange,
    onKeyboardModeChange,
    onKeyboardLanguageChange,
  } = options;
  const appearance =
    (keyboardAppearance ?? colorScheme) === 'dark' ? 'dark' : 'light';
  const themeJSON = serializeKeyflowTheme(
    resolveInputTheme(
      Platform.OS,
      appearance === 'dark',
      keyboardType,
      keyflowTheme,
      Platform.OS === 'ios' && Platform.constants.interfaceIdiom === 'pad',
    ),
  );
  const languagesJSON = serializeKeyboardLanguages(keyboardLanguages);

  const attachInput = useCallback(async () => {
    const tag = inputRef.current && findNodeHandle(inputRef.current);
    if (tag == null)
      throw new Error(
        'useKeyflow requires a ref attached to a native single-line TextInput.',
      );
    await KeyflowNative.attachInput(id, tag);
  }, [id, inputRef]);

  useLayoutEffect(() => {
    mounted.current = true;
    if (!enabled) {
      void KeyflowNative.destroy(id);
      return;
    }
    registerDiagnostics(inputRef, () => KeyflowNative.getKeyboardMetrics(id));
    let active = true;
    void KeyflowNative.configure(
      id,
      keyboardMode,
      keyboardType,
      appearance,
      themeJSON,
      languagesJSON,
      hapticsEnabled,
      showSecondaryKeyLabels,
    )
      .then(attachInput)
      .catch((cause: Error) => {
        if (active) setError(cause);
      });
    return () => {
      active = false;
    };
  }, [
    appearance,
    attachInput,
    enabled,
    hapticsEnabled,
    id,
    inputRef,
    keyboardMode,
    keyboardType,
    languagesJSON,
    showSecondaryKeyLabels,
    themeJSON,
  ]);

  useEffect(
    () => () => {
      mounted.current = false;
      void KeyflowNative.destroy(id);
    },
    [id],
  );

  useEffect(() => {
    const subscriptions = [
      KeyflowNative.addListener('onKeyflowFrameChange', (event) => {
        if (event.id === id) onKeyboardFrameChange?.(event);
      }),
      KeyflowNative.addListener('onKeyflowHeightChange', (event) => {
        if (event.id !== id) return;
        setPanelHeight(event.height);
        onKeyboardHeightChange?.(event.height);
      }),
      KeyflowNative.addListener('onKeyflowModeChange', (event) => {
        if (event.id === id) onKeyboardModeChange?.(event.mode);
      }),
      KeyflowNative.addListener('onKeyflowLanguageChange', (event) => {
        if (event.id === id) onKeyboardLanguageChange?.(event);
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [
    id,
    onKeyboardFrameChange,
    onKeyboardHeightChange,
    onKeyboardLanguageChange,
    onKeyboardModeChange,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'android' || panelHeight === 0) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        inputRef.current?.blur();
        return true;
      },
    );
    return () => subscription.remove();
  }, [inputRef, panelHeight]);

  const bindings = useMemo<KeyflowBindings>(
    () => ({
      showSoftInputOnFocus: !enabled || keyboardMode === 'system',
      onFocus: () => {
        if (!enabled) return;
        attachInput().catch((cause: Error) => {
          if (mounted.current) setError(cause);
        });
      },
      onSelectionChange: () => {
        if (!enabled) return;
        KeyflowNative.updateInputContext(id).catch((cause: Error) => {
          if (mounted.current) setError(cause);
        });
      },
    }),
    [attachInput, enabled, id, keyboardMode],
  );
  if (error) throw error;
  return bindings;
}
