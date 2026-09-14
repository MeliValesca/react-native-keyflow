# Customization across keyboard layouts

The example's **Customize fonts & test layouts** screen supports QWERTY, Number, Decimal, and Phone. Rotate to either landscape direction, then use **Run 58** to test the selected layout. The field and test controls remain accessible in landscape. **Themes** cycles through the flat and raised visual profiles over a photo background.

The device suite runs twelve matrices per platform: four layouts × portrait/landscape-left/landscape-right. Each matrix checks 58 themes:

- 48 font/material/size/radius combinations: five available fonts plus a missing-font fallback, two materials, 12/32-point preferred sizes, 0/24-point radii, bold weight, and maximum raised depth.
- Four section overrides covering foreground, background, pressed color, icon color/size, border, font, and radius boundaries.
- Six material/opacity combinations using 0%, 35%, and 100% panel opacity.

Each theme must preserve keyboard dimensions, editor text, selection, and focus, with no reported key overlap, main-label overflow, or telephone-alphabet overflow. iOS also checks that the bundled font resolves for both main labels and telephone alphabets.

For every layout/orientation, the runner captures flat and raised profiles in idle, held, and released states. Flat-profile pixel assertions verify background, text, and icon colors; pressed-state assertions verify the configured solid color on iOS and its native ripple composition on Android. Release must restore the idle background. These use real Delete holds after seeding text on QWERTY, and real `2` holds on pads.

## Run

Build the example after native diagnostic changes, using Stim. Both suites navigate to the customization screen automatically:

```sh
AGENT_DEVICE=/path/to/agent-device yarn test:visual:customization-layouts ios keyflow 30AB82B2-209E-49AE-8673-F722465C7752
ADB=/path/to/adb AGENT_DEVICE=/path/to/agent-device yarn test:visual:customization-layouts android keyflow-android emulator-5568
node scripts/visual/customization-held-text.mjs ios
node scripts/visual/customization-held-text.mjs android
yarn test:visual:customization-layouts:report
```

Use the device IDs reported by your workspace's Stim session. One suite per device may run at a time; avoid Fast Refresh edits while tests run. The screenshot sampling assumes the recorded 402-point iPhone and 411dp Android reference devices. Theme geometry assertions read native metrics rather than fixed key positions.

Results and screenshots are saved under `artifacts/customization-layouts/`, with an HTML gallery at `artifacts/customization-layouts/index.html`. Previous failed runs remain available. An optional final argument such as `landscape-left/number-pad` resumes at that scenario; its result records the starting point and is not presented as a complete twelve-matrix run.

This suite tests the primary page of each layout. Symbol/alternate-page interactions, accent popups, and animation timing retain their separate suites. Screenshots support visual review; these checks do not assert that every customized theme matches the native keyboard's appearance.

The independent foreground checker verifies the configured pressed white and restored text/icon colors in all 48 held/released captures per platform, across all two materials.

To combine an interrupted run with a resumed run, use `node scripts/visual/merge-customization-layouts.mjs ios /path/to/first/results.json /path/to/resumed/results.json`. This only reports PASS when every scenario has all 58 theme cases, six interaction assertions, and six captures. The gallery retains links to the original results, including failures.

The earlier full-matrix recordings in `artifacts/customization-layouts/` include retired material cases. The current runner requires 58 themes and six held-state captures per layout/orientation.
