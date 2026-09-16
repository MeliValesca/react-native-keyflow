# README media

All six GIFs and MP4s were recorded again on 2026-09-15 using the keyboard implementation merged in `5bc4916`. They show the current example, including multiline trackpad movement. The themed stills and four default-layout previews retain their earlier provenance below. These are simulator/emulator demonstrations, not a comparison against Apple/Gboard or a claim of physical-device frame pacing.

| Files                              | Device and action                                                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ios-transitions.mp4` / `.gif`     | Stim-owned iPhone 17, iOS 26.5. Story Studio: two dismissal/refocus cycles                                                                          |
| `ios-accents.mp4` / `.gif`         | Same iPhone. Story Studio: two holds on E, sliding across accent choices                                                                            |
| `ios-trackpad.mp4` / `.gif`        | Same iPhone. Native interaction example: reset the multiline fixture, hold space and move diagonally up/left and down/right; labels fade and return |
| `android-transitions.mp4` / `.gif` | Stim-owned Android phone emulator, API 36, 1080 × 2400. Native interaction example: submit dismissal and refocus twice                              |
| `android-accents.mp4` / `.gif`     | Same Android phone. Hold E and continuously slide left/right across alternatives                                                                    |
| `android-trackpad.mp4` / `.gif`    | Same Android phone. Reset the multiline fixture, then one continuous space gesture moves horizontally and vertically                                |
| `studio.jpg`                       | iPad Story Studio keyboard after accent input, captured on 2026-09-13 from `c4183a6`                                                                |
| `transparent.jpg`                  | Same earlier iPad capture. Transparency example at 35% panel and 70% keys                                                                           |
| `custom-font.jpg`                  | Same earlier iPad capture. Custom-font example with bundled Quicksand SemiBold                                                                      |

## Processing

- iOS recordings use `xcrun simctl io <device> recordVideo --codec=h264` while XCTest drives the visible example. Android recordings use `adb shell screenrecord` at 6 Mbps, with continuous touch movement sampled approximately every 16 ms.
- MP4s remove preparation/navigation and audio, resize to 720 px wide, and use H.264, CRF 24 and fast-start metadata. Playback speed is unchanged.
- Accent and trackpad GIFs crop the bottom 55% to include the input and keyboard, then use 420 px width, 25 fps and 128 colors. Transition GIFs show the whole phone at 280 px width, 12 fps and 96 colors. Frames are sampled without motion interpolation. Export frame rate does not imply a new captured frame at every interval.
- The multiline text is seeded through the example’s visible Reset Multiline action. The recordings demonstrate movement through that input, not typing of the fixture text.
- No keys, colors, text, backgrounds or cursor motion were reconstructed. The capture harness is separate from the regression-suite count. Documentation media is outside the npm package’s `files` allowlist.

To reproduce, launch the current example with Stim. Open Story Studio on iPhone for accents/transitions, or Compare native interactions for multiline trackpad movement. On Android, use Compare native interactions for all three actions. Keep the host display awake for simulator/emulator UI recording.

## Default-layout previews

`default-iphone.jpg`, `default-ipad.jpg`, `default-android-phone.jpg`, and `default-android-tablet.jpg` derive from the matching PNGs in [development evidence](development-captures/README.md). They are historical layout previews, not new captures or a claim of current native parity. Each crops the bottom 40% and resizes to 600 px width. The originals remain in the evidence folder.
