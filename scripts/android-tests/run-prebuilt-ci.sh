#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
keyflow_build="${KEYFLOW_ANDROID_BUILD:-artifacts/ci/android}"
keyflow_output="${KEYFLOW_TEST_OUTPUT:-artifacts/android-app}"
mkdir -p "$keyflow_output"
test "$(cat "$keyflow_build/build-commit.txt")" = "$(git rev-parse HEAD)"
export KEYFLOW_ANDROID_SERIAL
KEYFLOW_ANDROID_SERIAL="${KEYFLOW_ANDROID_SERIAL:-$(adb devices | awk '/^emulator-.*device$/ { print $1 }')}"
if [[ ! "$KEYFLOW_ANDROID_SERIAL" =~ ^emulator-[0-9]+$ ]]; then
  echo 'Provide exactly one CI emulator or set KEYFLOW_ANDROID_SERIAL' >&2
  exit 1
fi
adb -s "$KEYFLOW_ANDROID_SERIAL" install -r "$keyflow_build/native-tests.apk"
python3 scripts/android-tests/instrumentation.py "$keyflow_output"
