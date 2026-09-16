# Changelog

## 0.4.0 (2026-09-16)

- Add customizable Return-key text and icons while preserving the native submit and multiline-newline behavior.
- Fix focused input teardown and transfer so remounting an input does not flash or dismiss the keyboard.
- Correct iOS single-line trackpad placement so the caret lands at the position selected by the user.
- Refine iOS accent selection geometry and refresh the interaction documentation with Story Studio examples.
- Restore the Android keyboard panel when refocusing an already attached input.

## 0.3.0 (2026-09-15)

- Breaking: `useKeyflow(options)` owns the input ref and returns `keyflowInputProps`, `inputRef`, `focus`, and `blur`. Apply the input props to your own styled React Native `TextInput`; `KeyflowAvoidingView` handles keyboard avoidance automatically.
- Support multiline inputs with horizontal and vertical space-hold trackpad movement and a floating caret during gestures.
- Improve iPhone accent selection, long-press haptics, and keyboard background coverage.
- Prepare native attachment before imperative focus, cancel pending focus on blur, and wait for example navigation/mount readiness before focusing remounted inputs. Add repeated multiline-remount and focus-order regressions.
- Keep native input presentation enabled on iOS so React Native does not install an empty input view that conflicts with Keyflow. Android still suppresses the system keyboard in custom mode.
- Separate required CI interaction checks from full native comparisons retained for local and scheduled testing. Keep local test displays awake and improve startup/failure diagnostics.
- Refresh all six README GIFs and MP4s, including current multiline trackpad examples.
