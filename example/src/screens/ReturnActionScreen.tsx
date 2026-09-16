import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { KeyflowAvoidingView, useKeyflow } from 'react-native-keyflow';
import { ExampleTextInput } from '../components/common/ExampleTextInput';
import { labTheme } from '../constants/labTheme';
import { studioTheme } from '../themes/studio';

export function ReturnActionScreen() {
  const [message, setMessage] = useState('Ready to send');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [note, setNote] = useState('First line');
  const [unexpectedNoteSubmits, setUnexpectedNoteSubmits] = useState(0);
  const { keyflowInputProps: sendInputProps } = useKeyflow({
    keyflowTheme: studioTheme,
    returnKeyContent: { icon: 'send' },
  });
  const { keyflowInputProps: newlineInputProps } = useKeyflow({
    keyflowTheme: studioTheme,
    returnKeyContent: { text: 'New line' },
  });
  const lineCount = note.split('\n').length;

  return (
    <KeyflowAvoidingView style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: labTheme.background }}
        contentContainerStyle={{
          padding: labTheme.spacing,
          paddingBottom: 40,
          gap: 16,
        }}
      >
        <View style={{ gap: 6 }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: '800', color: labTheme.ink }}
          >
            One key, two actions
          </Text>
          <Text style={{ color: labTheme.muted, fontSize: 16, lineHeight: 23 }}>
            The Keyflow option changes what Return displays. The TextInput’s
            submitBehavior decides what pressing it does.
          </Text>
        </View>

        <ExampleCard
          title="Submit a message"
          instruction="Press the send icon. The message should appear below without adding a new line."
        >
          <ExampleTextInput
            {...sendInputProps}
            accessibilityLabel="Submit action input"
            multiline
            returnKeyType="send"
            submitBehavior="submit"
            value={message}
            onChangeText={setMessage}
            onSubmitEditing={(event) => {
              setSubmitted(event.nativeEvent.text);
              setSubmitCount((count) => count + 1);
            }}
            style={{
              height: 88,
              paddingVertical: 12,
              textAlignVertical: 'top',
            }}
          />
          <Text
            testID="return-submit-result"
            accessibilityLiveRegion="polite"
            style={{
              color: submitted === null ? labTheme.muted : labTheme.success,
            }}
          >
            {submitted === null
              ? 'Nothing submitted yet.'
              : `Submitted ${submitCount}×: ${submitted}`}
          </Text>
        </ExampleCard>

        <ExampleCard
          title="Insert a new line"
          instruction="Press New line. The caret should move to the next line and no submit event should fire."
        >
          <ExampleTextInput
            {...newlineInputProps}
            accessibilityLabel="Newline action input"
            multiline
            returnKeyType="default"
            submitBehavior="newline"
            value={note}
            onChangeText={setNote}
            onSubmitEditing={() =>
              setUnexpectedNoteSubmits((count) => count + 1)
            }
            style={{
              height: 116,
              paddingVertical: 12,
              textAlignVertical: 'top',
            }}
          />
          <Text
            testID="return-newline-result"
            accessibilityLiveRegion="polite"
            style={{
              color: unexpectedNoteSubmits === 0 ? labTheme.success : '#B42318',
            }}
          >
            {lineCount} {lineCount === 1 ? 'line' : 'lines'} · Submit events:{' '}
            {unexpectedNoteSubmits}
          </Text>
        </ExampleCard>
      </ScrollView>
    </KeyflowAvoidingView>
  );
}

function ExampleCard({
  title,
  instruction,
  children,
}: {
  title: string;
  instruction: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        gap: 12,
        padding: 16,
        backgroundColor: labTheme.surface,
        borderColor: labTheme.border,
        borderWidth: 1,
        borderRadius: labTheme.radius,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: labTheme.ink, fontSize: 19, fontWeight: '700' }}>
          {title}
        </Text>
        <Text style={{ color: labTheme.muted, lineHeight: 20 }}>
          {instruction}
        </Text>
      </View>
      {children}
    </View>
  );
}
