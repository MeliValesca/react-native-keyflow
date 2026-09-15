import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { getKeyboardMetrics } from 'react-native-keyflow/testing';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyflowAvoidingView, useKeyflow } from 'react-native-keyflow';

import { ComparisonTabs } from '../components/common/ComparisonTabs';
import { fontChoices, fontDemo as theme } from '../constants/fontDemo';
import { useQuicksand } from '../hooks';

export function CustomFontScreen() {
  const [loaded, fontError] = useQuicksand();
  const [choice, setChoice] =
    useState<(typeof fontChoices)[number]['value']>('semibold');
  const profile = fontChoices.find((font) => font.value === choice)!;
  const scroll = useRef<ScrollView>(null);
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState('');
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { inputRef: input, keyflowInputProps: bindings } = useKeyflow({
    keyboardAppearance: 'light',
    keyflowTheme: { font: { family: profile.family } },
  });
  const horizontal = {
    paddingLeft: Math.max(theme.spacing, insets.left + 12),
    paddingRight: Math.max(theme.spacing, insets.right + 12),
  };
  useFocusEffect(
    useCallback(
      () => () => {
        void input.current?.blur();
      },
      [input],
    ),
  );

  const check = async () => {
    setChecking(true);
    try {
      await input.current?.focus();
      await new Promise<void>((resolve) => setTimeout(resolve, 650));
      const metrics = await getKeyboardMetrics(input);
      if (
        !metrics.focused ||
        metrics.keyCount < 31 ||
        metrics.violations.length
      )
        throw new Error(
          metrics.violations.join(', ') || 'Keyboard is not ready',
        );
      if (
        metrics.editorBottom === undefined ||
        metrics.screenY === undefined ||
        metrics.editorBottom > metrics.screenY + 1
      )
        throw new Error('The keyboard overlaps the input');
      const expected =
        Platform.OS === 'ios' ? profile.nativeName : profile.family;
      if (
        expected &&
        (!metrics.fonts.length ||
          !metrics.fonts.every((name) => name === expected))
      )
        throw new Error(
          `Expected ${expected}; found ${metrics.fonts.join(', ')}`,
        );
      setResult(
        `${
          profile.family ? `Quicksand ${profile.label}` : 'System font'
        } verified. Input stays above the keyboard.`,
      );
      console.info(
        'KEYFLOW_CUSTOM_FONT_TEST',
        JSON.stringify({
          result: 'PASS',
          platform: Platform.OS,
          choice,
          metrics,
          avoidance: 'keyflow',
        }),
      );
    } catch (error) {
      setResult(`Check failed: ${String(error)}`);
      console.info(
        'KEYFLOW_CUSTOM_FONT_TEST',
        JSON.stringify({
          result: 'FAIL',
          platform: Platform.OS,
          choice,
          error: String(error),
        }),
      );
    } finally {
      setChecking(false);
    }
  };

  if (!loaded)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing,
          gap: 12,
        }}
      >
        {!fontError && <ActivityIndicator color={theme.accent} />}
        <Text accessibilityLiveRegion="polite" style={{ color: theme.ink }}>
          {fontError
            ? 'Quicksand could not load. Go back and reopen this example.'
            : 'Loading Quicksand…'}
        </Text>
      </View>
    );

  const content = (
    <>
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => {
          if (result) scroll.current?.scrollToEnd({ animated: true });
        }}
        style={{ flex: 1 }}
        contentContainerStyle={{
          ...horizontal,
          paddingVertical: theme.spacing,
          gap: theme.gap,
        }}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
      >
        <View
          style={{
            backgroundColor: theme.specimen,
            borderRadius: theme.radius,
            padding: theme.spacing,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 12, color: theme.muted, letterSpacing: 1 }}>
            YOUR APP’S FONT
          </Text>
          <Text
            style={{
              fontFamily: profile.family ?? undefined,
              fontSize: 30,
              color: theme.ink,
            }}
          >
            Make it feel like you.
          </Text>
          <Text
            style={{
              fontFamily: profile.family ?? undefined,
              fontSize: 14,
              color: theme.ink,
            }}
          >
            Your app font, right on your keyboard.
          </Text>
        </View>
        <ComparisonTabs
          value={choice}
          options={fontChoices}
          onChange={(value) => {
            setChoice(value);
            setResult('');
            void input.current?.focus();
          }}
        />
        <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
          Type, switch weights, and hold a letter to compare.
        </Text>
        <Text
          accessibilityLabel="Custom font text preview"
          style={{
            color: theme.ink,
            fontFamily: profile.family ?? undefined,
            fontSize: 24,
            minHeight: 34,
          }}
        >
          {text || 'Aa Bb Gg · café · 0123'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check custom font"
          disabled={checking}
          onPress={() => void check()}
          style={({ pressed }) => ({
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            backgroundColor: theme.button,
            opacity: pressed || checking ? 0.6 : 1,
          })}
        >
          <Text style={{ color: theme.ink, fontWeight: '600' }}>
            {checking ? 'Checking…' : 'Check font & layout'}
          </Text>
        </Pressable>
        {!!result && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: theme.accent, fontSize: 13 }}
          >
            {result}
          </Text>
        )}
      </ScrollView>
      <View style={{ ...horizontal, paddingBottom: 12 }}>
        <ExampleTextInput
          {...bindings}
          autoFocus
          placeholder="Try your app’s font…"
          accessibilityLabel="Custom font input"
          keyboardAppearance="light"
          onChangeText={setText}
          onSubmitEditing={() => input.current?.blur()}
          style={{
            height: theme.inputHeight,
            backgroundColor: theme.paper,
            borderRadius: 12,
          }}
        />
      </View>
    </>
  );

  return (
    <View
      style={{
        flex: 1,
        paddingBottom: insets.bottom,
        backgroundColor: theme.background,
      }}
    >
      <KeyflowAvoidingView
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        {content}
      </KeyflowAvoidingView>
    </View>
  );
}
