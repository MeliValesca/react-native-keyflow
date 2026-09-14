# Automated coverage and its limits

## Required device suite

The device suite retains the pre-release test inventory recorded in
[`baseline-tests.json`](../scripts/ci/baseline-tests.json),
plus four Android regressions for disappearing glyphs, eight for Android modifier states, five for iOS modifier states, three iOS held-delete cases, and nine space/trackpad feedback cases and one iPad stationary currency-hold case. The tests run against the
current keyboard implementation. There is no optional expanded suite or runtime
filter hiding additional cases.

| Device         | Required cases before platform-specific skips                 |
| -------------- | ------------------------------------------------------------- |
| Android phone  | 48 original + 4 glyph + 8 Shift + 3 trackpad regressions = 63 |
| Android tablet | 48 original + 4 glyph + 8 Shift + 3 trackpad regressions = 63 |
| iPhone         | 50 rendering + 60 interaction cases                           |
| iPad           | 50 rendering + 60 interaction cases                           |

`scripts/ci/baseline-tests.json` records the original inventory for verification.
A fast workflow test checks that the actual device sources contain precisely that
inventory plus the seventeen retained glyph/modifier cases plus three held-delete lifecycle cases and nine space/trackpad feedback cases and one iPad stationary currency-hold case. It does not select or skip tests.

iOS coverage includes typing, symbol pages, long presses, accent selection,
number pads, tablet layouts, customization, transparency and transition diagnostics.
Android native coverage includes layouts, input, accent interactions and press-release
styling. The four additional cases verify actual visible glyph pixels in flat and
raised materials, both at rest and while pressed. Shift regressions check left/right activation, filled-arrow pixels, one-letter reset, independent Android Caps Lock/Shift activation, shifted punctuation output, and the separate automatic-capitalization state. iPad regressions verify its distinct modifier behavior and `! ?` punctuation, including accessibility labels and rendered attachments. Phone regressions check persistent uppercase and the distinct Caps Lock glyph on both platforms.

Space/trackpad regressions verify iOS touch-down fill contrast, normal release and custom-color cancellation, legend and key-face fading, restoration during an interrupted fade, and restoration after cursor dragging. Android tests compare rendered space-bar pixels during cursor movement in flat and raised materials, and verify that release or cancellation restores the resting color without inserting a space.

The newer Android React Native app automation, additional accessibility/window
suites and iOS allocation/performance/background cases were removed. Android
example-level lifecycle, transparency and transition performance are therefore
not automated PR guarantees. The example screens remain available for manual testing.

Fast unit regressions remain for input readiness, rotation/frame ordering, stable
keyboard geometry and mode handoffs. CI helper tests reject incomplete native test
results and validate shared-build handling and simulator startup failures.

## Build once, test on each device

The workflow has one Android producer and one iOS producer. Each builds the app
and test binaries once; phone and tablet jobs download those products from the
same run. Device jobs contain no Gradle, CocoaPods or native compilation. Missing
or mismatched artifacts fail instead of silently rebuilding. iOS also verifies
the Xcode version and uses `test-without-building`.

Android runs the installed native instrumentation APK and emits individual JUnit
results. It needs no Metro server. iOS uses Stim for Metro and installs the shared
app with simulator tools. Local development continues to use Stim normally.

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
