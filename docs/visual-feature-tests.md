# Visual feature tests

Use the Stim-built example and the pinned English reference devices: iPhone 17
on iOS 26.5 (402×874 pt, screenshots at 3×) and the Android 16 emulator with
Gboard 15.1 (411×914). Device/OS, locale, theme and keyboard settings are part of
the fixture. Other devices need their own reviewed reference captures.

## Run

Open **Compare native interactions**, use light appearance, and leave the test
device untouched during automation. Define `AGENT_DEVICE` and `ADB` if the tools
are not on PATH. Run timing suites one platform at a time on an otherwise idle
host; do not run two suites on one device. Recording and competing simulator
work can reduce frame delivery. Keep failed timing recordings for investigation;
do not lower frame assertions just to make a busy-host run pass.

```sh
yarn test:features ios keyflow 30AB82B2-209E-49AE-8673-F722465C7752
yarn test:features android keyflow-android emulator-5568
yarn test:features:report
```

The runner selects the installed Gboard reference on Android, stops on failure,
and saves its command results. It runs native and
Keyflow typing comparisons, the held-state catalogue, and platform-specific
gestures, then navigates through transition, customization, default geometry and
light/dark contrast fixtures. The iOS XCTest run retains screenshots and a recording; Android saves
press-preview and accent-drag screenshots. The report is
`artifacts/features/index.html`: filter by platform or feature, compare pairs,
and expand the released states. Click an image for full resolution.

For the additional fixture screens:

```sh
# Open Test keyboard transitions, with Material: Flat.
yarn test:visual:transitions ios keyflow 30AB82B2-209E-49AE-8673-F722465C7752
yarn test:visual:transitions android keyflow-android emulator-5568
# Open Customize fonts & test layouts.
yarn test:visual:customization ios keyflow
yarn test:visual:customization android keyflow-android
# Open default Keyboard playground, light, with an empty editor.
yarn test:visual:accents ios keyflow 30AB82B2-209E-49AE-8673-F722465C7752
yarn test:visual:accents android keyflow-android emulator-5568
```

Transition tests record the actual motion and require the example's layout,
show/hide duration, avoiding-view, switching and interruption assertions to pass.
Customization captures 18 font/size/material combinations, then runs the existing
76-theme geometry, fallback-font and section-override matrix. See
`native-parity.md` for the separate light/dark default geometry comparisons and
wallpaper/transparency fixtures.

## What is asserted

| Feature                                              | Assertion and visual evidence                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial case, Shift, Caps Lock, sentence case        | Exact inserted text and native/custom screenshots                                                                                                       |
| Double-space punctuation, symbols, return to letters | Exact text, page screenshots, iOS XCTest attachments                                                                                                    |
| Accent catalogue                                     | Every independently recorded iOS row, including distinct uppercase I/S; all Android letter holds and number hints                                       |
| Long press                                           | Captures during the hold and after release; held-state change must exist; every unselected and selected iOS accent must have visible foreground strokes |
| Accent selection                                     | Native/custom continuous drag results; Android selected-row screenshots; iOS attachments and recording                                                  |
| Drag cancellation                                    | iOS drag outside keyboard must preserve text                                                                                                            |
| Shift/number drags and space trackpad                | Continuous gestures, exact text/caret outcome and screenshot attachments                                                                                |
| Grapheme and held deletion                           | Whole grapheme removal, repeated deletion, stopping on release, and empty-field cleanup                                                                 |
| Return and switching                                 | Focus, text, selection and keyboard-window state; screenshots                                                                                           |
| Transitions                                          | Six show/hide cycles, four switches, six interrupted transitions, layout metrics and video                                                              |
| Fonts and material customization                     | Boundary geometry assertions and 18 screenshots per platform                                                                                            |

The separate [layout customization suite](customization-layout-tests.md) expands customization coverage to all number pads and both landscape directions, with 108 idle/held/released screenshots per platform.

## Visual regression versus native comparison

A functional PASS does **not** certify visual identity. Focused reruns are
available without discarding failure evidence:

```sh
node scripts/run-ios-qwerty-tests.mjs IOS_UDID testSymbolPagesMatchApple
node scripts/visual/long-press.mjs android SESSION EMULATOR z,x,c,v,b,n,m,space,delete
```

A focused hold run writes `long-press-focused`, leaving the full run intact.
`visual/ios-results.mjs` and `visual/merge-holds.mjs` can combine explicitly listed
full/focused results; the report labels verification across runs and retains each
source. Run a full suite after broad implementation changes.

A functional PASS does **not** certify visual identity. Held-state change checks
also do not prove matching popup contours or timing. Native/custom pairs remain
labelled for visual review; pixel checks have narrower, explicit assertions.
Physical haptics, screen-reader behavior, other IMEs, locale variants and private
OS prediction/swipe features are not certified by this simulator suite.

After reviewing a screenshot, keep it as a baseline outside the current capture
folder. The comparator never approves, replaces, or creates baselines itself:

```sh
yarn test:visual:compare reviewed-state.png current-state.png artifacts/state-diff
```

This rejects different device sizes, excludes editor/status-bar pixels, tolerates
up to 12 channel levels, and fails above 0.5% changed keyboard-region pixels. It
writes a magenta diff and JSON metrics. Use the same appearance, case, held key,
and fixture in both images. A changed OS/IME reference needs human review, not
an automatic baseline refresh. `yarn check` includes unit tests proving that the
diff detects missing foreground and ignores changes outside the keyboard.

Dedicated pads and phone rotation use the separate
[layout suite](keyboard-layouts.md): `yarn test:visual:layouts`. Its native/custom
gallery is `artifacts/layouts/index.html`; these checks are not implicitly
included in the portrait QWERTY orchestrator.
