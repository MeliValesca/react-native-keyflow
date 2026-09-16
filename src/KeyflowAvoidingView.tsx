import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { getKeyflowFrame, subscribeToKeyflowFrame } from './keyflowFrameStore';
import { Keyboard, Platform, View, useWindowDimensions } from 'react-native';
import type { KeyboardEvent, ViewProps } from 'react-native';
import { keyboardOverlap } from './keyboardGeometry';
import type { KeyflowKeyboardFrame } from './keyboardGeometry';

export type KeyflowAvoidingViewProps = ViewProps & {
  enabled?: boolean;
  keyboardVerticalOffset?: number;
  /** Optional override for custom layouts; otherwise follows the active Keyflow automatically. */
  keyboardFrame?: KeyflowKeyboardFrame | null;
};

/** Shared keyboard avoidance for iOS and Android, following the active input automatically. */
export function KeyflowAvoidingView({
  keyboardFrame: frameOverride,
  enabled = true,
  keyboardVerticalOffset = 0,
  style,
  children,
  onLayout,
  ...props
}: KeyflowAvoidingViewProps) {
  const activeFrame = useSyncExternalStore(
    subscribeToKeyflowFrame,
    getKeyflowFrame,
    getKeyflowFrame,
  );
  const keyboardFrame =
    frameOverride === undefined ? activeFrame : frameOverride;
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
        ref={container}
        collapsable={false}
        style={[style, { paddingBottom: overlap }]}
        onLayout={(event) => {
          // Keyboard frames use screen coordinates. A nested avoiding view's
          // onLayout position is parent-relative, so measure its window bottom.
          measure();
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
