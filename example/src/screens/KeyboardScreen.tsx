import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { studioTheme } from '../themes/studio';
import { ComparisonControls } from '../components/ComparisonControls';
import { Submission } from '../components/Submission';
import { observer } from 'mobx-react-lite';
import { settings } from '../stores/settings';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeyflow, KeyflowAvoidingView } from 'react-native-keyflow';

import type { KeyflowKeyboardFrame } from 'react-native-keyflow';
import type { Routes } from '../App';
export const KeyboardScreen = observer(function KeyboardScreenContent({
  route,
  navigation,
}: NativeStackScreenProps<Routes, 'Keyboard'>) {
  const [frame, setFrame] = useState<KeyflowKeyboardFrame | null>(null);
  const { preset } = route.params;
  const multiline = preset === 'multiline';
  const inputHeight = multiline ? 140 : 54;
  const { height: screenHeight } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const inputY = useRef(0);
  const scrollHeight = useRef(0);
  const revealInput = () => {
    if (scrollHeight.current > 0)
      scroll.current?.scrollTo({
        y: Math.max(
          0,
          inputY.current + inputHeight + 16 - scrollHeight.current,
        ),
        animated: false,
      });
  };
  const [mode, setMode] = useState<'custom' | 'system'>('custom');
  const switchRequest = useRef(0);
  const switchMode = async (next: 'custom' | 'system') => {
    const request = ++switchRequest.current;
    setMode(next);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (request === switchRequest.current) input.current?.focus();
  };
  const { dark, haptics, setDark, setHaptics } = settings;

  const headerHeight = useHeaderHeight();
  const [text, setText] = useState(
    multiline
      ? 'A note with several lines.\nTry moving up and down.\nThis longer paragraph wraps naturally as you write more text.'
      : '',
  );
  const [submitted, setSubmitted] = useState<string | null>(null);
  const game = preset === 'studio';
  const { inputRef: input, keyflowInputProps: bindings } = useKeyflow({
    keyboardMode: mode,
    keyboardAppearance: dark ? 'dark' : 'light',
    keyflowTheme: game ? studioTheme : undefined,
    hapticsEnabled: haptics,
    onKeyboardModeChange: setMode,
    onKeyboardFrameChange: (next) => {
      setFrame(next);
      if (Platform.OS === 'android' && next.visible) revealInput();
    },
  });
  const compact =
    Platform.OS === 'android' && screenHeight < 700 && !!frame?.visible;
  useFocusEffect(
    useCallback(
      () => () => {
        switchRequest.current++;
        void input.current?.blur();
      },
      [input],
    ),
  );
  useEffect(
    () =>
      navigation.addListener('transitionEnd', ({ data }) => {
        if (!data.closing) void input.current?.focus();
      }),
    [input, navigation],
  );
  const background = game ? '#132B4B' : '#F7F8FA';
  const foreground = game ? '#FFFFFF' : '#192231';
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      {preset === 'native' && (
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <ComparisonControls
            compact={compact}
            mode={mode}
            dark={dark}
            onDarkChange={setDark}
            onModeChange={(value) => void switchMode(value)}
          />
        </View>
      )}
      <KeyflowAvoidingView
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView
          ref={scroll}
          onLayout={(event) => {
            scrollHeight.current = event.nativeEvent.layout.height;
            if (Platform.OS === 'android' && frame?.visible) revealInput();
          }}
          automaticallyAdjustKeyboardInsets={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          style={{
            flex: 1,
            backgroundColor: background,
          }}
          contentContainerStyle={{
            padding: 24,
            gap: 20,
            paddingBottom: 32,
          }}
        >
          <Text style={{ color: foreground, fontSize: 32, fontWeight: '700' }}>
            {multiline
              ? 'Room for every line.'
              : game
              ? 'Make every word count.'
              : 'Familiar by default.'}
          </Text>
          {game && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {'PLAY'.split('').map((letter) => (
                <View
                  key={letter}
                  style={{
                    backgroundColor: '#F5CA55',
                    padding: 18,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 26,
                      color: '#132B4B',
                      fontWeight: '800',
                    }}
                  >
                    {letter}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={{ color: foreground, lineHeight: 23 }}>
            {multiline
              ? 'Write paragraphs and use Return for a new line. Hold space on iOS, or slide on space on Android, then move left/right or up/down to place the cursor. Compare with your system keyboard.'
              : game
              ? 'An original product skin composed through Keyflow’s public theme API. The editor still supports ordinary text and selection.'
              : Platform.OS === 'ios'
              ? 'Compare the same text in Keyflow and your system keyboard. Try accents, held delete, and holding space to move the cursor.'
              : 'Compare the same text in both keyboards. Try accents, held delete, and system switching.'}
          </Text>
          <View
            onLayout={(event) => {
              inputY.current = event.nativeEvent.layout.y;
            }}
          >
            <ExampleTextInput
              {...bindings}
              multiline={multiline}
              value={text}
              placeholder="Write something…"
              accessibilityLabel="Try Keyflow"
              keyboardAppearance={dark ? 'dark' : 'light'}
              onChangeText={setText}
              onSubmitEditing={(event) => setSubmitted(event.nativeEvent.text)}
              style={{
                height: inputHeight,
                textAlignVertical: multiline ? 'top' : 'center',
                paddingVertical: multiline ? 12 : undefined,
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
              }}
            />
          </View>
          <Text style={{ color: foreground }}>
            Native text: {text || '(empty)'}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: foreground }}>Key haptics</Text>
            <Switch
              accessibilityLabel="Key haptics"
              value={haptics}
              onValueChange={setHaptics}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void switchMode(mode === 'custom' ? 'system' : 'custom');
            }}
            style={({ pressed }) => ({
              paddingVertical: 16,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: foreground, fontWeight: '600' }}>
              {mode === 'custom'
                ? `Compare with ${
                    Platform.OS === 'ios' ? 'Apple' : 'system'
                  } keyboard${
                    Platform.OS === 'ios' ? ` (${dark ? 'dark' : 'light'})` : ''
                  } →`
                : 'Return to Keyflow →'}
            </Text>
          </Pressable>
          {submitted !== null && (
            <Submission key={submitted} text={submitted} color={foreground} />
          )}
        </ScrollView>
      </KeyflowAvoidingView>
    </View>
  );
});
