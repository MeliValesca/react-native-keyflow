import { TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import type { Ref } from 'react';

/** The example app owns its input appearance; Keyflow only supplies the keyboard. */
export function ExampleTextInput({
  style,
  ...props
}: TextInputProps & { ref?: Ref<TextInput> }) {
  return (
    <TextInput
      testID="keyflow-input"
      placeholderTextColor="#737373"
      {...props}
      style={[
        {
          height: 48,
          fontSize: 18,
          color: '#192231',
          backgroundColor: '#FFFFFF',
          borderColor: '#D1D5DB',
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 12,
        },
        style,
      ]}
    />
  );
}
