# README media

The themed stills and transition captures were made on 2026-09-13 from the working tree at `c4183a6`. Accent and trackpad clips were recorded again on 2026-09-14 using the keyboard implementation merged in `63227a8`. The four `default-*.jpg` previews reuse the earlier PR evidence described below. These demonstrate the current implementation, not a comparison against Apple/Gboard or a claim of physical-device frame pacing.

| Files                              | Device and action                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ios-transitions.mp4` / `.gif`     | Stim-owned iPad Pro 11-inch (M5), iPadOS 26.5. Story Studio composer: focus, dismiss, repeat, focus again                     |
| `ios-accents.mp4` / `.gif`         | Same iPad. Two holds on e, sliding across columns and into the other accent row                                               |
| `android-transitions.mp4` / `.gif` | Stim Android phone emulator, Android API 36, 1080 × 2400. Story Studio composer: Back dismissal, refocus, repeat              |
| `android-accents.mp4` / `.gif`     | Same Android phone. Hold E, then slide diagonally and horizontally across accent choices                                      |
| `ios-trackpad.mp4` / `.gif`        | Same iPad. Hold space twice and move the cursor left/right; key labels fade and return on release                             |
| `android-trackpad.mp4` / `.gif`    | Same Android phone. One continuous space gesture moves the cursor left, right and left again while preserving pressed styling |
| `studio.jpg`                       | iPad Story Studio keyboard after accent input                                                                                 |
| `transparent.jpg`                  | iPad transparency example, default 35% panel and 70% keys, with typed text                                                    |
| `custom-font.jpg`                  | iPad custom-font example with bundled Quicksand SemiBold and typed text                                                       |

## Processing

- iOS recording: `xcrun simctl io <device> recordVideo --codec=h264 <file>` while XCTest drives the visible app.
- Android recording: `adb -s <device> shell screenrecord` at 4–6 Mbps while input events drive the visible app. The new gesture recordings use one continuous touch stream sampled approximately every 16 ms; note text is entered through the visible custom keys.
- MP4s trim preparation/navigation, remove audio, and resize to 720 px wide with H.264, CRF 24 and fast-start metadata. Playback timing is unchanged.
- Android accent and trackpad GIFs are 50 fps; iOS versions remain 25 fps. Both use 128 colors at 480 px wide. The Android exports use the original recordings directly to preserve captured frames. The export frame rate does not imply that the source captured a new frame at every interval. They crop the bottom 45% on iPad and 50% on Android to include the input, popup and keyboard. Existing transition GIFs remain 10 fps, 96 colors and 280 px wide. Frames are sampled from the recordings without motion interpolation or playback speed changes.
- JPGs crop the bottom 40% of actual screenshots, resized to 900 px wide. No keys, colors, text, or backgrounds were reconstructed.

The original screenshot capture actions completed successfully. This capture harness is not part of the regression-test count. These small documentation assets are outside the npm package’s `files` allowlist.

To reproduce, launch the example with Stim, open Story Studio / Transparency / Custom app font, and perform the actions above. For trackpad captures, enter a short sentence through the custom keyboard, then move the cursor in both directions on space. On iOS, hold space before moving. Keep media labels explicit about platform, form factor and capture processing.

## Default-layout previews

`default-iphone.jpg`, `default-ipad.jpg`, `default-android-phone.jpg`, and `default-android-tablet.jpg` derive from the matching PNGs in [development evidence](development-captures/README.md). That evidence records device details and the development validation used for those captures. These are historical layout previews, not new captures or a claim of current native parity.

Each crops the bottom 40% of the original screenshot and resizes to 600 px wide as JPEG. No keyboard elements or colors were redrawn. The originals remain available in the evidence folder.
