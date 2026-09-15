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
adb -s "$KEYFLOW_ANDROID_SERIAL" install -r "$keyflow_build/example.apk"
(cd example && stim start --json) > "$keyflow_output/metro.json"
keyflow_port=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["port"])' "$keyflow_output/metro.json")
python3 scripts/ci/startup.py "$keyflow_port" android > "$keyflow_output/bundle-warmup.json"
adb -s "$KEYFLOW_ANDROID_SERIAL" reverse "tcp:$keyflow_port" "tcp:$keyflow_port"
keyflow_url="exp+keyflow-example://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A$keyflow_port%2F%3FdisableOnboarding%3D1"
adb -s "$KEYFLOW_ANDROID_SERIAL" shell am force-stop com.keyflow.example
adb -s "$KEYFLOW_ANDROID_SERIAL" shell am start -W -a android.intent.action.VIEW -d "$keyflow_url" com.keyflow.example
# Previously failing app groups run first and fail immediately. Native tests
# remain required once the app suite passes; neither product is rebuilt here.
python3 scripts/android-tests/app.py "$keyflow_output"
adb -s "$KEYFLOW_ANDROID_SERIAL" install -r "$keyflow_build/native-tests.apk"
python3 scripts/android-tests/instrumentation.py "$keyflow_output"
