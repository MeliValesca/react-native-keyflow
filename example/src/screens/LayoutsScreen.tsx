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
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyflow, KeyflowAvoidingView } from 'react-native-keyflow';
import type { KeyflowKeyboardType } from 'react-native-keyflow';
import { ComparisonTabs } from '../components/common/ComparisonTabs';

const types = [
  { value: 'default', label: 'QWERTY' },
  { value: 'number-pad', label: 'Number' },
  { value: 'decimal-pad', label: 'Decimal' },
  { value: 'phone-pad', label: 'Phone' },
] as const;

export function LayoutsScreen() {
  const [type, setType] = useState<KeyflowKeyboardType>('default');
  const [mode, setMode] = useState<'custom' | 'system'>('custom');
  const [text, setText] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [status, setStatus] = useState(
    'Rotate the device with the keyboard open.',
  );
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const insets = useSafeAreaInsets();
  const header = useHeaderHeight();
  const { inputRef: input, keyflowInputProps: bindings } = useKeyflow({
    keyboardType: type,
    keyboardMode: mode,
    onKeyboardModeChange: setMode,
  });
  const inspect = async () => {
    try {
      const metrics = await getKeyboardMetrics(input);
      const failures = [...metrics.violations];
      if (mode === 'custom' && metrics.keyboardType !== type)
        failures.push('Wrong keyboard type');
      if (mode === 'custom' && metrics.landscape !== landscape)
        failures.push('Stale orientation');
      const result = {
        ...metrics,
        platform: Platform.OS,
        expectedType: type,
        expectedLandscape: landscape,
        failures,
      };
      setDiagnostic(JSON.stringify(result));
      console.log(`KEYFLOW_LAYOUT ${JSON.stringify(result)}`);
      setStatus(
        failures.length
          ? failures.join('; ')
          : `PASS ${type} ${landscape ? 'landscape' : 'portrait'}`,
      );
    } catch (error) {
      setStatus(String(error));
    }
  };
  return (
    <KeyflowAvoidingView
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? header : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{
          padding: 8,
          paddingLeft: Math.max(8, insets.left),
          paddingRight: Math.max(8, insets.right),
          gap: 8,
        }}
      >
        <View style={{ flexDirection: landscape ? 'row' : 'column', gap: 8 }}>
          <View style={{ flex: landscape ? 2 : undefined }}>
            <ComparisonTabs<KeyflowKeyboardType>
              value={type}
              options={types}
              onChange={setType}
            />
          </View>
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
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ExampleTextInput
            {...bindings}
            placeholder="Try this layout…"
            accessibilityLabel="Layout input"
            keyboardType={type}
            onChangeText={setText}
            style={{
              flex: 1,
              height: 44,
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
            }}
          />
          <Pressable
            accessibilityRole="button"
            testID="check-layout"
            accessibilityLabel={`Check layout${
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
            <Text>Check layout</Text>
          </Pressable>
        </View>
        <Text
          accessible
          testID="layout-status"
          accessibilityValue={{ text: diagnostic }}
          accessibilityLabel={`Layout status: ${status}`}
          style={{ color: '#192231', fontSize: 12 }}
        >
          {status} · Text: {text || '(empty)'}
        </Text>
      </ScrollView>
    </KeyflowAvoidingView>
  );
}
