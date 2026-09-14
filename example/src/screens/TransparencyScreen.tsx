import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { getKeyboardMetrics } from 'react-native-keyflow/testing';
import { useCallback, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KeyflowAvoidingView,
  KeyflowKeyboard,
  createKeyboardTheme,
  transparentKeyboardTheme,
} from 'react-native-keyflow';
import type {
  KeyflowKeyboardFrame,
  KeyflowKeyboardRef,
} from 'react-native-keyflow';
import { settledKeyboard } from '../testing/settledKeyboard';
import { OpacitySlider } from '../components/common/OpacitySlider';

const wallpaper = require('../../assets/backdrops/coast.jpg');
export function TransparencyScreen() {
  const input = useRef<KeyflowKeyboardRef>(null);
  const [backdrop, setBackdrop] = useState(0);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.35);
  const [keyOpacity, setKeyOpacity] = useState(
    transparentKeyboardTheme.keyOpacity,
  );
  const [frame, setFrame] = useState<KeyflowKeyboardFrame | null>(null);
  const latestFrame = useRef<KeyflowKeyboardFrame | null>(null);
  const [result, setResult] = useState('');
  const [running, setRunning] = useState(false);
  const header = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const leftInset = Math.max(16, insets.left + 12);
  const rightInset = Math.max(16, insets.right + 12);
  useFocusEffect(
    useCallback(
      () => () => {
        void input.current?.blur();
      },
      [],
    ),
  );
  const check = async () => {
    setRunning(true);
    try {
      await input.current?.focus();
      const metrics = await settledKeyboard(async () => ({
        visible:
          Platform.OS === 'ios'
            ? Keyboard.isVisible()
            : latestFrame.current?.visible === true,
        metrics: await getKeyboardMetrics(input.current),
      }));
      if (metrics.violations.length)
        throw new Error(metrics.violations.join(', '));
      if (metrics.lastAccentViolations?.length)
        throw new Error(metrics.lastAccentViolations.join(', '));
      if (
        metrics.editorBottom !== undefined &&
        metrics.screenY !== undefined &&
        metrics.editorBottom > metrics.screenY + 1
      )
        throw new Error(
          `The keyboard overlaps the text field: ${JSON.stringify(metrics)}`,
        );
      const message = `PASS: ${metrics.keyCount} keys fit. Change the background or opacity to compare.`;
      console.info(
        'KEYFLOW_TRANSPARENCY_TEST',
        JSON.stringify({
          platform: Platform.OS,
          backdrop,
          backgroundOpacity,
          keyOpacity,
          metrics,
          result: 'PASS',
        }),
      );
      setResult(message);
    } catch (error) {
      setResult(`FAIL: ${String(error)}`);
      console.info(
        'KEYFLOW_TRANSPARENCY_TEST',
        JSON.stringify({
          platform: Platform.OS,
          result: 'FAIL',
          error: String(error),
        }),
      );
    } finally {
      setRunning(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#E8EDE9' }}>
      {backdrop === 0 && (
        <Image
          testID="transparency-backdrop"
          source={wallpaper}
          resizeMode="cover"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />
      )}
      <KeyflowAvoidingView
        keyboardFrame={frame}
        keyboardVerticalOffset={Platform.OS === 'ios' ? header : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingVertical: 16,
            paddingLeft: leftInset,
            paddingRight: rightInset,
            gap: 12,
          }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
        >
          <View
            style={{
              padding: 12,
              borderRadius: 20,
              backgroundColor: '#FFFFFFCC',
              gap: 8,
            }}
          >
            <Text style={{ color: '#102D46', fontSize: 26, fontWeight: '700' }}>
              A moment worth keeping.
            </Text>
            <Text style={{ color: '#102D46', lineHeight: 20 }}>
              Adjust the background and keys independently.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap background image"
              onPress={() => setBackdrop(1 - backdrop)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 44,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 12,
                backgroundColor: '#FFFFFFCC',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: '#102D46', fontWeight: '600' }}>
                {backdrop === 0 ? 'Plain' : 'Wallpaper'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Run transparency checks"
              disabled={running}
              onPress={() => void check()}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 44,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 12,
                backgroundColor: '#FFFFFFCC',
                opacity: pressed || running ? 0.6 : 1,
              })}
            >
              <Text style={{ color: '#102D46', fontWeight: '600' }}>
                {running ? 'Checking…' : 'Check'}
              </Text>
            </Pressable>
          </View>

          <OpacitySlider
            label="Background"
            accessibilityLabel="Keyboard background opacity"
            value={backgroundOpacity}
            onChange={(value) => {
              setBackgroundOpacity(value);
              setResult('');
            }}
          />
          <OpacitySlider
            label="Keys"
            accessibilityLabel="Keyboard key opacity"
            value={keyOpacity}
            onChange={(value) => {
              setKeyOpacity(value);
              setResult('');
            }}
          />
          {!!result && (
            <Text
              accessibilityLabel={`Transparency test result: ${result}`}
              style={{
                color: '#102D46',
                backgroundColor: '#FFFFFFDD',
                padding: 8,
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {result}
            </Text>
          )}
        </ScrollView>
        <KeyflowKeyboard
          ref={input}
          keyboardAppearance="light"
          keyboardTheme={createKeyboardTheme(
            {
              keyboard: { backgroundOpacity, keyOpacity },
              font: { weight: 'bold' },
              keyForeground: '#102D46',
              specialKeyForeground: '#102D46',
              actionKeyForeground: '#102D46',
            },
            transparentKeyboardTheme,
          )}
          onKeyboardFrameChange={(next) => {
            latestFrame.current = next;
            setFrame(next);
          }}
          renderInput={(bindings) => (
            <ExampleTextInput
              {...bindings}
              autoFocus
              placeholder="What made today memorable?"
              accessibilityLabel="Transparency comparison input"
              keyboardAppearance="light"
              style={{
                height: 54,
                marginLeft: leftInset,
                marginRight: rightInset,
                marginBottom: 12,
                backgroundColor: '#FFFFFFCC',
                borderRadius: 12,
              }}
            />
          )}
        />
      </KeyflowAvoidingView>
    </View>
  );
}
