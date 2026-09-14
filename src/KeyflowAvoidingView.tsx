import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View, useWindowDimensions } from 'react-native';
import type { KeyboardEvent, ViewProps } from 'react-native';
import { keyboardOverlap } from './keyboardGeometry';
import type { KeyflowKeyboardFrame } from './keyboardGeometry';

export type KeyflowAvoidingViewProps = ViewProps & {
  enabled?: boolean;
  keyboardVerticalOffset?: number;
  /** Connect the active KeyflowKeyboard's onKeyboardFrameChange for shared iOS/Android integration. */
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
  const [iosFrame, setIosFrame] = useState<KeyflowKeyboardFrame | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const change = (event: KeyboardEvent) => {
      Keyboard.scheduleLayoutAnimation(event);
      setIosFrame({ ...event.endCoordinates, visible: true, source: 'custom' });
    };
    const hide = (event: KeyboardEvent) => {
      Keyboard.scheduleLayoutAnimation(event);
      setIosFrame(null);
    };
    // Attaching to an already focused RN input can resize its input view without
    // another willShow event. Follow frame changes as well as show/hide.
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', change),
      Keyboard.addListener('keyboardWillChangeFrame', change),
      Keyboard.addListener('keyboardWillHide', hide),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
  const measure = useCallback(() => {
    container.current?.measureInWindow((_x, y, _width, height) => {
      setBottom(y + height);
    });
  }, []);
  const overlap = enabled
    ? keyboardOverlap(
        bottom,
        Platform.OS === 'ios' && keyboardFrame?.source !== 'custom'
          ? iosFrame
          : keyboardFrame,
        keyboardVerticalOffset,
        windowHeight,
      )
    : 0;
  if (Platform.OS === 'ios') {
    return (
      <View
        {...props}
        style={[style, { paddingBottom: overlap }]}
        onLayout={(event) => {
          // Match RN's keyboardVerticalOffset convention: parent-relative layout
          // plus the caller's offset is compared with the screen keyboard frame.
          const { y, height } = event.nativeEvent.layout;
          setBottom(y + height);
          onLayout?.(event);
        }}
      >
        {children}
      </View>
    );
  }
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
