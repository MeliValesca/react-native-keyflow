# Keyflow API guide

[← README](../README.md)

[Installation](#compatibility-and-local-installation) · [Input](#input-api) · [Avoidance](#keyboard-avoidance) · [Themes](#theme-reference) · [Diagnostics](#diagnostics)

## Compatibility and local installation

Keyflow is an unpublished preview. The supported peer range is Expo SDK 57, React Native 0.86.x (0.86.3+) and React 19.2.3+. The example uses the exact versions in its lockfile and targets iOS 16.4+ and Android API 24+.

The native bridge uses Expo Modules. A consuming React Native app needs Expo Modules configured and a native development or production build. Expo Go and web cannot load this custom native module. Earlier Expo/RN combinations are not claimed as supported.

To try it in another compatible app, create a local package:

```sh
# From the Keyflow repository, after installing dependencies:
corepack yarn pack --out /tmp/react-native-keyflow.tgz

# From your consuming app:
npm install /tmp/react-native-keyflow.tgz
```

Use your app’s package manager if it differs, then rebuild its native app. To generate the standalone example repository instead, run `corepack yarn example:export` from Keyflow.

## Web fallback

The custom keyboard supports iOS and Android only. Calling the hook on an unsupported platform throws. Put the hook in a native-only component so hook order remains stable:

```tsx
import { Platform, TextInput } from 'react-native';
import { useKeyflow } from 'react-native-keyflow';

function NativeKeyflowInput() {
  const { keyflowInputProps } = useKeyflow();
  return <TextInput {...keyflowInputProps} placeholder="Start typing…" />;
}

export function CrossPlatformInput() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return <TextInput placeholder="Start typing…" />;
  }
  return <NativeKeyflowInput />;
}
```

The fallback uses the browser’s normal input behavior; Keyflow’s keyboard theme does not apply to it.

## Input API

```tsx
import { TextInput } from 'react-native';
import { useState } from 'react';
import { useKeyflow } from 'react-native-keyflow';

export function Input() {
  const [mode, setMode] = useState<'custom' | 'system'>('custom');
  const { keyflowInputProps } = useKeyflow({
    keyboardMode: mode,
    onKeyboardModeChange: setMode,
  });

  return (
    <TextInput
      {...keyflowInputProps}
      defaultValue="Hello"
      onChangeText={(text) => console.log(text)}
      onSubmitEditing={(event) =>
        console.log('Submitted:', event.nativeEvent.text)
      }
      style={{ height: 52 }}
    />
  );
}
```

| Option                     | Behavior                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `autoFocus`                | Focuses after native attachment; defaults to `false`. Use instead of TextInput’s `autoFocus` prop.                                   |
| `enabled`                  | Enables native attachment; defaults to `true`                                                                                        |
| `keyboardMode`             | `custom` (default) or `system`                                                                                                       |
| `keyboardAppearance`       | `light` or `dark`; otherwise follows device appearance                                                                               |
| `keyboardType`             | `default`, `number-pad`, `decimal-pad`, `phone-pad`                                                                                  |
| `returnKeyContent`         | Custom text or a portable native icon for Keyflow's submit key                                                                       |
| `keyflowTheme`             | Partial overrides or a resolved theme                                                                                                |
| `keyboardLanguages`        | English/French language and QWERTY/AZERTY template entries                                                                           |
| `hapticsEnabled`           | Optional key feedback, off by default                                                                                                |
| `showSecondaryKeyLabels`   | Android’s 1–0 key legends, on by default; hiding them preserves long-press shortcuts. This prop does not hide iPad alternate legends |
| `onKeyboardFrameChange`    | Optional frame observer; `KeyflowAvoidingView` tracks the active frame automatically                                                 |
| `onKeyboardModeChange`     | Reports custom/system mode changes                                                                                                   |
| `onKeyboardLanguageChange` | Reports `{ language, layout }`                                                                                                       |
| `onKeyboardHeightChange`   | Android custom panel height; prefer the frame callback for new integrations                                                          |

The app owns its editor and text. Use ordinary React Native `TextInput` props such as `value`, `defaultValue`, `onChangeText`, `onSubmitEditing`, `placeholderTextColor`, `accessibilityLabel`, `editable`, and `submitBehavior` directly on the input. Keyflow adds no input height, padding, border, color, or font. `onSubmitEditing` receives the standard React Native event, not a string.

Customize Keyflow's return key independently from submission behavior:

```tsx
const { keyflowInputProps } = useKeyflow({
  returnKeyContent: { icon: 'send' },
});

<TextInput
  {...keyflowInputProps}
  submitBehavior="submit"
  onSubmitEditing={sendMessage}
/>;

// A multiline editor can use the same key to insert a newline.
<TextInput {...keyflowInputProps} multiline submitBehavior="newline" />;
```

The portable icon names are `return`, `arrow-right`, `checkmark`, `send`, and `search`. Choose either `text` or `icon`. The option affects only the custom keyboard; the system keyboard continues to follow the platform's `returnKeyType` and `enterKeyHint` behavior.

The hook returns:

| Value                | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `keyflowInputProps`  | The ref and event bindings to spread onto your input                   |
| `focus()` / `blur()` | Stable methods that target the currently mounted input                 |
| `inputRef`           | The same ref included in `keyflowInputProps`, for other native methods |

Text state, input appearance, and composer content remain app-controlled. There is no external ref argument.

Single-line and `multiline` inputs are supported. Set editor height, scrolling, and `numberOfLines` on the input. During trackpad movement, a floating caret follows continuous horizontal and vertical drag coordinates across text and blank space inside the input. The native editor resolves the insertion position through text hit testing, including soft wrapping; release removes the floating caret and restores the native caret at that position. The drag target is anchored at gesture start and remains independent of the snapped caret across short lines. Hold space on iOS, or use the space-slide gesture on Android. Return uses the native React Native editing pipeline and respects `submitBehavior`.

Call `useKeyflow(options)` and spread `keyflowInputProps` onto your `TextInput`. The hook creates a stable ref and includes it with the `showSoftInputOnFocus`, `onFocus`, `onSelectionChange`, and `onLayout` bindings. The ref allows native keyboard attachment; the callbacks keep focus and cursor context synchronized and support automatic focus when an input mounts later. For custom components, forward the ref and bindings to the underlying `TextInput`, not a surrounding `View`. If you override `onLayout`, call `keyflowInputProps.onLayout?.(event)` from your handler too.

Compose your own focus/selection callbacks with the bindings:

```tsx
<MyTextInput
  {...keyflowInputProps}
  value={text}
  onChangeText={setText}
  onFocus={(event) => {
    keyflowInputProps.onFocus?.(event);
    setFocused(true);
  }}
  onSelectionChange={(event) => {
    keyflowInputProps.onSelectionChange?.(event);
    setSelection(event.nativeEvent.selection);
  }}
  style={styles.input}
/>
```

The hook option `keyboardType` chooses the custom layout. Set `keyboardType` on your input too when you want a matching system keyboard. Your input's `keyboardAppearance` controls system mode; the hook option controls the custom keyboard. Single-line and multiline inputs are supported. Focusing a replacement input attached to the same ref reattaches its keyboard.

The hook returns stable `focus()` and `blur()` methods that act on the currently mounted input and safely do nothing when it is absent. `focus()` prepares the native attachment before focusing; `blur()` cancels any pending focus request. It also exposes `inputRef`, a normal React Native `TextInput` ref, for other native methods. Change the controlled `keyboardMode` option to switch between custom and system keyboards. A mode change preserves text and selection, cancels active holds, and resets the custom keyboard page.

System mode delegates layout, languages, composition and settings to the user’s installed keyboard. Its visibility and floating/hardware-keyboard configuration remain controlled by the OS and IME. Keyflow’s colors and fonts cannot reskin that system keyboard.

## Keyboard avoidance

Wrap your content in `KeyflowAvoidingView` for shared iOS/Android integration. It follows the active Keyflow frame internally; no frame state or callback wiring is needed. `onKeyboardFrameChange` remains an optional observer for diagnostics or custom layouts. A frame describes the area occupied by the keyboard; the avoiding view uses it to keep the composer visible without a hardcoded keyboard height.

```tsx
const { keyflowInputProps } = useKeyflow({
  keyflowTheme,
});

<KeyflowAvoidingView
  keyboardVerticalOffset={headerOffset}
  enabled
  style={{ flex: 1 }}
>
  <TextInput {...keyflowInputProps} style={styles.input} />
</KeyflowAvoidingView>;
```

For custom layouts, the optional `keyboardFrame` prop overrides automatic tracking:

```tsx
<KeyflowAvoidingView keyboardFrame={customFrame} style={styles.container}>
  <TextInput {...keyflowInputProps} style={styles.input} />
</KeyflowAvoidingView>
```

Omitting `keyboardFrame` follows the active Keyflow. Passing a frame uses your supplied geometry; passing `null` bypasses Keyflow’s tracked frame (iOS can still use native keyboard notifications). Set `enabled={false}` to turn avoidance off entirely. The hook’s optional `onKeyboardFrameChange` callback remains available when you need frame events for diagnostics or another layout implementation.

Set `headerOffset` for your actual container/navigation setup. The example uses React Navigation’s header height on iOS and zero on Android. Do not blindly copy a fixed number or add another keyboard-height spacer.

The component accepts `ViewProps`, `enabled`, `keyboardVerticalOffset`, and `keyboardFrame`. It uses padding avoidance; `behavior` and `contentContainerStyle` are not exposed. Apply scrolling-content styles to your child scroll view.

On iOS it wraps React Native’s keyboard avoiding view. Android’s custom panel needs Keyflow’s frame updates, so React Native’s ordinary `KeyboardAvoidingView` alone is not the shared solution. Keep backgrounds outside the avoiding view when they should extend behind a transparent keyboard.

[Transition integration and tests](keyboard-transitions.md).

## Theme reference

Pass section overrides through the hook's `keyflowTheme` option, or use `createKeyflowTheme(overrides, base)` to validate, resolve, and freeze a reusable theme. Without a theme, Keyflow selects platform and appearance defaults. The helper’s default base is `lightKeyflowTheme`; pass another base explicitly when needed.

Available bases: `lightKeyflowTheme`, `darkKeyflowTheme`, `androidKeyflowTheme`, `androidDarkKeyflowTheme`, `transparentKeyflowTheme`.

### Sections and inheritance

Sections are `keys`, `specialKeys`, `deleteKey`, `returnKey`, `preview`, `selection`, and `toolbar`. Each supports these fields where applicable:

| Fields                                                 | Values                        |
| ------------------------------------------------------ | ----------------------------- |
| `background`, `color`, `iconColor`, `placeholderColor` | `#RRGGBB` or `#RRGGBBAA`      |
| `pressedBackground`, `pressedColor`, `borderColor`     | Same color format, alpha last |
| `borderWidth`                                          | 0–3 logical pixels            |

The `keyboard` section also accepts `cornerRadius` (0–48), `borderColor`, and
`borderWidth` (0–3) for the outer keyboard panel. The border is drawn as one
continuous path across the top edge and around both top corners.
| `cornerRadius` | 0–24 logical pixels, bounded by the face |
| `fontFamily` | Registered font name, system alias, or `null` |
| `fontSize` | 10–32 logical pixels |
| `fontWeight` | `regular`, `medium`, `bold` |
| `iconSize` | 12–28 logical pixels |

Global typography uses `font: { family, size, weight }`, with size 12–32. Sections inherit global values. Partial section updates preserve their other settings. `color` supplies icon/pressed foregrounds unless explicitly overridden; `fontFamily: null` restores the system font for that section.

Load app fonts before rendering. System aliases are `system-rounded`, `system-serif`, and `system-monospace`. Fitted sizes and optical proportions vary with native layout; missing fonts fall back. Explicit colors do not ensure contrast automatically.

The current native implementations are not fully aligned: Android’s active Caps key uses `selection`; iOS modifiers remain under `specialKeys`. Platform radius adjustments and alternate-label presentation also differ. Do not assume a selected-state override or radius produces an identical result on both platforms yet.

### Surface and material

```tsx
const materialTheme = {
  keyboard: {
    background: '#16324F',
    backgroundOpacity: 0.35,
    keyOpacity: 0.7,
    material: { type: 'raised', depth: 4, shadowColor: '#102030' },
  },
};
const { keyflowInputProps } = useKeyflow({
  keyflowTheme: materialTheme,
});
<TextInput {...keyflowInputProps} />;
```

- `backgroundOpacity` (0–1) replaces the panel color’s alpha.
- `keyOpacity` (0–1) multiplies key/control/popup surfaces, borders and shadows without fading text/icons.
- `surfaceOpacity` (0–1) optionally multiplies all surfaces after the other controls. Restyling does not compound it.
- `material: { type: 'flat' }` has no depth options.
- Raised material accepts `depth` (0–6, default 4) and `shadowColor` (default black).

Use alpha in an individual section color for finer control. The transparent preset starts with a 35% panel tint and 70% key opacity, including visible key borders and a defined space bar.

### Existing flat tokens

Flat tokens remain accepted for compatibility: `background`, `keyBackground`, `keyForeground`, `specialKeyBackground`, `specialKeyForeground`, `deleteKeyBackground`, `actionKeyBackground`, `actionKeyForeground`, `pressedKeyBackground`, `selectedKeyBackground`, `selectedKeyForeground`, `fontFamily`, `fontSize`, `fontWeight`, and `keyCornerRadius`. Prefer section objects for new themes; section settings take precedence.

Geometry is internal: themes do not define rows, key widths or touch regions. iOS detects tablet idiom; Android uses `smallestScreenWidthDp >= 600`. Native layouts resize for the current viewport. Full floating/split keyboard and arbitrary multi-window parity are not supported claims.

## Diagnostics

Testing helpers are separate from the production input ref:

```tsx
import { getKeyboardMetrics } from 'react-native-keyflow/testing';

const metrics = await getKeyboardMetrics(inputRef);
```

These diagnostics are intended for regression tests and can change between preview releases. See [coverage](coverage.md), [test commands](testing.md), [languages](languages.md), and [layouts](keyboard-layouts.md).
