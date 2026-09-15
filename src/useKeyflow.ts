import { registerDiagnostics } from './diagnostics';
import type { KeyflowKeyboardMetrics } from './diagnostics';
import { serializeKeyboardLanguages } from './languages';
import type { KeyflowLanguage } from './languages';
import type { KeyflowKeyboardFrame } from './keyboardGeometry';
import {
  claimKeyflowFrame,
  clearKeyflowFrame,
  publishKeyflowFrame,
} from './keyflowFrameStore';
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

export type KeyflowInputProps = Pick<
  TextInputProps,
  'showSoftInputOnFocus' | 'onFocus' | 'onSelectionChange'
> & { ref: RefObject<TextInput | null> };

export type KeyflowResult = {
  keyflowInputProps: KeyflowInputProps;
  inputRef: RefObject<TextInput | null>;
  focus(): void;
  blur(): void;
};

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
  attachInput(id: string, tag: number): Promise<boolean | void>;
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

/** Attach a native Keyflow keyboard to an app-owned TextInput. */
export function useKeyflow(options: KeyflowOptions = {}): KeyflowResult {
  if (!KeyflowNative)
    throw new Error(
      'useKeyflow supports iOS and Android. Use a native build with Expo modules installed.',
    );
  const [id] = useState(() => `keyflow-${++nextKeyflowId}`);
  const inputRef = useRef<TextInput>(null);
  const focus = useCallback(() => inputRef.current?.focus(), []);
  const blur = useCallback(() => inputRef.current?.blur(), []);
  const colorScheme = useColorScheme();
  const mounted = useRef(true);
  const attachmentAllowed = useRef(true);
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

  const attachInput = useCallback(
    async (required = true) => {
      const tag = inputRef.current && findNodeHandle(inputRef.current);
      if (tag == null) {
        if (!required) return;
        throw new Error(
          'useKeyflow requires a ref attached to a native TextInput.',
        );
      }
      if (required || inputRef.current?.isFocused?.()) claimKeyflowFrame(id);
      const target = inputRef.current;
      for (let attempt = 0; attempt < 8; attempt++) {
        if (
          !mounted.current ||
          !attachmentAllowed.current ||
          inputRef.current !== target
        )
          return;
        if ((await KeyflowNative.attachInput(id, tag)) !== false) return;
        // Wait for another mount frame only when Android reports “not ready”.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
      if (
        mounted.current &&
        attachmentAllowed.current &&
        inputRef.current === target
      ) {
        throw new Error('Keyflow TextInput did not finish its native mount.');
      }
    },
    [id, inputRef],
  );

  // Keep teardown in the same phase, before configuration setup. A passive
  // cleanup during Fast Refresh can otherwise destroy the newly configured id.
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      attachmentAllowed.current = false;
      clearKeyflowFrame(id);
      void KeyflowNative.destroy(id);
    };
  }, [id]);

  useLayoutEffect(() => {
    mounted.current = true;
    attachmentAllowed.current = enabled;
    if (!enabled) {
      clearKeyflowFrame(id);
      setPanelHeight(0);
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
      .then(() => {
        if (active) return attachInput(false);
      })
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

  useEffect(() => {
    const subscriptions = [
      KeyflowNative.addListener('onKeyflowFrameChange', (event) => {
        if (event.id !== id) return;
        if (enabled) publishKeyflowFrame(id, event);
        onKeyboardFrameChange?.(event);
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
    enabled,
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

  const keyflowInputProps = useMemo<KeyflowInputProps>(
    () => ({
      ref: inputRef,
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
  return { keyflowInputProps, inputRef, focus, blur };
}
