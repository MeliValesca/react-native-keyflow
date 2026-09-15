# Automated coverage and its limits

## Required device suite

The device suite retains the pre-release test inventory recorded in
[`baseline-tests.json`](../scripts/ci/baseline-tests.json),
plus regressions for glyph rendering, modifier states, held-delete lifecycle,
space/trackpad feedback, multiline editing, panel clipping, and input remounts.
Every required device runs its full suite against the current implementation;
platform-specific assumptions remain explicit skips.

| Device         | Required cases before platform-specific skips |
| -------------- | --------------------------------------------- |
| Android phone  | 64 native + 10 React Native app groups        |
| Android tablet | 64 native + 10 React Native app groups        |
| iPhone         | 57 rendering + 63 interaction cases           |
| iPad           | 57 rendering + 63 interaction cases           |

`scripts/ci/baseline-tests.json` records the original inventory for verification.
A fast workflow test verifies the original inventory plus the explicitly recorded
regressions. It does not select or skip tests.

iOS coverage includes typing, symbol pages, long presses, accent selection,
number pads, tablet layouts, customization, transparency and transition diagnostics.
Android native coverage includes layouts, input, accent interactions and press-release
styling. The four additional cases verify actual visible glyph pixels in flat and
raised materials, both at rest and while pressed. Shift regressions check left/right activation, filled-arrow pixels, one-letter reset, independent Android Caps Lock/Shift activation, shifted punctuation output, and the separate automatic-capitalization state. iPad regressions verify its distinct modifier behavior and `! ?` punctuation, including accessibility labels and rendered attachments. Phone regressions check persistent uppercase and the distinct Caps Lock glyph on both platforms.

Space/trackpad regressions verify iOS touch-down fill contrast, normal release and custom-color cancellation, legend and key-face fading, restoration during an interrupted fade, and restoration after cursor dragging. Android tests compare rendered space-bar pixels during cursor movement in flat and raised materials, and verify that release or cancellation restores the resting color without inserting a space.

Android also exercises the actual React Native example on both phone and tablet:

- All letters, combined-emoji deletion, and held-delete release.
- Controlled multiline Return, vertical and horizontal trackpad editing, and automatic avoidance.
- Number/symbol page changes, accent commits, and cancelled letters.
- System/custom handoffs preserving text and selection across six switches for single-line and multiline inputs.
- System-editor typing and multiline Return, followed by restoration to Keyflow.
- Single-line Return dismisses and blurs without changing text, with Keyflow and the system editor.
- Flat and raised transition diagnostics: native baseline, show/hide, handoffs, layout restoration, and interruptions. The Android plain-editor baseline reads real OS IME insets through a read-only diagnostic, without attaching Keyflow.
- The same customization matrix and independent transparency checks used by iOS.
- QWERTY, number, decimal, and phone pads in portrait and landscape, including actual text insertion and editor clearance.

The integration categories run on both platforms; platform-specific native behavior remains different. iOS comparisons use Apple’s keyboard. Android’s system-editor baseline sends Android editor events with the installed IME active; it does not assume a particular Gboard version or compare its pixels. Allocation/performance/background stress tests remain outside the required suite on both platforms.

Fast unit regressions remain for input readiness, rotation/frame ordering, stable
keyboard geometry and mode handoffs. CI helper tests reject incomplete native test
results and validate shared-build handling and simulator startup failures.

## Build once, test on each device

The workflow has one Android producer and one iOS producer. Each builds the app
and test binaries once; phone and tablet jobs download those products from the
same run. Device jobs contain no Gradle, CocoaPods or native compilation. Missing
or mismatched artifacts fail instead of silently rebuilding. iOS also verifies
the Xcode version and uses `test-without-building`.

Android runs the installed native instrumentation APK and the shared React Native example APK, emitting separate JUnit reports. Both platforms use Stim for Metro and warm the exact platform bundle once. Android app tests save per-group screenshots and UI hierarchies, JSON results, and logcat; incomplete or failed checks fail the job. Local development continues to use Stim normally.

Library formatting, lint, types, unit tests, package checks and native build checks
remain required. The seven protected check names and platform change filtering
are unchanged. Weekly runs add larger iOS devices and an older Android API using
the same suite; they do not add another coverage mode.

## Known findings and limits

A superseded expanded development run left the Android app while navigating to
transparency and reported roughly 3.3 points of input overlap in iPhone transparency.
Removing an unreliable suite does not prove those reports harmless. The iOS
transparency case remains required, retains the original 600 ms presentation
allowance and rejects stable overlap. A focused local run passed; GitHub validation
of the final revision is still required.

Passing CI does not certify complete VoiceOver/TalkBack navigation or speech,
every native visual detail, sustained frame pacing or memory usage on physical
devices, or every manufacturer keyboard, OS release, foldable, floating or split mode.
The recorded English native references are sampled configurations, not universal
keyboard catalogues. Visual reference comparisons remain a separate review activity.

## Local checks

```sh
corepack yarn check
python3 -m unittest discover -s scripts/android-tests -p 'test_*.py' -v
python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v
node scripts/run-ios-qwerty-tests.mjs SIMULATOR_UDID testIndependentTransparencyPasses
```

Use the device IDs and Metro port reported by Stim. Supply XCTest method names for
focused checks; omitting them runs the full retained iOS interaction suite. For
harness-only changes, run focused local regressions and use GitHub to validate its
runner-specific conditions. Broaden local testing when production keyboard changes
or a concrete failure warrants it. Evidence is saved under `artifacts/` and is not
published with the library.

The iPad dollar UI comparison explicitly slides into the currency popup before release: Apple's stationary dollar hold can show a highlighted choice yet commit nothing on CI. The non-empty native result and exact Keyflow output comparison remain required. A separate rendering regression preserves coverage of Keyflow's stationary dollar hold and release.

## Timing and readiness

iOS gesture tests wait for native attachment, mode and focus after input remounts.
They select accessibility keys from the requested keyboard and observe sustained
key/editor geometry before freezing screen coordinates for a gesture. Page,
mode, remount and viewport changes invalidate the settled geometry. Text-changing
gestures wait for the actual edit; missed gestures remain failures.

A rendering regression checks that animated accessory layout never starts implicit
animations on the static clipping mask. Keyboard presentation and trackpad fades
remain enabled. The remount integration regression types through repeated
system/custom switches into new inputs.

Android held-delete checks require repeated deletion and release without assuming
a fixed callback count within a timed hold. Pad insertion follows the editor's
reported selection, including a caret in the middle. Neither platform replays a
failed editing gesture to turn it into a pass. Android inspection results carry
request IDs so stale snapshots, switching reports and pending empty results cannot
be mistaken for a completed metric read. Hook lifecycle cleanup runs before new
native configuration, including effect remounts and Fast Refresh.
