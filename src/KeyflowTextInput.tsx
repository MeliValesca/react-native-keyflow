import { waitForInputLayout } from './inputLayout';
import { registerDiagnostics } from './diagnostics';
import type { KeyflowKeyboardMetrics } from './diagnostics';
import { serializeKeyboardLanguages } from './languages';
import type { KeyflowLanguage } from './languages';
import type { KeyflowKeyboardFrame } from './keyboardGeometry';
import { requireNativeView } from 'expo';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { BackHandler, Platform, useColorScheme } from 'react-native';
import type {
  NativeMethods,
  NativeSyntheticEvent,
  ViewProps,
} from 'react-native';
import { resolveInputTheme } from './inputTheme';
import { serializeKeyboardTheme } from './serializeTheme';
import type { KeyboardTheme, KeyboardThemeOverrides } from './types';

/** Supported native layouts. Keyboard type is a layout hint, not input validation. */
export type KeyflowKeyboardType =
  | 'default'
  | 'number-pad'
  | 'decimal-pad'
  | 'phone-pad';

export type KeyflowTextInputRef = {
  /** Apply a mode natively before a subsequent focus request. Preserves text/selection. */
  setKeyboardMode(mode: 'custom' | 'system'): Promise<void>;
  focus(): Promise<void>;
  blur(): Promise<void>;
};
export type KeyflowTextInputProps = ViewProps & {
  /** Native-owned text. Remount using React's key prop to reset. */
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
  /** System-keyboard autocorrection hint. Custom word suggestions and replacements are disabled. */
  autoCorrect?: boolean;
  inputAccessibilityLabel?: string;
  hapticsEnabled?: boolean;
  /** Show Android's 1–0 secondary legends above the top letter row. Long-press shortcuts remain available when hidden. Default true. */
  showSecondaryKeyLabels?: boolean;
  keyboardMode?: 'custom' | 'system';
  keyboardType?: KeyflowKeyboardType;
  keyboardAppearance?: 'light' | 'dark';
  keyboardTheme?: KeyboardThemeOverrides | KeyboardTheme;
  /** Omit to discover supported device languages. Explicit entries also choose layout. System mode ignores this. */
  keyboardLanguages?: readonly KeyflowLanguage[];
  /** Android custom panel height in logical pixels; zero when hidden. */
  onKeyboardHeightChange?: (height: number) => void;
  /** Android custom and system keyboard frames, including animation updates. */
  onKeyboardFrameChange?: (frame: KeyflowKeyboardFrame) => void;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: (text: string) => void;
  onKeyboardModeChange?: (mode: 'custom' | 'system') => void;
  onKeyboardLanguageChange?: (selection: {
    language: string;
    layout: 'qwerty' | 'azerty';
  }) => void;
};
type NativeInputRef = KeyflowTextInputRef & {
  getNativeRef(): NativeMethods | null;
  getKeyboardMetrics(): Promise<KeyflowKeyboardMetrics>;
};
type TextEvent = NativeSyntheticEvent<{ text: string }>;
type NativeProps = Omit<
  KeyflowTextInputProps,
  | 'onKeyboardFrameChange'
  | 'onKeyboardHeightChange'
  | 'keyboardTheme'
  | 'keyboardLanguages'
  | 'keyboardAppearance'
  | 'onChangeText'
  | 'onSubmitEditing'
  | 'onKeyboardModeChange'
  | 'onKeyboardLanguageChange'
> & {
  ref?: React.Ref<NativeInputRef>;
  keyboardAppearance: 'light' | 'dark';
  themeJSON: string;
  languagesJSON: string;
  onKeyflowFrameChange?: (
    event: NativeSyntheticEvent<KeyflowKeyboardFrame>,
  ) => void;
  onKeyflowHeightChange?: (
    event: NativeSyntheticEvent<{ height: number }>,
  ) => void;
  onKeyflowTextChange?: (event: TextEvent) => void;
  onKeyflowSubmit?: (event: TextEvent) => void;
  onKeyflowLanguageChange?: (
    event: NativeSyntheticEvent<{
      language: string;
      layout: 'qwerty' | 'azerty';
    }>,
  ) => void;
  onKeyflowModeChange?: (
    event: NativeSyntheticEvent<{ mode: 'custom' | 'system' }>,
  ) => void;
};
const NativeInput =
  Platform.OS === 'ios' || Platform.OS === 'android'
    ? requireNativeView<NativeProps>('Keyflow')
    : null;

/** Native-owned editor with a customizable app keyboard. */
export const KeyflowTextInput = forwardRef<
  KeyflowTextInputRef,
  KeyflowTextInputProps
>(function KeyflowTextInputComponent(
  {
    onKeyboardHeightChange,
    onKeyboardFrameChange,
    keyboardAppearance,
    keyboardTheme,
    keyboardLanguages,
    onChangeText,
    onSubmitEditing,
    onKeyboardModeChange,
    onKeyboardLanguageChange,
    onLayout,
    style,
    ...props
  },
  ref,
) {
  const colorScheme = useColorScheme();
  const nativeRef = useRef<NativeInputRef>(null);
  const laidOut = useRef(false);
  const mounted = useRef(true);
  const waitForLayout = async () => {
    // Recover when Fabric's initial layout event precedes JS registration.
    await waitForInputLayout({
      ready: () => laidOut.current,
      mounted: () => mounted.current,
      measure: (callback) =>
        nativeRef.current
          ?.getNativeRef()
          ?.measure((_x, _y, width, height) => callback(width, height)),
    });
    if (mounted.current) laidOut.current = true;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [panelHeight, setPanelHeight] = useState(0);
  useImperativeHandle(
    ref,
    () =>
      registerDiagnostics(
        {
          setKeyboardMode: async (mode) => {
            await waitForLayout();
            if (mounted.current) await nativeRef.current?.setKeyboardMode(mode);
          },
          focus: async () => {
            await waitForLayout();
            if (!mounted.current) return;
            try {
              await nativeRef.current?.focus();
            } catch (error) {
              if (mounted.current) throw error;
            }
          },
          blur: async () => {
            // A view that has never laid out cannot own an on-screen keyboard.
            if (!laidOut.current || !mounted.current) return;
            try {
              await nativeRef.current?.blur();
            } catch (error) {
              if (mounted.current) throw error;
            }
          },
        },
        async () => {
          await waitForLayout();
          if (!mounted.current || !nativeRef.current)
            throw new Error('Keyflow input is not mounted');
          return nativeRef.current.getKeyboardMetrics();
        },
      ),
    [],
  );
  useEffect(() => {
    if (Platform.OS !== 'android' || panelHeight === 0) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        void nativeRef.current?.blur();
        return true;
      },
    );
    return () => subscription.remove();
  }, [panelHeight]);
  if (!NativeInput)
    throw new Error(
      'KeyflowTextInput supports iOS and Android. Use a native build with Expo modules installed.',
    );
  const theme = resolveInputTheme(
    Platform.OS,
    (keyboardAppearance ?? colorScheme) === 'dark',
    props.keyboardType ?? 'default',
    keyboardTheme,
    Platform.OS === 'ios' && Platform.constants.interfaceIdiom === 'pad',
  );
  return (
    <NativeInput
      {...props}
      ref={nativeRef}
      onLayout={(event) => {
        laidOut.current = true;
        onLayout?.(event);
      }}
      style={[{ height: 48 }, style]}
      onKeyflowFrameChange={(event) =>
        onKeyboardFrameChange?.(event.nativeEvent)
      }
      onKeyflowHeightChange={(event) => {
        setPanelHeight(event.nativeEvent.height);
        onKeyboardHeightChange?.(event.nativeEvent.height);
      }}
      keyboardAppearance={
        (keyboardAppearance ?? colorScheme) === 'dark' ? 'dark' : 'light'
      }
      themeJSON={serializeKeyboardTheme(theme)}
      languagesJSON={serializeKeyboardLanguages(keyboardLanguages)}
      onKeyflowTextChange={(event) => onChangeText?.(event.nativeEvent.text)}
      onKeyflowSubmit={(event) => onSubmitEditing?.(event.nativeEvent.text)}
      onKeyflowLanguageChange={(event) =>
        onKeyboardLanguageChange?.(event.nativeEvent)
      }
      onKeyflowModeChange={(event) =>
        onKeyboardModeChange?.(event.nativeEvent.mode)
      }
    />
  );
});
