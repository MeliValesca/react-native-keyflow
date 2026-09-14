import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ViewProps } from 'react-native';
import { keyboardOverlap } from './keyboardGeometry';
import type { KeyflowKeyboardFrame } from './keyboardGeometry';

export type KeyflowAvoidingViewProps = ViewProps & {
  enabled?: boolean;
  keyboardVerticalOffset?: number;
  /** Connect the active KeyflowTextInput's onKeyboardFrameChange for shared iOS/Android integration. */
  keyboardFrame?: KeyflowKeyboardFrame | null;
};

/** Shared keyboard avoidance for iOS and Android. Wire the active input's frame callback. */
export function KeyflowAvoidingView({
  keyboardFrame = null,
  enabled = true,
  keyboardVerticalOffset = 0,
  style,
  children,
  onLayout,
  ...props
}: KeyflowAvoidingViewProps) {
  const { height: windowHeight } = useWindowDimensions();
  const container = useRef<View>(null);
  const [bottom, setBottom] = useState(0);
  const measure = useCallback(() => {
    container.current?.measureInWindow((_x, y, _width, height) => {
      setBottom(y + height);
    });
  }, []);
  if (Platform.OS !== 'android') {
    return (
      <KeyboardAvoidingView
        {...props}
        behavior="padding"
        {...{ enabled, keyboardVerticalOffset, style, onLayout }}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }
  const overlap = enabled
    ? keyboardOverlap(
        bottom,
        keyboardFrame,
        keyboardVerticalOffset,
        windowHeight,
      )
    : 0;
  return (
    <View
      {...props}
      ref={container}
      collapsable={false}
      style={style}
      onLayout={(event) => {
        measure();
        onLayout?.(event);
      }}
    >
      <View style={{ flex: 1, paddingBottom: overlap }}>{children}</View>
    </View>
  );
}
