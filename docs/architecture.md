# Keyflow architecture

Keyflow provides in-app keyboards using Swift/UIKit and Kotlin/Android controllers through an Expo Module. The package uses React Native Builder Bob and Yarn workspaces. The example targets Expo SDK 57, React Native 0.86.3, and React 19.2.3.

## Library boundaries

- `src/useKeyflow.ts` exposes `useKeyflow`, adapts typed options, themes, events, and the native ref, and returns only the bindings required by the app-owned input. React Native retains ownership of the editor and its text/event pipeline.
- `src/KeyflowAvoidingView.tsx` handles keyboard avoidance. Android consumers connect the active input's frame callback; iOS combines UIKit notifications with the custom keyboard’s actual native frame, including attachment to an autofocus input.
- Theme sections, defaults, serialization, language configuration, and overlap geometry live in separate TypeScript modules.
- `src/testing.ts` exposes diagnostics separately from the ordinary input ref. Native metrics remain available to the example and device suites.

The consumer passes a React Native `TextInput` ref to `useKeyflow` and spreads the returned bindings onto that input. Controlled values use React Native’s existing revision handling. The library creates no text editor and applies no input appearance. The example app owns its `ExampleTextInput` styles.

## iOS

`KeyflowInputView` attaches to the consumer’s UITextField or UITextView without replacing its delegate. It owns system/custom switching and input-view integration, observes editing, and restores the previous input surfaces when detached. `KeyflowKeyboardView` owns keyboard state, key activation, touches, repeat deletion, and presentation lifecycle.

`KeyflowKeyRows` constructs the phone/tablet key inventory for each page. `KeyflowKeyboardLayout` positions those existing keys. Neither owns editor state or gesture timing. `KeyflowKey` renders individual keys, while `KeyflowCallout` supplies connected preview geometry. Theme conversion and supported-language resolution have their own modules.

## Android

`KeyflowInputView` attaches to the consumer’s EditText without replacing React Native’s focus, text, or submit listeners. It owns the bottom panel, focus handoff, and keyboard-frame reporting. `KeyflowKeyboardView` composes rows, tracks keyboard state, and wires key actions. `KeyflowGeometry` computes the device geometry.

`KeyflowAccentPopup` owns accent content, selection animation, drag bounds, and popup dismissal. It receives the current theme and reports visibility to the keyboard. `KeyflowKeyView` owns individual-key drawing, touch handling, preview feedback, and held-key timing. Theme conversion, icons, language resolution, and label bounds are separate components.

The cursor navigators anchor a continuous two-dimensional drag target at the initial caret and resolve it through native text hit testing. They retain fractional movement and the unsnapped target across short and wrapped lines.

## Example and tests

The example uses typed native-stack routes, shared appearance settings, reusable controls, and individual test/showcase screens. Transition and customization orchestration live in colocated `useTransitionTests` and `useCustomizationTests` hooks so screen components focus on presentation. Shared assertions and test cases live under `example/src/testing`.

TypeScript helpers have unit tests. Native rendering and interaction tests cover phone/tablet geometry, customization, accents, and editing. XCTest additionally exercises the example screens and compares supported interactions with the system keyboard. CI checks the applicable platform suites; passing those tests does not establish parity with every OS version or third-party keyboard.

## Supported scope

Custom layouts support English/French, QWERTY/AZERTY, phone/tablet portrait and landscape, numeric/symbol pages, number/decimal/phone input types, shift/caps, accents, deletion, cursor movement, and theme customization. Emoji panels, prediction, automatic word replacement, and non-Latin composition engines are not implemented. System mode remains available for the installed keyboard's features.

Split/floating keyboards and arbitrary OEM layouts are not covered by the current API contract. Typography and geometry are tuned against the documented device references; universal pixel-identical parity is not claimed.
