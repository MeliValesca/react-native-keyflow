# Android keyboard verification — September 8–9, 2026

> Historical captures and checks from the initial calibration. For the current emoji-free default, key previews, and executable regression commands, use [Default QWERTY parity](native-parity.md).

Reference: Gboard **15.1.08.726012951-preload-arm64-v8a**, English (US), default height and Material theme, on Android 16 / API 36. The example and reference share the same native editor. Captures use the Stim-owned `emulator-5568`, with 411×914 and 320×640 logical-pixel phone viewports at density 160. These are emulator comparisons, not certification for other IMEs, Gboard versions, or physical devices.

## Changes

- Geometry updates while the window resizes. Responsive phone key geometry, centered second row, wider shift/delete keys, corrected symbols, number hints, pill-shaped action keys, and empty space-bar caption.
- Independent Android light and dark presets, including navigation-bar backing. The iOS presets are unchanged.
- Native font customization and fitting remain bounded inside each key face. The default font uses Android's public system font; Gboard's private font assets are not redistributed.
- Space-bar dragging moves the caret by grapheme. Holding a top-row letter inserts its number hint.

## Keyboard avoidance

Android's keyboard frames use screen coordinates. React Native 0.83's `measureInWindow` subtracts the visible-window origin, including the status bar. The native frame now includes `windowOffsetY`, and Keyflow converts the measured container bottom before computing keyboard overlap. This fixes the 24-pixel offset that a visual font check exposed. See the checked-in [ReactSurfaceView implementation](https://github.com/facebook/react-native/blob/v0.83.0/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactSurfaceView.kt).

The regression screens now verify the editor's **native screen bounds**, independently of React Native's layout measurements. They also compare the reported custom frame to the keyboard's actual native position, and verify real IME visibility before accepting a system handoff. Reserved space alone cannot pass that assertion. Earlier transition results without these assertions did not detect the coordinate mismatch and are superseded by the final runs below.

## Repeatable checks

Build and launch from `example/` with `stim android`. Use the device reported by Stim; do not assume another active emulator belongs to this checkout. The example includes transition and customization test screens. The temporary autostart controls in `example/src/testing/launch.ts` should remain disabled in the distributed example.

For visual comparisons:

```sh
node scripts/compare-android-keyboards.mjs \
  artifacts/android-gboard-411-light.png \
  artifacts/android-keyflow-411-light.png \
  artifacts/android-411-light-comparison.json
```

The comparator uses full-screen coordinates without shifting or scaling the candidate. It measures connected key faces, letter-ink bounds, action-icon presence, and sampled panel/navigation/action colors. It fails on missing faces/icons, key-bound differences over two pixels, or sampled color-channel differences over three levels. It does not equate passing geometry checks with identical glyph contours or full-screen pixel equality.

For editor behavior, open the blank, focused Keyflow comparison editor at 411×914/density 160, then run:

```sh
python3 scripts/test-android-interactions.py /path/to/adb emulator-5568
```

## Results

Final settled captures use the same screen coordinates as Gboard, without alignment or scaling. All sampled panel, navigation, special-key, and submit colors match exactly. Glyph-bound differences remain; this is not a claim of pixel-identical fonts.

| Width / page    | Measured key faces | Maximum face-edge error | Maximum glyph-bound error | Maximum sampled RGB error |
| --------------- | ------------------ | ----------------------- | ------------------------- | ------------------------- |
| 320 / light     | 28                 | 1 px                    | 4 px                      | 0                         |
| 411 / uppercase | 28                 | 1 px                    | 2 px                      | 0                         |
| 411 / light     | 28                 | 1 px                    | 4 px                      | 0                         |
| 411 / dark      | 28                 | 1 px                    | 3 px                      | 0                         |
| 411 / numbers   | 29                 | 1 px                    | 4 px                      | 0                         |

- Library formatting, both TypeScript projects, **38 unit tests**, and the distributable build pass. The standalone example also installs the refreshed package and typechecks; its installed native source matches the library source.
- **144 customization configurations** pass across the two phone widths: six font choices (including a bundled font and a missing-font fallback), three materials, two font sizes, and two corner radii. Every run checks key bounds, font fitting, and the editor's native screen position.

See [411-point customization results](../artifacts/android-411-customization.ndjson), [320-point customization results](../artifacts/android-320-customization.ndjson), and [interaction results](../artifacts/android-interaction-results.ndjson).

## Scope and remaining differences

Gboard's theme can follow wallpaper colors and user settings, as documented in [Gboard's theme settings](https://support.google.com/gboard/answer/6102154?hl=en). The shipped presets match the recorded reference palette; they do not read another keyboard application's private settings. Phone landscape and keypad comparisons are covered separately in [keyboard layouts](keyboard-layouts.md). The docked tablet profile is calibrated against Gboard on a Pixel Tablet API 36 AVD. User-resized/floating Gboard, Samsung Keyboard, and other OEM keyboards are distinct designs and require their own explicit profiles before they can be claimed as visual matches.
