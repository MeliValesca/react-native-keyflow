#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
keyflow_model="$1"
shift
keyflow_profile="${KEYFLOW_CI_PROFILE:-full}"
[[ "$keyflow_profile" == full || "$keyflow_profile" == smoke ]]
if [[ "$keyflow_profile" == smoke ]]; then
  set -- testKeyflowCoreInteractions testFocusedHookUnmountDoesNotShowSystemKeyboard
elif [[ "${1:-}" == "--shard" ]]; then
  [[ "$#" == 2 ]]
  keyflow_test_names=$(node scripts/ci/ios-interaction-shards.mjs "$2")
  read -r -a keyflow_tests <<< "$keyflow_test_names"
  [[ "${#keyflow_tests[@]}" -gt 0 ]]
  set -- "${keyflow_tests[@]}"
fi
keyflow_build="${KEYFLOW_IOS_BUILD:-artifacts/ci/ios}"
keyflow_output="artifacts/ios-ui"
mkdir -p "$keyflow_output"
(cd example && stim start --json) > "$keyflow_output/metro.json"
keyflow_port=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["port"])' "$keyflow_output/metro.json")
python3 scripts/ci/startup.py "$keyflow_port" ios > "$keyflow_output/bundle-warmup.json"
node scripts/launch-ios-ci.mjs "$keyflow_model" "$keyflow_build" "$keyflow_output"
keyflow_udid=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["udid"])' "$keyflow_output/device.json")
capture_app_log() {
  xcrun simctl spawn "$keyflow_udid" log show --style compact --last 30m \
    --predicate 'process == "Keyflow"' > "$keyflow_output/app.log" 2>&1 || true
}
trap capture_app_log EXIT
# Both XCTest products were compiled by the producer; no project/Pods are needed.
keyflow_rendering=("$keyflow_build"/rendering/Products/*.xctestrun)
keyflow_interactions=("$keyflow_build"/qwerty/Products/*.xctestrun)
[[ ${#keyflow_rendering[@]} == 1 && -f "${keyflow_rendering[0]}" ]]
[[ ${#keyflow_interactions[@]} == 1 && -f "${keyflow_interactions[0]}" ]]
export KEYFLOW_IOS_XCTESTRUN="${keyflow_interactions[0]}"
export TEST_RUNNER_KEYFLOW_METRO_URL="http://127.0.0.1:$keyflow_port/?disableOnboarding=1"
# The focused device regression runs first in PRs and fails immediately.
if [[ "$keyflow_profile" == smoke ]]; then
  node scripts/run-ios-qwerty-tests.mjs "$keyflow_udid" "$@"
fi
keyflow_render_status=0
xcodebuild test-without-building -xctestrun "${keyflow_rendering[0]}" \
  -destination "platform=iOS Simulator,id=$keyflow_udid" \
  -resultBundlePath "$keyflow_output/rendering.xcresult" \
  -parallel-testing-enabled NO || keyflow_render_status=$?
keyflow_ui_status=0
if [[ "$keyflow_profile" == full ]]; then
  node scripts/run-ios-qwerty-tests.mjs "$keyflow_udid" "$@" || keyflow_ui_status=$?
fi
[[ "$keyflow_render_status" == 0 && "$keyflow_ui_status" == 0 ]]
