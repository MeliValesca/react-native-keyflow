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
  useCallback,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Platform,
  View,
  findNodeHandle,
  useColorScheme,
} from 'react-native';
import type {
  NativeMethods,
  NativeSyntheticEvent,
  ViewProps,
  TextInput,
  TextInputProps,
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

export type KeyflowKeyboardRef = {
  /** Apply a mode natively before a subsequent focus request. Preserves text/selection. */
  setKeyboardMode(mode: 'custom' | 'system'): Promise<void>;
  focus(): Promise<void>;
  blur(): Promise<void>;
};
export type KeyflowKeyboardProps = Omit<ViewProps, 'children'> & {
  /** Render a single-line TextInput. Forward all bindings to the native input. */
  renderInput: (bindings: KeyflowInputBindings) => React.ReactElement;
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
  /** Custom and system keyboard frames on both platforms, including Android animation updates. */
  onKeyboardFrameChange?: (frame: KeyflowKeyboardFrame) => void;
  onKeyboardModeChange?: (mode: 'custom' | 'system') => void;
  onKeyboardLanguageChange?: (selection: {
    language: string;
    layout: 'qwerty' | 'azerty';
  }) => void;
};
export type KeyflowInputBindings = Pick<
  TextInputProps,
  'showSoftInputOnFocus' | 'onFocus' | 'onSelectionChange'
> & {
  ref: React.RefCallback<TextInput>;
};

type NativeInputRef = KeyflowKeyboardRef & {
  attachInput(tag: number | null): Promise<void>;
  updateInputContext(): Promise<void>;
  getNativeRef(): NativeMethods | null;
  getKeyboardMetrics(): Promise<KeyflowKeyboardMetrics>;
};
type NativeProps = Omit<
  KeyflowKeyboardProps,
  | 'onKeyboardFrameChange'
  | 'onKeyboardHeightChange'
  | 'keyboardTheme'
  | 'keyboardLanguages'
  | 'keyboardAppearance'
  | 'renderInput'
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

/** A native keyboard attached to an app-owned React Native TextInput. */
export const KeyflowKeyboard = forwardRef<
  KeyflowKeyboardRef,
  KeyflowKeyboardProps
>(function KeyflowKeyboardComponent(
  {
    renderInput,
    onKeyboardHeightChange,
    onKeyboardFrameChange,
    keyboardAppearance,
    keyboardTheme,
    keyboardLanguages,
    keyboardMode,
    keyboardType,
    hapticsEnabled,
    showSecondaryKeyLabels,
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
  const inputRef = useRef<TextInput | null>(null);
  const laidOut = useRef(false);
  const mounted = useRef(true);
  const waitForLayout = useCallback(async () => {
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
  }, []);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [attachmentError, setAttachmentError] = useState<Error | null>(null);
  const [, setInputRevision] = useState(0);
  const captureInput = useCallback((input: TextInput | null) => {
    if (inputRef.current === input) return;
    inputRef.current = input;
    setInputRevision((revision) => revision + 1);
  }, []);
  const attachInput = useCallback(async () => {
    await waitForLayout();
    if (!mounted.current || !nativeRef.current) return;
    const input = inputRef.current;
    const tag = input && findNodeHandle(input);
    if (tag == null)
      throw new Error(
        'KeyflowKeyboard: renderInput must forward the supplied ref to a native TextInput.',
      );
    await nativeRef.current.attachInput(tag);
  }, [waitForLayout]);
  // Rebind after a consumer replaces its input, and after RN applies input props.
  useLayoutEffect(() => {
    let active = true;
    attachInput().catch((error: Error) => {
      if (active) setAttachmentError(error);
    });
    return () => {
      active = false;
    };
  });
  const [panelHeight, setPanelHeight] = useState(0);
  useImperativeHandle(
    ref,
    () =>
      registerDiagnostics(
        {
          setKeyboardMode: async (mode) => {
            await waitForLayout();
            if (mounted.current) {
              await attachInput();
              await nativeRef.current?.setKeyboardMode(mode);
            }
          },
          focus: async () => {
            await waitForLayout();
            if (!mounted.current) return;
            try {
              await attachInput();
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
          await attachInput();
          return nativeRef.current.getKeyboardMetrics();
        },
      ),
    [attachInput, waitForLayout],
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
  if (attachmentError) throw attachmentError;
  if (!NativeInput)
    throw new Error(
      'KeyflowKeyboard supports iOS and Android. Use a native build with Expo modules installed.',
    );
  const theme = resolveInputTheme(
    Platform.OS,
    (keyboardAppearance ?? colorScheme) === 'dark',
    keyboardType ?? 'default',
    keyboardTheme,
    Platform.OS === 'ios' && Platform.constants.interfaceIdiom === 'pad',
  );
  const host = (
    <NativeInput
      ref={nativeRef}
      onLayout={() => {
        laidOut.current = true;
      }}
      style={{ position: 'absolute', width: 1, height: 1 }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      keyboardMode={keyboardMode}
      keyboardType={keyboardType}
      hapticsEnabled={hapticsEnabled}
      showSecondaryKeyLabels={showSecondaryKeyLabels}
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
      onKeyflowLanguageChange={(event) =>
        onKeyboardLanguageChange?.(event.nativeEvent)
      }
      onKeyflowModeChange={(event) =>
        onKeyboardModeChange?.(event.nativeEvent.mode)
      }
    />
  );
  return (
    <View {...props} style={style} onLayout={onLayout}>
      {host}
      {renderInput({
        ref: captureInput,
        showSoftInputOnFocus: false,
        onFocus: () => {
          attachInput().catch((error: Error) => {
            if (mounted.current) setAttachmentError(error);
          });
        },
        onSelectionChange: () => {
          nativeRef.current?.updateInputContext().catch((error: Error) => {
            if (mounted.current) setAttachmentError(error);
          });
        },
      })}
    </View>
  );
});
