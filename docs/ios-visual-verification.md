# iOS keyboard visual calibration

Measured on September 8, 2026 using the same Keyflow example editor on **iPhone 17, iOS 26.5, English QWERTY, portrait, 402 × 874 points at 3× scale**. Apple references are actual system-keyboard screenshots exported through Simulator's **File → Save Screen…**, at 1206 × 2622 pixels.

## Changes

- Pixel-aligned horizontal key edges, 43-point faces in 54-point rows, 8-point corner radius, and corrected number-page spacing.
- 22-point capitals/digits and 25-point lowercase at the default size, with separate optical baselines and punctuation sizing. Caption changes invalidate layout immediately, including Shift and automatic case changes.
- Calibrated public system-font widths, with additional compensation for round capitals. Custom font families retain their own design and width; text fits within the unchanged key geometry.
- Light panel color sampled from the reference: `#E0E2E7`. Existing dark panel/key colors remain `#404143` / `#5E5F61`.

## Measured results

Errors below are **physical pixels**, not points. Glyph errors measure the visible ink bounding box's x, y, width, and height, averaged across those four quantities and all nonempty keys. They do not measure identical glyph contours.

| Capture                 | Key faces | Maximum face-bound error | Mean glyph-bound error | Maximum glyph-bound error |
| ----------------------- | --------: | -----------------------: | ---------------------: | ------------------------: |
| Original light keyboard |        31 |                     3 px |                2.18 px |                      9 px |
| Updated light capitals  |        31 |                     0 px |                0.72 px |                      4 px |
| Updated light lowercase |        31 |                     0 px |                0.53 px |                      3 px |
| Updated numbers         |        30 |                     0 px |                0.87 px |                      4 px |
| Updated dark capitals   |        31 |                     0 px |                0.83 px |                      4 px |

[Side-by-side comparison](../artifacts/ios26-keyboards-side-by-side.png): Apple on the left, Keyflow on the right; light above dark. The export includes pixels outside the physical device's rounded screen mask, so the panel's bottom-corner backgrounds visibly differ there.

Machine-readable per-key reports are `artifacts/ios26-{uppercase,lowercase,numbers,dark}-comparison.json`. Full screenshots are stored alongside them. The default keyboard typeface and icon contours remain approximations: Apple's internal keyboard face did not resolve through public `UIFont` name/family lookup in this runtime. Keyflow uses public system-font APIs and ships no Apple font binary. Apple's [documented default font design](https://developer.apple.com/documentation/uikit/uifontdescriptor/systemdesign/default) is SF Pro on iOS.

## Repeat the comparison

Capture matching keyboard states at the exact viewport above. Leave **Apply device mask** unchecked and use the default theme/font size. Run:

```sh
yarn test:visual:ios artifacts/apple-ios26-light-reference.png artifacts/keyflow-ios26-light-verified.png artifacts/ios26-uppercase-comparison.json
```

## Functional regression checks

Results are preserved in `artifacts/ios26-visual-functional-results.json`. The final native build launched `com.keyflow.example` on Stim device `30AB82B2-209E-49AE-8673-F722465C7752` in 20.1 seconds, using incremental compilation; Xcode did not expose reliable cache-hit statistics. Metro error checks passed. The workspace's formatting, TypeScript, 36 unit tests, and package build passed. Android native code was unchanged in this calibration.
