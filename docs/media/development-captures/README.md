# Development visual evidence

The gallery below was captured during development before this repository's initial commit. The press-feedback recordings further below cover a subsequent interaction fix.

| File                 | Source                                                                                         | Demonstrates                                           |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `iphone.png`         | iPhone 17 Pro, iOS 26.5; successful `testAllLettersMatchApple` in a development CI run         | Keyflow alphabet input on a phone                      |
| `ipad.png`           | iPad Pro 11-inch (M5), iOS 26.5; successful `testAllLettersMatchApple` in a development CI run | Keyflow alphabet input on a tablet                     |
| `android-phone.png`  | Current example installed by Stim; Android phone emulator, 1080 × 2400                         | Keyflow QWERTY input                                   |
| `android-tablet.png` | Same APK as the phone; running Pixel Tablet emulator, 1600 × 2560 portrait                     | Keyflow tablet QWERTY input                            |
| `android-typing.mp4` | Screen recording of the Android phone above                                                    | Actual taps, number-page switching, and typed output   |
| `android-typing.gif` | First six seconds of the recording, resized to 360 px wide at 10 fps                           | Inline preview; use the MP4 for the original recording |

Screenshots are resized for review; their contents are otherwise unchanged. These files are excluded from the published npm package by its `files` allowlist.

All seven required checks passed for the original gallery's source commit. These captures demonstrate the named cases, not universal native visual parity.

## Press-feedback fix

Recorded with `adb screenrecord`, using a stationary `input swipe` with a requested 60 ms duration. The before recording uses the original ripple; the after recordings use the accompanying fix, which clears pressed state on release and uses stateful key-face colors.

- `android-press-before.mp4`: Android phone, original ripple feedback.
- `android-press-after.mp4`: same phone profile, fixed feedback.
- `android-tablet-press-after.mp4`: Pixel Tablet, fixed feedback.

The phone's visible feedback lasted approximately 717 ms before the fix and 83–100 ms in the successful after captures. The Gboard baseline capture showed approximately 67 ms. These are emulator/video observations, not exact touch-to-display latency measurements; scheduling and variable frame rates affect the counts. The tablet comparison likewise showed no lingering fade after the fix.

Automated regressions verify the entire rendered key face returns immediately on release/cancel, including flat, raised, transparent, space, and delete cases. Separate iOS rendering regressions verify that the accent indicator stays centered within a choice, switches immediately at a boundary without animations, and snaps correctly after re-entry. Both suites run on phone and tablet.
