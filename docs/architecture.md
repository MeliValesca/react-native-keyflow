# Keyflow architecture

Keyflow provides in-app keyboards using Swift/UIKit and Kotlin/Android views through an Expo Modules view bridge. The package uses React Native Builder Bob and Yarn workspaces. The example targets Expo SDK 57, React Native 0.86.3, and React 19.2.3.

## Library boundaries

- `src/KeyflowTextInput.tsx` adapts typed props, themes, events, and the native ref. Native code owns editing; React observes text changes.
- `src/KeyflowAvoidingView.tsx` handles keyboard avoidance. Android consumers connect the active input's frame callback; iOS uses UIKit keyboard notifications through React Native's avoiding view.
- Theme sections, defaults, serialization, language configuration, and overlap geometry live in separate TypeScript modules.
- `src/testing.ts` exposes diagnostics separately from the ordinary input ref. Native metrics remain available to the example and device suites.

The input currently uses native-owned text through `defaultValue`. A controlled-value protocol would require revision ordering to avoid stale JavaScript updates overwriting native edits; it is not advertised as supported.

## iOS

`KeyflowInputView` owns the UITextField, native editing, system/custom switching, and input-view integration. `KeyflowKeyboardView` owns keyboard state, key activation, touches, repeat deletion, and presentation lifecycle.

`KeyflowKeyRows` constructs the phone/tablet key inventory for each page. `KeyflowKeyboardLayout` positions those existing keys. Neither owns editor state or gesture timing. `KeyflowKey` renders individual keys, while `KeyflowCallout` supplies connected preview geometry. Theme conversion and supported-language resolution have their own modules.

## Android

`KeyflowInputView` owns the EditText, bottom panel, native editing, focus handoff, and keyboard-frame reporting. `KeyflowKeyboardView` composes rows, tracks keyboard state, and wires key actions. `KeyflowGeometry` computes the device geometry.

`KeyflowAccentPopup` owns accent content, selection animation, drag bounds, and popup dismissal. It receives the current theme and reports visibility to the keyboard. `KeyflowKeyView` owns individual-key drawing, touch handling, preview feedback, and held-key timing. Theme conversion, icons, language resolution, and label bounds are separate components.

## Example and tests

The example uses typed native-stack routes, shared appearance settings, reusable controls, and individual test/showcase screens. Transition and customization orchestration live in colocated `useTransitionTests` and `useCustomizationTests` hooks so screen components focus on presentation. Shared assertions and test cases live under `example/src/testing`.

TypeScript helpers have unit tests. Native rendering and interaction tests cover phone/tablet geometry, customization, accents, and editing. XCTest additionally exercises the example screens and compares supported interactions with the system keyboard. CI checks the applicable platform suites; passing those tests does not establish parity with every OS version or third-party keyboard.

## Supported scope

Custom layouts support English/French, QWERTY/AZERTY, phone/tablet portrait and landscape, numeric/symbol pages, number/decimal/phone input types, shift/caps, accents, deletion, cursor movement, and theme customization. Emoji panels, prediction, automatic word replacement, and non-Latin composition engines are not implemented. System mode remains available for the installed keyboard's features.

Split/floating keyboards, arbitrary OEM layouts, and controlled/multiline editing are not covered by the current API contract. Typography and geometry are tuned against the documented device references; universal pixel-identical parity is not claimed.
