# Test categories

See [automated coverage and limits](coverage.md) for the current PR gates, weekly device matrix and known limits. The dated results below are historical checks.

The example home groups manual checks into Behavior, Layouts and Appearance. Theme showcases remain separate from the checks.

| Category   | Example screens                                        | Automated coverage                                                                                           |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Behavior   | Compare native interactions; Test keyboard transitions | `yarn test:device:ios`, `yarn test:device:android`, `yarn test:visual:transitions`                           |
| Layouts    | Compare layouts & rotation; English & French keyboards | `yarn test:visual:layouts`, `yarn test:visual:languages <ios\|android> <session>`, `yarn test:languages:ios` |
| Appearance | Customize fonts & test layouts                         | `yarn test:visual:customization`, `yarn test:visual:customization-layouts`                                   |
| Library    | Theme resolution, geometry, language mapping           | `yarn test`, `yarn typecheck`                                                                                |

Device scripts require a running example and the appropriate device/session arguments; see [visual feature checks](visual-feature-tests.md), [layout customization](customization-layout-tests.md) and [language checks](languages.md).

## Continuous integration

The repository includes two automatic GitHub Actions workflows and an optional manual comparison workflow:

- **Library checks** runs formatting, both TypeScript projects, Jest, visual-helper unit tests, source-integrity checks, and package generation on every pull request and push to `main`.
- **Native builds and device tests** builds the Android example/test APKs and iOS app/XCTest bundles once, then shares them with parallel phone and tablet jobs. Device jobs install those artifacts and run the recorded baseline test inventory without compiling again. Focused Android glyph and cross-platform modifier-state regressions supplement that inventory; see [coverage](coverage.md) for the exact retained suite. There is no optional expanded suite. Platform filtering avoids unrelated work; weekly runs add larger iOS devices and an older Android API. The seven protected check names stay unchanged.
- **Native keyboard regression** is a manual workflow for the real simulator/emulator comparisons. It builds and launches the current checkout, runs the phone feature suites, optionally runs both tablet matrices, and uploads screenshots, videos, metrics, reports, and Stim logs for 30 days.

The device workflow needs a macOS self-hosted runner labeled `keyflow-mobile`. The runner must have Xcode, Android Studio/SDK, CocoaPods, Stim, and `agent-device`; Stim-owned iPhone, iPad, Android phone, and Android tablet devices; Gboard configured on Android; and the four `agent-device` sessions named by the workflow inputs. Supply both tablet device IDs when tablet tests are enabled. The Android tablet suite prepares Gboard and requires its real keys to be visible. The Android tablet must use an actual tablet hardware profile such as Pixel Tablet. A phone AVD with an overridden resolution is invalid because Gboard can retain its phone, external-keyboard, or floating-mode policy. Keep these reference devices on fixed OS, display-scale, locale, appearance, and keyboard versions so a baseline change reflects code rather than runner drift. The workflow serializes all device runs through one concurrency group because simulators, Metro, and keyboard state are shared resources.

Use **Native keyboard regression → Run workflow** in GitHub Actions and supply the iPhone Simulator UDID and Android emulator serial shown by `stim status`. Disable `run_tablets` while servicing a tablet runner. A device-suite failure still uploads the collected artifacts through the `always()` steps.

The obsolete dedicated suggestion XCTest was removed with the feature. Existing language tests retain a small UI absence check alongside typing, accents, rotation and system/custom handoff checks.

## Latest cleanup verification

After removing suggestion UI, styling and diagnostics: 77 Jest tests and TypeScript checks pass; both native examples build and launch. The iOS accent-drag comparison passes, and Android passes 44 language, rotation and system/custom handoff checks. Both category screens were visually inspected; captures are in `artifacts/example-categories/`. The standalone example installs and type-checks against the updated archive.

## iOS callout opening

`testRepeatedAccentPresentation` records repeated E/A/C holds on Apple and Keyflow; `testAccentDragMatchesApple` checks selection after dragging. The runner saves the full video so the opening is visible, not only the released state.

`python3 scripts/visual/callout-flicker.py <video> --start <seconds> --end <seconds> --x <pixel> --y <pixel>` checks a white interior patch throughout a known hold window. Choose the window and patch from the recording, avoiding glyphs and rounded edges. This is a light-theme regression, not a general dark-theme brightness check.

For the September 10 fix, the pre-fix capture fails (minimum brightness 208/255); the fixed capture passes all 120 sampled frames (minimum 253/255). Evidence is in `artifacts/callout-flicker/`. Both iOS interaction tests and 77 JavaScript tests pass.

`testLetterPreviewContours` adds recorded Q/E/P holds to cover centered and asymmetric edge callouts. The September 10 connected-contour change passes this test and the accent-drag comparison. Inspected crops are saved in `artifacts/preview-contour/`; the white-fill check also passes after the shape change.

## Current material checks

The supported materials are flat and raised. The transparent preset uses ordinary alpha colors, with visible bordered keycaps and independent background/key opacity sliders in the example.

The September 10 cleanup passes TypeScript, 71 unit tests, six visual-helper tests, formatting, both native builds, and the standalone example's install/type check. The iOS preview-contour and accent-drag comparisons pass; Android passes 58 customization themes with twelve visual captures.

The transparency example now checks editor overlap as well as key geometry. Both devices pass at 0%, 50%, 100%, and 25% opacity. Transparent-key themes retain accessory hosting at full panel opacity, keeping the iOS editor visible without reloading the input host during slider changes. Screenshots and measured bounds are in `artifacts/material-removal/`. This check covers opacity changes; it does not certify transparent accessory rotation parity.

## Translucent keycaps

The styled preset starts at 35% background opacity and 70% key opacity, with bordered keycaps and a visible space bar. Open **Make room for your style** in portrait with the wallpaper selected, then run:

```sh
AGENT_DEVICE=/path/to/agent-device yarn test:visual:transparency ios keyflow
AGENT_DEVICE=/path/to/agent-device yarn test:visual:transparency android keyflow-android
```

The regression covers background-only transparency, key-only transparency, both clear, both solid, intermediate values, and the styled default. Pixel checks verify that changing the panel leaves opaque keycaps unchanged and changing keys leaves the panel unchanged. It also checks space-bar input, stable key geometry, editor clearance, and no iOS input-host reload while dragging a translucent keyboard to both sliders at 100%. Screenshots and measured results are saved in `artifacts/features/<platform>/transparency/independent/`. Unit tests cover independent and combined alpha, unchanged text/icon colors, validation, and repeated theme updates without compounded opacity. Earlier shared-slider captures remain in the parent directory. Both platforms pass all seven opacity combinations and preserve editor clearance. The full project check passes 86 unit tests, six visual-helper tests, type checks, formatting, 27 reference-file checks, and the library build.

## App-owned custom fonts

Open **Your app. Your type.** in portrait, then run `AGENT_DEVICE=/path/to/agent-device yarn test:visual:custom-fonts <ios|android> <session>`. The test covers System / Quicksand Regular / Semibold / Bold switching, actual glyph-pixel changes, stable key bounds, preserved input, typing, and input clearance after dismissal/reopening. Both platforms use `KeyflowAvoidingView`. iOS also resolves the three exact UIFont faces. The Android diagnostic reports the configured family, so the separate pixel check rejects unchanged fallback glyphs. Results and screenshots are in `artifacts/features/<platform>/custom-font/`, including manually inspected accent-popup captures.

The iOS and Android production exports include all three local TTF assets. The library package contains no Quicksand font assets.

## Android example dependency patch

The example pins a Yarn patch for `react-native-screens` 4.26.2. Its Android
`NativeProxy` initializes the renderer's removal listener with `std::call_once`:
module initialization and the UI-thread resume callback can otherwise write the
same `shared_ptr` concurrently. Local cold-start testing recorded a SIGSEGV at
`MountingCoordinator::pullTransaction` while calling that listener.

The patch changes only the example's Android dependency, not Keyflow's package
or iOS implementation. Keep the patch file tracked with the lockfile so immutable
CI installs apply it. When upgrading screens, verify that upstream serializes
listener initialization before removing the patch. The device suites exercise
cold launches, background/resume, navigation, and customization on phone and tablet.
