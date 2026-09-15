# Press, selection, and accent materials

Two independent theme tokens control the highlighted long-press choice:

```tsx
const pressedTheme = createKeyflowTheme(
  {
    pressedKeyBackground: '#FFFFFF55',
    selectedKeyBackground: '#A35CEA99',
    selectedKeyForeground: '#102D46',
  },
  transparentKeyflowTheme,
);
const { keyflowInputProps } = useKeyflow({
  keyflowTheme: pressedTheme,
});
<TextInput {...keyflowInputProps} />;
```

The Apple letter inventory was captured from actual holds on the iOS 26.5 English keyboard: `artifacts/accent-parity/apple-*.png`. It adds previously missing alternatives and matches the observed base-letter position. Uppercase I uses dotted İ instead of duplicating I; uppercase S retains ß and uses Apple's separately observed ordering. This reference is specific to that locale and OS, not every installed language.

## Repeat the accent check

Open **Make room for your style** on the assigned iOS simulator, then run from the library root:

```sh
AGENT_DEVICE=/path/to/agent-device node scripts/test-ios-accent-choices.mjs keyflow
```

The test holds every referenced letter, reads the native renderer's last accent row through `getKeyboardMetrics()`, and compares it with the independently captured fixture in `scripts/fixtures/apple-letter-reference.json`. It also rejects overflowing labels or choices outside the callout. It checks 18 lowercase rows plus the distinct uppercase I/S rows. Results are saved in `artifacts/accent-parity/choices-results.json`.

The Android alphabet was separately captured from docked Gboard 15.1 (`artifacts/accent-parity/gboard-*.png`). Its available alternatives differ from Apple's. Android retains its own repertoire and numeric holds; the existing continuous accent-drag comparison verifies upper/lower row targeting and cancellation.

## Verified results

- All 20 captured Apple accent rows pass the device inventory and geometry assertions.
- Android's four native/custom continuous accent-drag cases pass.

## Typography and opening follow-up

The default light iOS pressed fill is white, matching the captured native popup rather than the old gray. `node scripts/verify-press-color.mjs` checks the sampled popup interior; it does not claim matching contours or dark-mode gradients.

Opening prepares key geometry before focus. UIKit owns the keyboard animation; transparent accessory hosting has separate timing limits documented in [native parity](native-parity.md).
