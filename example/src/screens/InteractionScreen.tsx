import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { settledKeyboardMode } from '../testing/settledKeyboardMode';
import { getKeyboardMetrics } from 'react-native-keyflow/testing';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyflowAvoidingView, KeyflowKeyboard } from 'react-native-keyflow';
import type {
  KeyflowKeyboardFrame,
  KeyflowKeyboardRef,
} from 'react-native-keyflow';
import { ComparisonTabs } from '../components/common/ComparisonTabs';

const cases = {
  Empty: '',
  Grapheme: 'A👨‍👩‍👧‍👦',
  Tone: 'A👋🏽',
  Repeat: 'abcdefghijklmnop',
  Cursor: 'alpha beta',
};
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export function InteractionScreen() {
  const input = useRef<KeyflowKeyboardRef>(null);
  const [mode, setMode] = useState<'custom' | 'system'>('custom');
  const [revision, setRevision] = useState(0);
  const [text, setText] = useState('');
  const [frame, setFrame] = useState<KeyflowKeyboardFrame | null>(null);
  const [diagnostic, setDiagnostic] = useState('');
  const [running, setRunning] = useState(false);
  const alive = useRef(true);
  const request = useRef(0);
  const header = useHeaderHeight();
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      return () => {
        alive.current = false;
        request.current++;
        void input.current?.blur();
      };
    }, []),
  );
  const switchMode = async (next: 'custom' | 'system') => {
    const id = ++request.current;
    setMode(next);
    await input.current?.setKeyboardMode(next);
    if (alive.current && id === request.current) await input.current?.focus();
  };
  const reset = async (name: keyof typeof cases) => {
    await input.current?.blur();
    setText(cases[name]);
    setDiagnostic('');
    setFrame(null);
    setRevision((value) => value + 1);
  };
  const inspect = async () => {
    const metrics = await getKeyboardMetrics(input.current);
    setDiagnostic(JSON.stringify(metrics));
    console.info('KEYFLOW_INTERACTION_STATE', JSON.stringify(metrics));
  };
  const run = async () => {
    if (running) return;
    setRunning(true);
    const results: object[] = [];
    try {
      const initial = await getKeyboardMetrics(input.current);
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const next of ['system', 'custom'] as const) {
          if (!alive.current) throw new Error('Screen closed');
          await switchMode(next);
          const metrics =
            Platform.OS === 'android'
              ? await settledKeyboardMode(
                  () => getKeyboardMetrics(input.current),
                  next,
                )
              : await pause(400).then(() => getKeyboardMetrics(input.current));
          if (metrics.keyboardMode !== next || !metrics.focused)
            throw new Error(`Wrong focus/mode: ${JSON.stringify(metrics)}`);
          if (
            metrics.text !== initial.text ||
            metrics.selectionStart !== initial.selectionStart ||
            metrics.selectionEnd !== initial.selectionEnd
          )
            throw new Error(
              `Text or selection changed: ${JSON.stringify(metrics)}`,
            );
          if (next === 'custom' && metrics.keyboardPage !== 'letters')
            throw new Error(
              `Stale page after handoff: ${JSON.stringify(metrics)}`,
            );
          if (
            Platform.OS === 'android' &&
            (next === 'system'
              ? !metrics.systemKeyboardVisible || metrics.popupVisible
              : !metrics.popupVisible || metrics.systemKeyboardVisible)
          )
            throw new Error(
              `Wrong keyboard window: ${JSON.stringify(metrics)}`,
            );
          if (metrics.violations.length)
            throw new Error(metrics.violations.join(', '));
          results.push({
            cycle,
            mode: next,
            page: metrics.keyboardPage,
            text: metrics.text,
            selection: [metrics.selectionStart, metrics.selectionEnd],
          });
        }
      }
      const result = { result: 'PASS', checks: results.length, results };
      console.info('KEYFLOW_SWITCH_TEST', JSON.stringify(result));
      setDiagnostic(JSON.stringify(result));
    } catch (error) {
      const result = { result: 'FAIL', error: String(error), results };
      console.info('KEYFLOW_SWITCH_TEST', JSON.stringify(result));
      if (alive.current) setDiagnostic(JSON.stringify(result));
    } finally {
      if (alive.current) setRunning(false);
    }
  };
  const control = (label: string, action: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={running}
      onPress={action}
      style={({ pressed }) => ({
        paddingHorizontal: 10,
        minHeight: 44,
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: '#DFE8F4',
        opacity: pressed || running ? 0.5 : 1,
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
        <ComparisonTabs<'custom' | 'system'>
          value={mode}
          options={[
            {
              value: 'custom',
              label: 'Keyflow',
              testID: 'interaction-mode-custom',
            },
            {
              value: 'system',
              testID: 'interaction-mode-system',
              label: Platform.OS === 'ios' ? 'Apple native' : 'Android native',
            },
          ]}
          onChange={(next) => {
            if (!running) void switchMode(next);
          }}
        />
        <Text style={{ color: '#526174', fontSize: 12 }}>
          Use the same cases with each keyboard. Compare accents, cursor
          movement and held delete.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {(Object.keys(cases) as (keyof typeof cases)[]).map((name) =>
            control(`Reset ${name}`, () => void reset(name)),
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {control('Inspect keyboard state', () => void inspect())}
          {control('Run switching checks', () => void run())}
        </View>
        <Text
          testID="interaction-text"
          accessibilityLabel={`Test text: ${text}`}
          style={{ color: '#192231', fontSize: 13 }}
        >
          Text: {text || '(empty)'}
        </Text>
        <Text
          testID="interaction-state"
          accessibilityLabel={`Diagnostic state: ${diagnostic}`}
          numberOfLines={2}
          style={{ color: '#526174', fontSize: 10, height: 28 }}
        >
          {running
            ? 'Running switching checks…'
            : diagnostic || 'Ready for comparison.'}
        </Text>
      </View>
      <KeyflowAvoidingView
        keyboardFrame={frame}
        keyboardVerticalOffset={Platform.OS === 'ios' ? header : 0}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }} />
        <KeyflowKeyboard
          key={revision}
          ref={input}
          keyboardMode={mode}
          keyboardAppearance="light"
          onKeyboardFrameChange={setFrame}
          renderInput={(bindings) => (
            <ExampleTextInput
              {...bindings}
              autoFocus
              value={text}
              keyboardAppearance="light"
              accessibilityLabel="Interaction test input"
              placeholder="Start typing…"
              onChangeText={(value) => {
                setText(value);
                console.info(
                  'KEYFLOW_EDIT',
                  JSON.stringify({ mode, text: value, time: Date.now() }),
                );
              }}
              style={{
                height: 48,
                marginHorizontal: 12,
                marginBottom: 8,
                backgroundColor: 'white',
                borderRadius: 12,
              }}
            />
          )}
        />
      </KeyflowAvoidingView>
    </View>
  );
}
