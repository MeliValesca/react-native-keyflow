# English and French

Keyflow's custom keyboard supports English and French, with QWERTY and AZERTY templates. Non-Latin keyboards and their composition engines are outside the custom keyboard's scope. This does not restrict pasted text or the real system keyboard.

```tsx
<KeyflowTextInput
  keyboardLanguages={[{ language: 'en' }, { language: 'fr', layout: 'azerty' }]}
  onKeyboardLanguageChange={({ language, layout }) => {
    // Optional: update your app's language indicator.
  }}
/>
```

The globe key cycles the configured languages. It appears only when both languages are available and is styled through `specialKeys`, including its icon and pressed state. Switching preserves text, selection, and focus, resets temporary modifier state. It does not reopen the keyboard. The selection is retained for the lifetime of the input; it is not stored as a device keyboard preference. Number/phone pads do not show a language switcher.

Set French's layout to `qwerty` for a French QWERTY template. Explicit configuration accepts each language once; empty lists, unsupported languages, and unsupported layouts are rejected. The example provides both layouts under **English & French keyboards**.

When `keyboardLanguages` is omitted, Keyflow reads supported active keyboard languages on iOS and enabled keyboard subtypes on Android. If a platform supplies no language metadata, it uses device language preferences. It filters to English/French and preserves the reported order. If neither is supported, the custom keyboard falls back to English QWERTY. iOS refreshes preferences when returning to the app; Android refreshes them when the custom keyboard is shown or refocused. A selected language remains selected while it is still available.

These APIs do not reliably expose the user's exact software layout variant. Keyflow uses a documented template: English and Canadian French use QWERTY; other French locales use AZERTY. Use explicit configuration when the template does not match your app's needs. Android keyboards may manage languages internally without exposing all of them as subtypes, so automatic discovery cannot guarantee their full language list.

Custom word suggestions and automatic word replacements are disabled. Keyflow does not query `UITextChecker` or open an Android spell-checker session. The iOS suggestion strip is removed; Android retains its paste/system/dismiss toolbar. `autoCorrect` only configures system-keyboard behavior and cannot enable custom word replacement. Language switching still changes letter layout and accent entry remains available.

`keyboardMode="system"` ignores Keyflow's language configuration. The actual iOS or installed Android keyboard owns its languages, switching, layout, and composition, including non-Latin languages. Keyflow's globe is a two-language custom control; it does not reproduce the system keyboard's entire language menu or multilingual prediction.

Active keyboard metadata stays on-device. The iOS library bundles `PrivacyInfo.xcprivacy` with the display-customization reason `54BD.1` for active keyboard access. Do not send keyboard-language diagnostics to analytics services.

## Verification

```sh
yarn test --runInBand
yarn test:languages:ios
cd example/android && ./gradlew :react-native-keyflow:testDebugUnitTest
# After building and launching the example with Stim:
node scripts/visual/languages.mjs ios keyflow
node scripts/visual/languages.mjs android keyflow-android
```

The device suite records screenshots and checks switching, French typing, held accents, absence of custom word suggestions, symbol entry, explicit QWERTY/AZERTY changes, both landscape orientations, text/cursor preservation, and repeated system/custom handoffs. It verifies the real Android IME opens. Results are saved under `artifacts/latin-languages/`. Set `AGENT_DEVICE` and `ADB` if needed.

Public API references: [Apple text input modes](https://developer.apple.com/documentation/uikit/uitextinputmode), [Android input-method subtypes](<https://developer.android.com/reference/android/view/inputmethod/InputMethodManager#getEnabledInputMethodSubtypeList(android.view.inputmethod.InputMethodInfo,boolean)>), [Apple privacy reasons](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype).

Before disabling word suggestions, verified on iPhone 17/iOS 26.5 and the Android 16 emulator: 43 iOS and 44 Android device checks pass, with screenshots in [the verification gallery](../artifacts/latin-languages/index.html). The two iOS XTests, 77 JavaScript tests, 12 Swift resolver assertions, and three Kotlin tests pass. Both native examples launch without runtime errors. The standalone example installs and type-checks against the final archive; it was not separately native-built.
