import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { getKeyboardMetrics } from 'react-native-keyflow/testing';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useKeyflow, KeyflowAvoidingView } from 'react-native-keyflow';

import { ComparisonTabs } from '../components/common/ComparisonTabs';

// Android's ScrollView can transfer focus during an orientation resize.
// This compact demo fits without scrolling on Android. iOS retains scrolling.
const Content = Platform.OS === 'android' ? View : ScrollView;

export function LanguageScreen() {
  const [source, setSource] = useState<'example' | 'device'>('example');
  const [layout, setLayout] = useState<'azerty' | 'qwerty'>('azerty');
  const [mode, setMode] = useState<'custom' | 'system'>('custom');
  const [selection, setSelection] = useState('English · QWERTY');
  const [diagnostic, setDiagnostic] = useState('');
  const [error, setError] = useState('');
  const header = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const { inputRef: input, keyflowInputProps: bindings } = useKeyflow({
    keyboardLanguages:
      source === 'device'
        ? undefined
        : [{ language: 'en' }, { language: 'fr', layout }],
    keyboardMode: mode,
    onKeyboardModeChange: setMode,
    onKeyboardLanguageChange: (value) =>
      setSelection(`${value.language} · ${value.layout.toUpperCase()}`),
  });
  const contentStyle = {
    padding: landscape ? 8 : 12,
    paddingLeft: Math.max(8, insets.left),
    paddingRight: Math.max(8, insets.right),
    gap: 8,
  };
  const inspect = async () => {
    try {
      const value = await getKeyboardMetrics(input);
      setDiagnostic(JSON.stringify(value));
      setSelection(
        `${value.keyboardLanguage} · ${value.keyboardLayout?.toUpperCase()}`,
      );
      setError(value.violations.join('; '));
    } catch (failure) {
      setError(String(failure));
    }
  };
  return (
    <KeyflowAvoidingView
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? header : 0}
    >
      <Content
        {...(Platform.OS === 'ios'
          ? {
              keyboardShouldPersistTaps: 'always' as const,
              removeClippedSubviews: false,
              contentContainerStyle: contentStyle,
            }
          : { style: contentStyle })}
      >
        <View
          style={{
            flexDirection: landscape ? 'row' : 'column',
            display: landscape && Platform.OS === 'android' ? 'none' : 'flex',
            gap: 8,
          }}
        >
          <View style={{ flex: landscape ? 1 : undefined }}>
            <ComparisonTabs<'example' | 'device'>
              value={source}
              options={[
                { value: 'example', label: 'English + French' },
                { value: 'device', label: 'Device languages' },
              ]}
              onChange={setSource}
            />
          </View>
          {source === 'example' && (
            <View style={{ flex: landscape ? 1 : undefined }}>
              <ComparisonTabs<'qwerty' | 'azerty'>
                value={layout}
                options={[
                  { value: 'azerty', label: 'French AZERTY' },
                  { value: 'qwerty', label: 'French QWERTY' },
                ]}
                onChange={setLayout}
              />
            </View>
          )}
        </View>
        <View style={{ flexDirection: landscape ? 'row' : 'column', gap: 8 }}>
          <View style={{ flex: landscape ? 1 : undefined }}>
            <ComparisonTabs
              value={mode}
              options={[
                {
                  value: 'custom',
                  label: 'Keyflow',
                  accessibilityLabel: 'Custom keyboard',
                },
                { value: 'system', label: 'Native' },
              ]}
              onChange={(next) => {
                setMode(next);
                setTimeout(() => input.current?.focus(), 0);
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              flex: landscape ? 2 : undefined,
            }}
          >
            <ExampleTextInput
              {...bindings}
              accessibilityLabel="Language input"
              placeholder="Hello / Bonjour…"
              autoCorrect={false}
              style={{
                flex: 1,
                height: 44,
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
              }}
            />
            <Pressable
              accessibilityRole="button"
              testID="check-language"
              accessibilityLabel={`Check language${
                diagnostic ? `: ${diagnostic}` : ''
              }`}
              onPress={() => void inspect()}
              style={({ pressed }) => ({
                padding: 12,
                backgroundColor: '#DFE8F4',
                borderRadius: 8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text>Check</Text>
            </Pressable>
          </View>
        </View>
        <Text style={{ color: '#192231', fontWeight: '600' }}>
          {mode === 'system'
            ? 'Native keyboard controls its own languages'
            : selection}
        </Text>
        {!landscape && (
          <Text style={{ color: '#627084', lineHeight: 21 }}>
            {source === 'example'
              ? 'Tap the globe on Keyflow to switch English and French. Hold a letter for accents. Your text stays in place.'
              : 'Only supported English and French preferences appear. Layout templates are QWERTY for English/Canadian French and AZERTY for other French locales.'}
          </Text>
        )}
        {!landscape && (
          <Text style={{ color: '#627084', lineHeight: 21 }}>
            The Native tab uses your installed keyboard and its enabled
            languages. Keyflow’s layout choice does not change those settings.
          </Text>
        )}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: '#A02020' }}>
            {error}
          </Text>
        ) : null}
        <Text
          testID="language-state"
          accessibilityLabel={`Language state: ${diagnostic}`}
          style={{ fontSize: 1, height: 1, color: '#627084' }}
        >
          {diagnostic}
        </Text>
      </Content>
    </KeyflowAvoidingView>
  );
}
