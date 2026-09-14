# Default QWERTY parity and regression tests

The phone reference configurations are **iPhone 17 / iOS 26.5, English, 402 × 874 points**, and **Android 16 with Gboard 15.1.08.726012951-preload-arm64-v8a, English (US), 411 × 914 dp**. The tablet references are a docked iPad keyboard and docked Gboard on an Android 16 Pixel Tablet hardware profile. Android has no single universal native keyboard: these comparisons target Gboard, not every installed IME.

The QWERTY playground passes no `keyboardTheme`, so it exercises the library defaults. The iOS default retains the native typing position and bottom clearance while omitting emoji and dictation controls. Android omits its emoji key and expands the space key into the released space. Both use native safe-area/navigation insets.

## Independent checks

| Feature                                                                | Executable coverage                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Key positions, face sizes, letter bounds, palette                      | `compare-qwerty-defaults.mjs`, using fresh native/custom captures without translation or scaling |
| Initial capitalization, one-shot shift, caps lock and release          | `compare-native-interactions.mjs`, real taps against both keyboards                              |
| Double-space period and sentence capitalization                        | Same comparison script, isolated editor resets                                                   |
| Number page and automatic letter return                                | Same comparison script                                                                           |
| Unicode/grapheme deletion, held delete and release cancellation        | Same comparison script                                                                           |
| Native/custom switching, editor text and selection preservation        | Interaction screen; the script requires its actual PASS result                                   |
| iOS complete alphabet, all recorded accent alternatives and popup fit  | `scripts/ios-tests/KeyflowQwertyTests.swift`                                                     |
| iOS continuous shift-drag, number-drag, accent-drag and space trackpad | Same XCTest suite; compares real Apple and Keyflow input                                         |
| Android secondary symbols, space dragging and return                   | `test-android-pages-and-cursor.mjs`                                                              |
| Android accent drag through both popup rows                            | `test-android-accent-drag.mjs`                                                                   |
| Android key-down enlargement, position, cleanup and single insertion   | `test-android-key-preview.mjs`                                                                   |
| Opening, dismissal, avoidance and layout restoration                   | Transition screen, with a plain native TextInput baseline                                        |
| Interrupted opening/dismissal                                          | Transition screen: 40, 120 and 220 ms interruptions in both directions                           |
| Invalid frames, wrong visibility and motion reversals                  | Transition screen, plus unit tests for the assertion helper                                      |

The visual checker permits **1 px face-bound error, 2 px ink-bound error, and 3 color-channel levels**. This is a geometric comparison, not a claim that every glyph contour or every rendered pixel is identical. Suggestions/toolbar content and removed controls are explicit exclusions. Android's widened space key is also excluded from equal-width comparison.

## Run on the example devices

Build and launch from `example/` with `stim ios` and `stim android`. Use the device IDs reported by Stim.

The iOS continuous-gesture tests use XCTest directly: the host automation tool clips some gestures to the app's resized viewport and can incorrectly reject touches in the keyboard area. The standalone test runner targets the already-installed example and stores screenshots/results in `.xcresult` bundles.

```sh
# From the library root, after stim ios:
yarn test:device:ios <simulator-udid>
```

For the shared tap comparisons, open **Compare native interactions** in the example and connect the corresponding agent-device session:

```sh
AGENT_DEVICE=/path/to/agent-device node scripts/compare-native-interactions.mjs ios keyflow
AGENT_DEVICE=/path/to/agent-device yarn test:device:android keyflow-android
AGENT_DEVICE=/path/to/agent-device node scripts/test-android-pages-and-cursor.mjs android keyflow-android
ADB=/path/to/adb AGENT_DEVICE=/path/to/agent-device node scripts/test-android-accent-drag.mjs keyflow-android emulator-5568
ADB=/path/to/adb AGENT_DEVICE=/path/to/agent-device node scripts/test-android-key-preview.mjs keyflow-android emulator-5568
```

Before Android comparisons:

```sh
ADB=/path/to/adb node scripts/prepare-android-reference.mjs emulator-5568
```

This emulator-only setup selects installed Gboard, enables the software keyboard with hardware input, and disables stylus handwriting. It reports previous settings. Text-injection tools can select a headless helper IME; merely enabling the software-keyboard setting does not restore Gboard. Tests use actual key touches rather than injecting text through that helper.

Capture the same empty QWERTY state in both modes, then compare:

```sh
yarn test:visual:qwerty ios native.png custom.png report.json
yarn test:visual:qwerty android native.png custom.png report.json
```

Open **Test keyboard transitions → Run transition tests** for presentation checks. Results are visible in the example and available from `example/`:

```sh
stim logs --source metro --grep KEYFLOW_TRANSITION_TEST --since 5m
```

The default iOS keyboard uses input-view hosting so both opening and dismissal use UIKit's native timing. The test requires one notification per presentation/dismissal and compares both duration and easing to the actual native baseline. Android additionally validates native window visibility, intermediate frames and monotonic motion. Settled composer clearance and restoration are measured independently of the keyboard's claimed bounds.

## Remaining differences and limits

- Apple's and Gboard's private prediction, autocorrection and glide-typing engines are not available to this custom keyboard. Keyflow therefore does not display a suggestion bar. Gboard's GIF, sticker and keyboard-settings toolbar is not reproduced.
- Public system fonts and symbols are calibrated against the references; private keyboard fonts are not redistributed. Matching ink bounds does not prove identical font outlines.
- Transparent themes retain accessory hosting because UIKit adds an unwanted backdrop behind full input views. Their dismissal notification can have zero duration on the reference iOS version. The default's native-timing result does **not** establish identical transparent dismissal. The transition test exposes this difference rather than silently accepting it.
- Animation tests check notifications, reported motion, interruption and layout. They do not establish identical physical display frame pacing. Real devices, other OS/IME versions, landscape, floating/split keyboards, predictive Android Back and interactive iOS scroll dismissal need separate coverage.
- Emoji and dictation are intentionally absent. The editor still accepts pasted Unicode text and deletes composed characters correctly.

## Device and layout profiles

There is not one tablet design shared by every device. Keyflow selects its broad phone/tablet geometry from native device traits, then scales the active profile from the current viewport and safe-area or navigation inset. iOS uses the iPad interface idiom. Android uses the platform's 600 dp smallest-width tablet threshold. It does not match model names or keep a list of hardcoded screen dimensions.

| Platform | Covered profile                                                                | Separate profiles outside this claim                                                                                   |
| -------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| iOS      | Current docked, full-width iPhone and iPad keyboards in portrait and landscape | Floating iPad keyboard, split keyboard, hardware-keyboard shortcut bar, older iOS keyboard revisions                   |
| Android  | Current docked Gboard phone and Pixel Tablet layouts in portrait and landscape | Samsung Keyboard, SwiftKey and other IMEs; floating, split, one-handed, or user-resized Gboard; older Gboard revisions |

The Android tablet runner must use a real tablet AVD hardware profile. Changing a phone emulator's resolution can leave Gboard in its phone or floating policy and is rejected by the tablet capture test. Unsupported native controls retain their layout space where that is needed for alignment, but no inert icon is drawn. The current Android tablet alphabet layout includes functional Tab, Caps Lock, Shift, Delete, Return, page switching, and space controls.

## Recorded validation — September 9, 2026

- **Seven iOS XCTest cases** passed, including the complete alphabet, 20 captured accent rows, continuous modifiers, accent selection, trackpad movement and return.
- **30 native/custom typing comparisons per platform** passed, plus six verified mode handoffs per platform.
- Android's independent symbol/cursor/return checks, four accent-drag comparisons, and native/custom key-preview checks passed.
- All **eight QWERTY visual comparisons** passed: light/dark × uppercase/lowercase × iOS/Android. Reports and screenshots are in `artifacts/qwerty-defaults/`.
- The default transition suites cover six show/hide cycles, four mode switches and six interruptions per platform. iOS opening and dismissal both match the reference's 383.3 ms keyboard easing. Physical frame pacing and transparent dismissal remain outside that parity claim.
- The standalone example was repackaged and built on its own Android emulator. Main and standalone runtime-error checks passed.

To repeat the full visual capture on the default playground (start with the light appearance and empty editor):

```sh
AGENT_DEVICE=/path/to/agent-device node scripts/capture-qwerty-defaults.mjs ios keyflow
ADB=/path/to/adb AGENT_DEVICE=/path/to/agent-device node scripts/capture-qwerty-defaults.mjs android keyflow-android emulator-5568
```

Android capture temporarily changes the emulator's night mode and restores it. Both scripts restore the example's light appearance. The iOS XCTest project generator requires Xcode and the `xcodeproj` Ruby gem available with this project's CocoaPods tooling.

### Accent foreground regression

The default iOS long-press menu previously applied the selected white foreground
to unselected letters on the white preview surface. Unselected alternatives now
use `preview.color`; the highlighted alternative retains `selection.color` and
its pressed-color override. The E-menu pixel test checks visible foreground
strokes in every cell, including the selection, in light and dark appearances.
The saved pre-fix capture fails this check.

Open the default Keyboard playground with Keyflow selected and light appearance,
then run against the reference device (set `AGENT_DEVICE` and `ADB` if needed):

```sh
yarn test:visual:accents ios keyflow 30AB82B2-209E-49AE-8673-F722465C7752
yarn test:visual:accents android keyflow-android emulator-5568
```

Captures and reports are saved in `artifacts/pressed-contrast`. This test covers
the E accent menu's contrast, not complete keyboard visual parity.
