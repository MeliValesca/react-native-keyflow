# Android preview

Kotlin Expo Module using an owned EditText and bottom PopupWindow. Includes English letters/numbers/symbols, shift/caps, selection replacement, grapheme deletion, held delete, paste, optional native haptics, Back dismissal, and system keyboard switching.

The panel reports custom/system frames via `onKeyboardFrameChange`; pass them to `KeyflowKeyboardAvoidingView` to keep content visible. This is an in-app keyboard, not an InputMethodService installed for other applications. Tablet, predictive Back animation, and OEM differences need additional validation.

Fonts resolve through ReactFontManager, including fonts registered by expo-font. Key rows disable baseline alignment and labels fit their measured bounds. Delete supports holding. The Android device regression screens cover 58 customization themes, number pads, landscape, and custom/system transitions. Visual identity with every Gboard or OEM version is not claimed.
