import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Keyboard,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKeyflow } from 'react-native-keyflow';
import { studioTheme } from '../themes/studio';

function Preview({ onClose }: { onClose: () => void }) {
  const { keyflowInputProps } = useKeyflow({
    autoFocus: true,
    keyflowTheme: studioTheme,
  });
  return (
    <View style={{ gap: 16 }}>
      <TextInput
        {...keyflowInputProps}
        accessibilityLabel="Teardown preview input"
        style={{ height: 54, padding: 12, borderWidth: 1, borderRadius: 12 }}
      />
      <Button title="Close preview" onPress={onClose} />
    </View>
  );
}

export function TeardownScreen() {
  const [open, setOpen] = useState(false);
  const [unexpectedShows, setUnexpectedShows] = useState(0);
  const closed = useRef(false);
  useEffect(() => {
    const subscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        if (closed.current) setUnexpectedShows((count) => count + 1);
      },
    );
    return () => subscription.remove();
  }, []);
  return (
    <View style={{ flex: 1, padding: 20, gap: 20 }}>
      <Text>
        Close the focused preview to unmount its input and Keyflow hook
        together.
      </Text>
      <Text testID="teardown-status">
        {open ? 'Preview open' : 'Preview closed'} · Unexpected keyboard shows:{' '}
        {unexpectedShows}
      </Text>
      <Button
        title="Open preview"
        onPress={() => {
          closed.current = false;
          setUnexpectedShows(0);
          setOpen(true);
        }}
      />
      {open && (
        <Preview
          onClose={() => {
            closed.current = true;
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}
