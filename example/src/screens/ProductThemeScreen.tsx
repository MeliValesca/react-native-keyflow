import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { useCallback, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyflowAvoidingView, KeyflowKeyboard } from 'react-native-keyflow';
import type {
  KeyflowKeyboardFrame,
  KeyflowKeyboardRef,
} from 'react-native-keyflow';
import { studioTheme } from '../themes/studio';

export function ProductThemeScreen() {
  const input = useRef<KeyflowKeyboardRef>(null);
  const [frame, setFrame] = useState<KeyflowKeyboardFrame | null>(null);
  const [text, setText] = useState('');
  const header = useHeaderHeight();
  useFocusEffect(useCallback(() => () => void input.current?.blur(), []));
  return (
    <View style={{ flex: 1, backgroundColor: '#F4F0FF' }}>
      <KeyflowAvoidingView
        style={{ flex: 1 }}
        keyboardFrame={frame}
        keyboardVerticalOffset={Platform.OS === 'ios' ? header : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 18 }}
        >
          <Text
            style={{
              color: '#342B62',
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
            }}
          >
            ORIGINAL PRODUCT THEME
          </Text>
          <Text
            style={{
              color: '#241D46',
              fontSize: 32,
              lineHeight: 38,
              fontWeight: '800',
            }}
          >
            Write the next scene.
          </Text>
          <Text style={{ color: '#554F73', fontSize: 15, lineHeight: 22 }}>
            A complete app screen using only Keyflow’s public theme API. The
            plum, rose and aqua palette is example-owned and works on iOS and
            Android.
          </Text>
          <View
            style={{
              padding: 18,
              borderRadius: 20,
              backgroundColor: '#FFFFFFA8',
              gap: 8,
            }}
          >
            <Text style={{ color: '#342B62', fontWeight: '700' }}>
              Live note
            </Text>
            <Text style={{ color: '#554F73', minHeight: 44, lineHeight: 21 }}>
              {text || 'Start typing below to compose your note.'}
            </Text>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <KeyflowKeyboard
            ref={input}
            keyboardAppearance="light"
            keyboardTheme={studioTheme}
            onKeyboardFrameChange={setFrame}
            renderInput={(bindings) => (
              <ExampleTextInput
                {...bindings}
                autoFocus
                placeholder="Continue the story…"
                accessibilityLabel="Product theme input"
                keyboardAppearance="light"
                onChangeText={setText}
                style={{
                  height: 54,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                }}
              />
            )}
          />
        </View>
      </KeyflowAvoidingView>
    </View>
  );
}
