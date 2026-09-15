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

## Android React Native app suite

Start and launch the current example with Stim from `example/`. Use the normal docked software keyboard for native comparisons; dismiss input tutorials and turn off handwriting-only or floating modes on local AVDs. CI uses a clean emulator image. The app runner records and closes Expo’s first-launch developer menu before testing. It can select Wait once for a startup System UI ANR, then requires the lab to appear; application ANRs remain failures. Layout expectations use the reported natural screen orientation, including landscape tablets. Then, from the repository root, use the owned device serial reported by Stim:

```sh
KEYFLOW_ANDROID_SERIAL=emulator-XXXX corepack yarn test:device:android:app
```

The suite navigates the actual example and runs every integration group on either phone or tablet. It uses reported key geometry rather than fixed coordinates. Reports, screenshots, UI hierarchies, and logcat are saved under `artifacts/android-app/`. CI installs the shared example APK, starts Metro, warms the Android bundle once, and runs this suite after native instrumentation. Either suite failing fails the device job.

## Local iOS rotation checks

Landscape cases require the simulator home screen to rotate as well as the app. If XCTest reports a landscape sensor orientation while SpringBoard and the app both retain portrait bounds, restart only the owned simulator before rerunning. The rotation helper waits for stable app bounds and captures the orientation and screenshot on failure; it does not replay the rotation or skip the case. CI starts isolated simulator instances.

## Continuous integration

The repository includes two automatic GitHub Actions workflows and an optional manual comparison workflow:

- **Library checks** runs formatting, both TypeScript projects, Jest, visual-helper unit tests, source-integrity checks, and package generation on pull requests and pushes to `main` with code changes.
- **Native builds and device tests** builds the Android example/test APKs and iOS app/XCTest bundles once, then shares them with parallel phone and tablet jobs. Device jobs install those artifacts and run native tests plus the actual React Native example without compiling again. Focused Android glyph and cross-platform modifier-state regressions supplement that inventory; see [coverage](coverage.md) for the exact retained suite. There is no optional expanded suite. Platform filtering avoids unrelated work; weekly runs add larger iOS devices and an older Android API. The seven protected check names stay unchanged.
- **Native keyboard regression** is a manual workflow for the real simulator/emulator comparisons. It builds and launches the current checkout, runs the phone feature suites, optionally runs both tablet matrices, and uploads screenshots, videos, metrics, reports, and Stim logs for 30 days.

CI uses isolated GitHub-hosted runners for each job. Android device jobs run on
Ubuntu with KVM; iOS device jobs run on macOS. Local visual comparisons still need
configured reference keyboards and the devices reported by Stim.

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

## Which changes run tests?

PRs use the full branch diff against the base branch. Pushes to `main` compare
before and after the push, including all commits in that push.

| Changed files                                                                    | Suites                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------- |
| Markdown or images/videos under `docs/media/` only                               | No code suites                                 |
| iOS native code or iOS-specific test/build helpers                               | Library checks and iOS phone/tablet suites     |
| Android native code or Android-specific test helpers                             | Library checks and Android phone/tablet suites |
| Shared source, example code/assets, dependencies, CI workflows, or unknown paths | All suites                                     |

Documentation changes mixed with code do not broaden the code’s platform scope.
`docs/package.json` is a dependency input, not documentation, so it runs all suites.
Manual and scheduled runs always run everything. An empty diff, initial push, or
failed scope detection never silently skips tests.

Required check names and branch protection stay unchanged. Unaffected build/library
jobs are skipped; device check entries report that no relevant changes were found
without installing dependencies, building binaries, or launching a simulator.

### Overlapping pushes

PR workflows fingerprint the merged file contents (including file modes), excluding
Markdown and documentation media. The PR base commit and title are also included.
Within the same PR and workflow, a completed successful run with identical inputs can be reused. The scope summary links to its original evidence. Queued or running jobs are never awaited for reuse.

Missing or expired evidence, API errors, failures, or cancellation fall back to running tests. Fingerprint artifacts expire after seven days; lookup is limited to the most recent 100 PR runs of the workflow. Manual, scheduled, and main runs do not reuse results. Changes to code, dependencies, tests, CI, or the PR base invalidate reuse. Reuse currently applies to the whole workflow, not separate platform results. Required checks retain their names on the latest commit.

Automatic workflows use a concurrency group per workflow and PR or branch, with cancellation enabled. A newer revision cancels superseded runs. Android and iOS build jobs within the latest run remain parallel; each device job waits only for its own platform's shared build. Runner capacity can still queue a job. The separate manual native comparison workflow retains its device-lab concurrency policy.

The required iPad CI check combines two independent device jobs. They partition all interaction methods exactly once, each uses its own simulator and the shared compiled binaries, and both must pass. This bounds runtime without reducing coverage or replaying failures. Each job runs the rendering suite before its interaction shard.

The iOS interaction runner holds a temporary idle-sleep assertion for its lifetime and has a 30-minute process deadline, followed by bounded artifact export. This prevents laptop sleep from suspending event synthesis and ensures a stuck XCTest process reports failure before the CI job timeout. The assertion ends with the runner; system power preferences are unchanged.
