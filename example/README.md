# Keyflow showcase

Stack: Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3. Requires a native development build (not Expo Go); iOS 16.4+ or Android API 24+.

Install the official [`stim`](https://stim.appandflow.com/docs/getting-started) package globally (`npm install --global stim`); do not use the legacy `stim-cli` package. In the library workspace, install dependencies from the root. In the exported standalone repo, install here:

```sh
corepack yarn install
stim start
stim ios
# or
stim android
```

A native development build is required; Expo Go cannot load Keyflow. Android custom panels report keyboard frames through `onKeyboardFrameChange`; the demo uses this to keep scrolling content reachable. First Back dismisses the Android keyboard, then Back navigates away.

After adding the reference module/dependencies to an existing generated iOS project, run `pod install` in `ios` before `stim ios`. A fresh standalone example discovers its local reference module during prebuild.

From the library root, `yarn example:export` creates `artifacts/keyflow-example-repo`, an independent Git repository containing this app and a packed local Keyflow dependency. It can be moved to another folder without the parent workspace. No remote is created or published.

The platform demo includes Keyflow/Apple (or Android system) comparison buttons and a shared dark appearance toggle. On iOS, this shows Apple's actual dark keyboard in the same editor, preserving text when switching.

**Test keyboard transitions → Run transition tests** runs a device regression test against a real TextInput baseline, Keyflow custom mode, and Keyflow system mode. It measures editor overlap and layout restoration across repeated show/hide, switching, and interrupted transitions. Results appear on-screen and in `stim logs --grep KEYFLOW_TRANSITION_TEST --since 5m`.

**Customize fonts & test layouts** loads the bundled JetBrains Mono font and checks 58 font, section, material and opacity themes against measured native key geometry. Its font file is distributed under the included `assets/fonts/OFL.txt`.

**Make room for your style** shows translucent, bordered keycaps over a coastal photograph or plain background. Separate **Background** and **Keys** sliders adjust each independently from 0% to 100%, starting at 35% and 70%. Try background 0% / keys 100% for solid keys over the photograph, or background 100% / keys 50% for translucent keys over a solid panel. Space-bar and popup surfaces follow key opacity; text and icon colors stay unchanged. The same API and controls work on iOS and Android. **Check** verifies native key geometry and that the keyboard does not overlap the editor.

**Your app. Your type.** loads Quicksand Regular, Semibold, and Bold from the example's own font files with `expo-font`. Switch weights or compare with the System font; the specimen, typed-text preview, keyboard, and accent popups use the selected face. **Check font & layout** checks the native font configuration and editor clearance. iOS also verifies the resolved UIFont face. Both platforms use `KeyflowAvoidingView`, with the active input's `onKeyboardFrameChange` connected to `keyboardFrame`. See `src/hooks/useQuicksand.ts` for font loading and `src/screens/CustomFontScreen.tsx` for integration. Fonts are covered by `assets/fonts/quicksand/OFL.txt` and remain outside the library package.

If an Android emulator has a hardware keyboard enabled, run the library’s `scripts/prepare-android-reference.mjs <emulator-serial>` with `ADB` set to its SDK binary. It enables the software keyboard for hardware input and disables stylus handwriting on that test emulator only. Gboard should be docked for the visual comparison.

**Compare layouts & rotation** keeps one editor while switching QWERTY, number,
decimal, and phone layouts. Compare Keyflow with the installed keyboard, rotate
while focused, and use **Check layout** for bounds/label checks. The example
allows both landscape directions. `keyboardType` selects the layout without
filtering pasted text.

The **Customize fonts & test layouts** screen now offers all four layouts and compact landscape controls. **Run 58** checks the selected layout against font, material, section-style, and opacity boundaries; **Themes** previews flat and raised styles over a photograph.

The **English & French keyboards** screen demonstrates the custom globe switcher, French AZERTY/QWERTY selection, device-language discovery, and comparison with the actual system keyboard. The custom keyboard supports English and French only; system mode retains all installed languages.

## Example categories

- **Behavior:** native interaction comparisons (typing, shift, accents, cursor and delete) and keyboard transitions / avoiding views.
- **Layouts:** number, decimal and phone pads, both landscape orientations, and the English/French QWERTY/AZERTY globe switch.
- **Appearance:** font, color, opacity and layout-boundary checks.

Custom suggestions and dictionary replacements are removed. Android's paste/dismiss controls use the `toolbar` theme section. The actual system keyboard retains its own settings.
