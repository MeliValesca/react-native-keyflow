# README media

The themed Keyflow captures were made on 2026-09-13 from the working tree at `c4183a6`. The four `default-*.jpg` previews reuse the earlier PR evidence described below. These demonstrate the current implementation, not a comparison against Apple/Gboard or a claim of physical-device frame pacing.

| Files                              | Device and action                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ios-transitions.mp4` / `.gif`     | Stim-owned iPad Pro 11-inch (M5), iPadOS 26.5. Story Studio composer: focus, dismiss, repeat, focus again        |
| `ios-accents.mp4` / `.gif`         | Same iPad. Hold E, then hold e and move to another accent                                                        |
| `android-transitions.mp4` / `.gif` | Stim Android phone emulator, Android API 36, 1080 × 2400. Story Studio composer: Back dismissal, refocus, repeat |
| `android-accents.mp4` / `.gif`     | Same Android phone. Two stationary long presses on E/e expose accents and the number shortcut                    |
| `studio.jpg`                       | iPad Story Studio keyboard after accent input                                                                    |
| `transparent.jpg`                  | iPad transparency example, default 35% panel and 70% keys, with typed text                                       |
| `custom-font.jpg`                  | iPad custom-font example with bundled Quicksand SemiBold and typed text                                          |

## Processing

- iOS recording: `xcrun simctl io <device> recordVideo --codec=h264 <file>` while XCTest drives the visible app.
- Android recording: `adb -s <device> shell screenrecord --bit-rate 4000000 <file>` while input events drive the visible app.
- MP4s trim preparation/navigation, remove audio, and resize to 720 px wide with H.264, CRF 24 and fast-start metadata. Playback timing is unchanged.
- GIFs are 10 fps, 96-color previews. Transitions show the full screen at 280 px wide; accent previews crop to the bottom 45% at 360 px wide so the popup is legible.
- JPGs crop the bottom 40% of actual screenshots, resized to 900 px wide. No keys, colors, text, or backgrounds were reconstructed.

The original screenshot capture actions completed successfully. This capture harness is not part of the regression-test count. These small documentation assets are outside the npm package’s `files` allowlist.

To reproduce, launch the example with Stim, open Story Studio / Transparency / Custom app font, and perform the actions above. Keep media labels explicit about platform, form factor and capture processing.

## Default-layout previews

`default-iphone.jpg`, `default-ipad.jpg`, `default-android-phone.jpg`, and `default-android-tablet.jpg` derive from the matching PNGs in [development evidence](development-captures/README.md). That evidence records device details and the development validation used for those captures. These are historical layout previews, not new captures or a claim of current native parity.

Each crops the bottom 40% of the original screenshot and resizes to 600 px wide as JPEG. No keyboard elements or colors were redrawn. The originals remain available in the evidence folder.
