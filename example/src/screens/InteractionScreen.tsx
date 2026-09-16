import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { settledKeyboardMode } from '../testing/settledKeyboardMode';
import { getKeyboardMetrics } from 'react-native-keyflow/testing';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Routes } from '../App';
import { Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyflowAvoidingView, useKeyflow } from 'react-native-keyflow';

import { ComparisonTabs } from '../components/common/ComparisonTabs';

const cases = {
  Empty: '',
  Grapheme: 'A👨‍👩‍👧‍👦',
  Tone: 'A👋🏽',
  Repeat: 'abcdefghijklmnop',
  Cursor: 'alpha beta',
  'Backward Cursor': 'beta alpha',
  Multiline: 'alpha\nbeta\ngamma',
};
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export function InteractionScreen({
  navigation,
}: NativeStackScreenProps<Routes, 'Interactions'>) {
  const [mode, setMode] = useState<'custom' | 'system'>('custom');
  const [revision, setRevision] = useState(0);
  const [text, setText] = useState('');
  const [multiline, setMultiline] = useState(false);
  const [diagnostic, setDiagnostic] = useState('');
  const [running, setRunning] = useState(false);
  const alive = useRef(true);
  const request = useRef(0);
  const diagnosticRequest = useRef(0);
  const entered = useRef(false);
  const mountedRevision = useRef<number | null>(null);
  const focusedRevision = useRef<number | null>(null);
  const header = useHeaderHeight();
  const {
    inputRef: input,
    keyflowInputProps: bindings,
    focus,
    blur,
  } = useKeyflow({
    keyboardMode: mode,
    keyboardAppearance: 'light',
  });
  useEffect(
    () =>
      navigation.addListener('transitionEnd', (event) => {
        if (event.data.closing) return;
        entered.current = true;
        if (mountedRevision.current === revision) {
          focusedRevision.current = revision;
          focus();
        }
      }),
    [focus, navigation, revision],
  );
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      return () => {
        alive.current = false;
        entered.current = false;
        focusedRevision.current = null;
        request.current++;
        blur();
      };
    }, [blur]),
  );
  const switchMode = async (next: 'custom' | 'system') => {
    const id = ++request.current;
    setMode(next);
    await pause(0);
    if (alive.current && id === request.current) focus();
  };
  const reset = async (name: keyof typeof cases) => {
    diagnosticRequest.current++;
    blur();
    setText(cases[name]);
    setMultiline(name === 'Multiline');
    setDiagnostic('');
    setRevision((value) => value + 1);
  };
  const inspect = async () => {
    const id = ++diagnosticRequest.current;
    setDiagnostic('');
    const metrics = await getKeyboardMetrics(input);
    if (alive.current && id === diagnosticRequest.current) {
      setDiagnostic(JSON.stringify({ ...metrics, diagnosticRequest: id }));
    }
    console.info('KEYFLOW_INTERACTION_STATE', JSON.stringify(metrics));
  };
  const run = async () => {
    if (running) return;
    diagnosticRequest.current++;
    setDiagnostic('');
    setRunning(true);
    const results: object[] = [];
    try {
      const initial = await getKeyboardMetrics(input);
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const next of ['system', 'custom'] as const) {
          if (!alive.current) throw new Error('Screen closed');
          await switchMode(next);
          const metrics =
            Platform.OS === 'android'
              ? await settledKeyboardMode(() => getKeyboardMetrics(input), next)
              : await pause(400).then(() => getKeyboardMetrics(input));
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
      setDiagnostic(
        JSON.stringify({
          ...result,
          diagnosticRequest: diagnosticRequest.current,
        }),
      );
    } catch (error) {
      const result = { result: 'FAIL', error: String(error), results };
      console.info('KEYFLOW_SWITCH_TEST', JSON.stringify(result));
      if (alive.current)
        setDiagnostic(
          JSON.stringify({
            ...result,
            diagnosticRequest: diagnosticRequest.current,
          }),
        );
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? header : 0}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }} />
        <ExampleTextInput
          {...bindings}
          onLayout={() => {
            mountedRevision.current = revision;
            if (entered.current && focusedRevision.current !== revision) {
              focusedRevision.current = revision;
              focus();
            }
          }}
          key={revision}
          testID={`interaction-input-${revision}`}
          value={text}
          multiline={multiline}
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
            height: multiline ? 120 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
            marginHorizontal: 12,
            marginBottom: 8,
            backgroundColor: 'white',
            borderRadius: 12,
          }}
        />
      </KeyflowAvoidingView>
    </View>
  );
}
