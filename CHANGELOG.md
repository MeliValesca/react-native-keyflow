# Changelog

# [0.2.0](https://github.com/MeliValesca/react-native-keyflow/compare/v0.1.1...v0.2.0) (2026-09-14)

### Breaking Changes

- Replace the library-owned `KeyflowKeyboard` text input with `useKeyflow`, which attaches Keyflow to an app-owned React Native `TextInput`.
- Rename public theme APIs from keyboard-specific names to Keyflow names, including the `keyflowTheme` option and `KeyflowTheme` types and helpers.

### Bug Fixes

- Support inputs mounted after Keyflow configuration ([85485cc](https://github.com/MeliValesca/react-native-keyflow/commit/85485cca33338015b35ea221d05a90e70893c469))

## [0.1.1](https://github.com/MeliValesca/react-native-keyflow/releases/tag/v0.1.1) (2026-09-14)

- Initial npm release.
