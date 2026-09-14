# Keyboard avoidance and transition regression test

Open **Test keyboard transitions → Run transition tests** in the example. Use the Material button to repeat with flat and raised keys. Run this in a native development build on both platforms. It is an executable device test, not a screenshot mock.

The result is visible in the app and logged with `KEYFLOW_TRANSITION_TEST`. Retrieve it from the example directory:

```sh
stim logs --grep KEYFLOW_TRANSITION_TEST --since 5m
```

This checks layout and animation delivery. It does not assert pixel-identical timing curves, guarantee every animation frame meets the display deadline, or replace physical-device/interactive-gesture QA. iOS keyboard frame counts reflect did-show events, not UIKit's per-frame rendering.

## Library integration

```tsx
const [frame, setFrame] = useState<KeyflowKeyboardFrame | null>(null);

<KeyflowAvoidingView
  style={{ flex: 1 }}
  keyboardFrame={frame}
  keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    <KeyflowTextInput onKeyboardFrameChange={setFrame} />
  </ScrollView>
</KeyflowAvoidingView>;
```

Import the component and frame type from `react-native-keyflow`. Wire the active input's frame to its surrounding avoiding view. Avoid applying a second keyboard-height spacer or `automaticallyAdjustKeyboardInsets` to the same content. Scrolling the focused field into view is still the screen's responsibility; the showcase demonstrates this.

Here, **frame** means the area occupied by the keyboard. For example, `{ visible: true, screenY: 600, height: 290, source: 'custom' }` says the visible keyboard starts 600 logical pixels from the top of the screen and is 290 high. This is data, not a UI component. `onKeyboardFrameChange` reports changes as it opens, moves, resizes, and closes. You may consume these events in your own layout; the Keyflow wrapper provides the overlap calculation for you.

The **Your app. Your type.** Quicksand example uses `KeyflowAvoidingView` on both iOS and Android. Its device check verifies input clearance after reopening on both platforms. This is the shared avoidance integration; a plain React Native `KeyboardAvoidingView` does not support the Android custom panel by itself.

The iOS test also requires exactly one `keyboardWillShow` / `keyboardWillHide` notification per opening / dismissal and checks their duration and easing against the real TextInput baseline. This detects repeated presentation requests; it does not measure physical display frame pacing.

The example focuses after the native navigation transition ends. Library autofocus coalesces initial props and waits for an active view-controller transition. Avoid adding separate keyboard-position animations or scroll jumps in height callbacks.

Internally, `KeyflowAvoidingView` delegates to React Native's KeyboardAvoidingView on iOS. UIKit owns Keyflow's inputView presentation and keyboard notifications. Use the usual navigation-header offset. `behavior` and `contentContainerStyle` follow the underlying React Native component on iOS.

On Android, the component always uses padding calculated from its measured screen position and `keyboardFrame`. It accounts for existing window resizing and safe areas without subtracting a guessed keyboard height. `keyboardVerticalOffset` is additional clearance here, normally zero; do not pass a navigation-header height when screen coordinates already include it. Frame events cover both Keyflow's panel and the real system IME. The library does not emit synthetic global React Native keyboard events or alter the activity's soft-input mode. A plain KeyboardAvoidingView cannot detect the Android custom panel by itself.

The Android custom panel uses a native 285ms animation using the measured Android 16 IME interpolator, respects disabled system animations, and can reverse an in-flight show/hide. System frame updates come from WindowInsetsAnimationCompat. Final-layout inset callbacks are suppressed while an IME animation is running to avoid applying the destination frame prematurely. `onKeyboardHeightChange` remains the legacy custom-panel height notification; use `onKeyboardFrameChange` for avoidance and motion.

## Remaining device coverage

Current tests target portrait iPhone and Android emulator layouts. Physical-device frame pacing, interactive iOS dismissal, predictive Android Back gestures, split/floating keyboards, hardware keyboards, landscape, and multiple simultaneous editors need additional tests. Stock React Native keyboard events are used for the plain Android TextInput baseline; only the Keyflow-owned editor exposes per-frame Android IME updates through this API.

Android handoffs retain the previous occupied space while the system IME takes over. The device test rejects a transient hidden frame during a visible-to-visible handoff. A bounded fallback releases retained space if the IME fails to appear. Dismiss Keyflow explicitly through the input ref's `blur()`; Android's app-owned editor is not registered with React Native's global TextInputState.

The expanded default-theme suite checks six show/hide cycles, four visible mode switches, and six real interruptions at 40, 120 and 220 ms. It rejects backwards motion, invalid frames, stale visibility and layout-restoration errors. Transparent iOS dismissal has a known hosting difference; see the [current parity report](native-parity.md) for scope and reproducible commands.
