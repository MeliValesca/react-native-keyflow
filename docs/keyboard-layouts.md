# Keyboard types and landscape

```tsx
<KeyflowTextInput keyboardType="number-pad" />
<KeyflowTextInput keyboardType="decimal-pad" />
<KeyflowTextInput keyboardType="phone-pad" />
```

Omit `keyboardType` (or use `"default"`) for the alphabet layout selected by [language configuration](languages.md). Types select the custom layout and the corresponding native editor input type, including in `keyboardMode="system"`. Changing the prop preserves the existing text and selection; it does not remount or validate the input. Pasted text is not filtered. Validate PINs, prices, and phone numbers in your application.

- iOS uses three-column pads. Phone supports `+*#` and pause/wait punctuation; as on the recorded Apple keyboard, holding `0` still enters `0`.
- Android follows the recorded Gboard four-column pad: digits, dash, space, delete, punctuation, and Done. Phone provides its telephone legends, held `0` for `+`, and a symbol page with pause/wait. Apple returns to digits after a phone symbol; Gboard keeps the symbol page until `123` is pressed.
- Decimal separators come from the current device locale. This selects the separator, not a complete localized digit/alphabet layout.
- Suggestions and QWERTY modifiers are absent from dedicated pads. The QWERTY `123` page remains available separately.
- `keyboardTheme` works across types. Pad defaults resolve before your overrides, including `specialKeys`, `deleteKey`, and fonts.

On phones, rotation selects compact rows and recalculates the occupied keyboard height. iOS respects horizontal safe areas. Android asks its system IME to keep editing inline instead of entering full-screen extract mode. Use `KeyflowAvoidingView` as in the other examples; wire `onKeyboardFrameChange` on Android. Your app must allow landscape orientation. The example's Expo orientation is `default`.

Open **Compare layouts & rotation** in the example. Select QWERTY, Number, Decimal, or Phone, switch Native/Keyflow, then rotate while typing. **Check layout** checks native key bounds and font overflow; it does not change editor contents.

Tablet geometry uses the platform's device-class signal rather than hardcoded device models: iOS checks the `.pad` user-interface idiom and Android checks a smallest width of at least 600dp. Row heights, insets, and the iPad input-assistant band scale from the viewport's short edge. iPad portrait and landscape use separate measured profiles because Apple's landscape keyboard is proportionally taller.

This adaptation does not change the React API. Use the same `KeyflowTextInput`
props and one `keyboardTheme` on phones and tablets in every orientation.
Keyflow owns the device-class check and geometry; applications do not pass a
tablet flag or maintain separate theme objects. Theme values style the active
native layout without changing its measured key frames.

## Device regression tests

Build the example with Stim after native changes. Start at the home screen or the layouts comparison screen, with no existing selection, and run one suite per platform:

```sh
yarn test:visual:layouts ios keyflow
yarn test:visual:layouts android keyflow-android
yarn test:visual:layouts:report
```

Set `AGENT_DEVICE` to the executable path if it is not on `PATH`. Check layout exposes read-only diagnostics in its accessibility label for deterministic device assertions. The suite uses real keys; it never types through a headless IME or approves screenshot baselines. On this iOS simulator, landscape keyboard accessibility rectangles are rotated and clipped: custom touches use measured key frames, and native touches use captured reference coordinates guarded by an exact viewport assertion.

For final screenshot refresh and key-face measurements, run `node scripts/visual/layout-captures.mjs ios keyflow` (or `android keyflow-android`). It checks 15 native/custom pairs per platform, including the three phone-symbol pages, within a 3-point edge tolerance, without aligning or approving baselines. Android also has `node scripts/visual/pad-spaces.mjs keyflow-android emulator-5568`; set `ADB` to your SDK executable. This checks that two quick spaces in each pad do not inherit QWERTY period insertion.

An interrupted functional suite can resume with a final argument such as `landscape-left/number-pad`. `node scripts/visual/merge-layouts.mjs PLATFORM RESULTS_JSON...` combines only completed scenarios from explicitly supplied runs. It fails unless all 24 scenarios are present and the final run passes; the report retains failed-run history and labels aggregate verification separately from an uninterrupted run.

After a custom-only visual change, append `--custom-only` to the capture command to reuse a completed native screenshot set on the unchanged reference device. This refreshes every custom layout and reruns all 15 geometry comparisons; the report links the original native capture run. Use a full capture run after device, OS, IME, theme, or configuration changes.

Run `node scripts/visual/pad-typography.mjs` after iOS captures to compare the rendered bounds of all ten digits and eight alphabet labels in portrait and both landscape directions. The 54 comparisons allow at most 1 point in glyph width/height and 2 points in vertical position. This catches undersized telephone alphabet labels even when the key backgrounds match. Results are linked in the visual gallery after regenerating it.

For changes confined to telephone labels, use `--custom-only --phone-only` to refresh the three phone-pad orientations and symbol pages. Unchanged QWERTY/Number/Decimal captures and their measurements are retained with an explicit source link; the typography test still measures all 54 phone-pad glyph bounds from the refreshed images.

The alphabet-label sizing repair passes all 54 text comparisons. The preceding undersized-label captures failed 24 of these checks. Portrait and landscape now use independently calibrated label sizes and sufficient label height to prevent automatic font reduction; alphabet labels retain the key theme's font family, weight, and color.

Coverage: all four types, portrait and both landscape directions, native/custom typing, deletion, repeat cancellation, decimal entry, phone-zero long press, same-editor type changes, and text/selection preservation during rotation. Custom keys must stay within their panel without overlapping or overflowing labels. Saved screenshot pairs and assertion results are in `artifacts/layouts/index.html`. Failure captures and previous run directories are retained.

The saved functional verification covers 24/24 scenarios on each platform: 163 iOS assertions across five recorded runs and 158 Android assertions across four runs. Both final resumed runs pass. All six Android native/custom pad double-space cases pass. This includes the regression where a toolbar hidden during rotation retained its portrait height when QWERTY became visible again. The standalone example includes the same API and screen; its package install and TypeScript check pass, but its separate native build was not relaunched for this change.

Final image verification passes all 15 comparisons per platform (60 screenshots), with a maximum measured key-face edge difference of 2 logical points. Android's final custom images reuse the explicitly linked native capture set. Glyphs were visually reviewed; the automated geometry checks do not certify identical glyph outlines or animation timing. Library checks pass 71 unit tests and four visual-helper tests, formatting, TypeScript, reference provenance, and package generation.

The visual reference is iPhone 17/iOS 26.5 and the installed Android 16 Gboard on the 411dp emulator. This does not certify iPad split/floating layouts, arbitrary OEM keyboards, user-resized Gboard, all locales, physical-device frame pacing, or system full-screen extract UI. Existing QWERTY transition tests remain separate; rotation tests do not establish identical animation curves across IMEs.

Customization matrices and real pressed-state captures for every layout and orientation are documented in [Customization across layouts](customization-layout-tests.md).

## Android emulator rotation

The example allows landscape (`orientation: default`). Enable **Auto-rotate** in the emulator's Android quick settings when using its rotate controls. The automated `agent-device orientation` command locks Android rotation to force a test orientation; the layout, capture, customization, and pad-space suites now save and restore the original rotation policy in their cleanup, including assertion failures.

For a sensor-driven check with Auto-rotate enabled:

```sh
ADB=/path/to/adb AGENT_DEVICE=/path/to/agent-device node scripts/visual/android-auto-rotation.mjs SESSION EMULATOR_SERIAL
```

This checks real portrait and both landscape screen dimensions with Keyflow and the native IME visible, saves six screenshots, and verifies rotation-policy restoration after success and failure. It restores the starting sensor position and rotation settings afterward.
