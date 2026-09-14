import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { getKeyboardMetrics } from 'react-native-keyflow/testing';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyflowAvoidingView, useKeyflow } from 'react-native-keyflow';
import type { KeyflowKeyboardFrame } from 'react-native-keyflow';
import { ComparisonTabs } from '../components/common/ComparisonTabs';

const cases = {
  Empty: '',
  Accents: 'cafe',
  Cancel: '',
  Repeat: 'abcdefghijklmnop',
};

export function LongPressScreen() {
  const input = useRef<TextInput>(null);
  const [mode, setMode] = useState<'custom' | 'system'>('custom');
  const [seed, setSeed] = useState('');
  const [revision, setRevision] = useState(0);
  const [text, setText] = useState('');
  const [frame, setFrame] = useState<KeyflowKeyboardFrame | null>(null);
  const [diagnostic, setDiagnostic] = useState('Ready for comparison.');
  const header = useHeaderHeight();
  const bindings = useKeyflow(input, {
    keyboardMode: mode,
    keyboardAppearance: 'light',
    onKeyboardFrameChange: setFrame,
  });

  useFocusEffect(useCallback(() => () => void input.current?.blur(), []));

  const switchMode = async (next: 'custom' | 'system') => {
    setMode(next);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    input.current?.focus();
  };

  const reset = async (name: keyof typeof cases) => {
    await input.current?.blur();
    setSeed(cases[name]);
    setText(cases[name]);
    setDiagnostic(`Ready: ${name.toLowerCase()} case.`);
    setRevision((value) => value + 1);
  };

  const inspect = async () => {
    const metrics = await getKeyboardMetrics(input);
    const result = {
      mode,
      text: metrics?.text,
      popupVisible: metrics?.popupVisible,
      lastAccentChoices: metrics?.lastAccentChoices,
      lastAccentViolations: metrics?.lastAccentViolations,
      violations: metrics?.violations,
    };
    const value = JSON.stringify(result);
    setDiagnostic(value);
    console.info('KEYFLOW_LONG_PRESS_STATE', value);
  };

  const control = (label: string, action: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={action}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: 11,
        borderRadius: 10,
        backgroundColor: pressed ? '#CBD8EA' : '#DFE8F4',
      })}
    >
      <Text style={{ color: '#192231', fontSize: 12, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <View style={{ padding: 12, gap: 8 }}>
        <ComparisonTabs
          value={mode}
          options={[
            { value: 'custom', label: 'Keyflow' },
            {
              value: 'system',
              label: Platform.OS === 'ios' ? 'Apple native' : 'Android native',
            },
          ]}
          onChange={(next) => void switchMode(next)}
        />
        <Text style={{ color: '#526174', fontSize: 12, lineHeight: 17 }}>
          Hold a letter for its preview and accents. Drag across an accent row,
          drag away to cancel, or hold delete to compare repeat timing.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(cases) as (keyof typeof cases)[]).map((name) =>
            control(`Reset ${name}`, () => void reset(name)),
          )}
          {control('Inspect long press state', () => void inspect())}
        </View>
        <Text
          testID="long-press-text"
          accessibilityLabel={`Test text: ${text}`}
          style={{ color: '#192231', fontSize: 13 }}
        >
          Text: {text || '(empty)'}
        </Text>
        <Text
          testID="long-press-state"
          accessibilityLabel={`Long press state: ${diagnostic}`}
          numberOfLines={2}
          style={{ color: '#526174', fontSize: 10, height: 28 }}
        >
          {diagnostic}
        </Text>
      </View>
      <KeyflowAvoidingView
        keyboardFrame={frame}
        keyboardVerticalOffset={Platform.OS === 'ios' ? header : 0}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }} />
        <ExampleTextInput
          {...bindings}
          key={revision}
          ref={input}
          autoFocus
          defaultValue={seed}
          keyboardAppearance="light"
          accessibilityLabel="Long press test input"
          placeholder="Hold a key…"
          onChangeText={setText}
          style={{
            height: 48,
            marginHorizontal: 12,
            marginBottom: 8,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
          }}
        />
      </KeyflowAvoidingView>
    </View>
  );
}
