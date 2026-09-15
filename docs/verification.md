# Verification — September 8, 2026

For the current interaction, switching, and transparency work, see the [native comparison report](native-parity.md). The results below describe earlier builds and are retained as historical evidence.

The latest [Android Gboard calibration](android-visual-verification.md) records the reference version, phone viewports, geometry comparator, interaction runner, and remaining platform differences. It supersedes the earlier Android visual estimates below.

## Environment and automated checks

Expo 55.0.31, React Native 0.83.0, React 19.2.0, Xcode 26.6. Native builds and launches through Stim passed on the owned iPhone 17 / iOS 26.5 simulator and Android API 36 emulator. Metro runs on port 8083.

## iOS interaction checks

Repeated manual automation against the running native app verified:

- Actual Apple and Keyflow dark keyboards can be selected on the same editor. Switching preserves text. The shared appearance control explicitly sets Apple's keyboard appearance.
- Dark panel and key colors match sampled reference colors (`#404143`, `#5E5F61`). Letter width, key geometry, suggestion dividers, and dock corners were refined from screenshots. Some glyph contours and icons still differ.
- Letters, numeric/symbol pages, shift, double-tap caps lock (`HH`), return submission/dismissal, dictionary completions, and held delete work.
- Holding E and dragging to an accented choice inserts `È`.
- Typing `teh` then space corrects to `the `; Delete restores `teh`.
- Double-space after `Hi` produces `Hi. ` and sentence capitalization.
- Holding space and dragging left moves the caret: inserting X into `abc` then produces `Xabc`.
- Deleting from `A👨‍👩‍👧‍👦é` produces `A👨‍👩‍👧‍👦`, then `A`, without splitting composed characters.
- Holding Delete for 1.8 seconds clears `repeated delete`; release stops repetition.

## Android interaction checks

Android search, tone choices, correction undo, and repeated-delete edge cases still need the same depth of device QA as iOS. Spell-check behavior depends on the enabled service; a correction result was not observed in this run.

`stim logs --errors` reports no matching application errors after the final builds. Android device startup logs include Expo dev-client optional splash-screen lookup and React Native dev-loading/focus soft exceptions; the application remains running.

## Remaining differences and unverified cases

The original comparison below targets portrait phone geometry. Dedicated pads and phone landscape have a separate [layout comparison suite](keyboard-layouts.md). Physical haptics, spoken VoiceOver/TalkBack traversal, hardware keyboards, iPad, OEM devices, multiple input fields, and longer stress tests remain unverified. That original comparison used single-line uncontrolled editing; multiline cursor movement now has native regression coverage. System keyboard mode remains available for advanced input.

## Android comparison repair

The platform comparison controls now stay above the scrolling editor. Switching to system mode refreshes the existing Android input connection and waits for window focus before requesting the IME, following Android's [keyboard visibility guidance](https://developer.android.com/develop/ui/views/touch-and-input/keyboard-input/visibility). The dark switch is explicitly labeled as Keyflow-only on Android because the installed IME owns its theme.

Final repair validation on the Stim-owned `emulator-5560`: the native build launched `com.keyflow.example`, and `stim logs --errors` passed. Direct device taps switched repeatedly between Keyflow and actual Gboard. Gboard insertion produced `Wq`, which remained intact after returning to Keyflow. Both mode controls and the editor remained visible. System mode reserves scroll space while the IME transition runs, preventing the previous offset reset. The final screenshots are `gboard-reference.png` and `keyflow-native-android.png`.

## Transition and avoidance regression suite

The example now contains **Test keyboard transitions**. Both iOS 26.5 and Android API 36 passed six show/hide cycles against a real TextInput baseline, four mode switches, and an interrupted focus–blur–focus transition. Every settled composer measurement had an 8-point keyboard gap and zero restoration drift. Android custom opening delivered 10–13 distinct frames in the recorded run; the system IME delivered 16. These are frame-delivery counts, not display-frame timing guarantees. The library/example TypeScript, packaging, formatting, and 27 unit tests pass.

See [keyboard avoidance and test details](keyboard-transitions.md). The Android recording and platform result screenshots are saved under `artifacts/`. iOS uses React Native KeyboardAvoidingView and UIKit keyboard notifications. Android uses native animation/frame reporting and the library's measured-frame avoiding view. The previous 300-pixel example spacer is removed.

The final iOS device suite passed again, including six cycles, four switches, and interruption recovery (19:32 local time). Final library/example TypeScript, formatting, 27 unit tests, and packaging passed. Earlier Android runs passed the same settled-layout suite; subsequent stronger repetition/continuity checks exposed issues in cold startup, focus transfer, and animation scheduling, which were addressed.

**At that point, Android runtime changes were not fully verified.** The Android 16 emulator repeatedly stalled during installs and frame queries. An independent Android 15 standalone-example build completed successfully, but its installation failed when ADB lost the emulator; it remained offline after restarting ADB. The last successful Android screenshots/recording precede the final scheduling changes. Do not interpret those artifacts or the earlier pass as a final Android motion-parity certification. Rerun the device suite on a healthy emulator or device before release.

Both final native builds launched successfully: iPhone 17 / iOS 26.5 (`30AB82B2-209E-49AE-8673-F722465C7752`) and the recovered Stim Android emulator (`emulator-5568`). Each platform passed 72 theme combinations against measured native geometry: all materials, minimum/maximum size and radius, maximum depth, four system designs, a bundled font, and a missing-font fallback. No measured overlap, label overflow, or keyboard size change occurred. iOS also verified the bundled font resolved to JetBrains Mono. Android was tested at 320 logical pixels wide; iOS at 402.

Formatting, library/example TypeScript, 36 unit tests (including 180 valid boundary combinations), and package builds pass. Android startup still logs Expo dev-client splash lookup and React Native soft exceptions; the app stays alive and both regression runners complete. These logs are not a clean runtime-error pass.
