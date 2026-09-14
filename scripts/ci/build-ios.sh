#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
keyflow_output="${KEYFLOW_IOS_BUILD_OUTPUT:-artifacts/ci/ios}"
mkdir -p "$keyflow_output"
keyflow_output=$(cd "$keyflow_output" && pwd)
keyflow_derived="$keyflow_output/derived"
keyflow_arch="${KEYFLOW_IOS_ARCH:-arm64}"
xcodebuild -workspace example/ios/Keyflow.xcworkspace -scheme Keyflow \
  -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$keyflow_derived/app" ARCHS="$keyflow_arch" ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO COMPILATION_CACHE_ENABLE_CACHING=YES \
  "COMPILATION_CACHE_CAS_PATH=$HOME/.stim/compilation-cache" build
rm -rf "$keyflow_output/Keyflow.app"
cp -R "$keyflow_derived/app/Build/Products/Debug-iphonesimulator/Keyflow.app" "$keyflow_output/Keyflow.app"
ruby scripts/ios-tests/create-rendering-project.rb
ruby scripts/ios-tests/create-project.rb
for keyflow_suite in rendering qwerty; do
  if [[ "$keyflow_suite" == rendering ]]; then keyflow_scheme=RenderingTests; else keyflow_scheme=QwertyTests; fi
  xcodebuild build-for-testing \
    -project "artifacts/ios-$keyflow_suite-tests/$keyflow_scheme.xcodeproj" \
    -scheme "$keyflow_scheme" -configuration Debug -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath "$keyflow_derived/$keyflow_suite" \
    ARCHS="$keyflow_arch" ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO
  mkdir -p "$keyflow_output/$keyflow_suite"
  rm -rf "$keyflow_output/$keyflow_suite/Products"
  cp -R "$keyflow_derived/$keyflow_suite/Build/Products" "$keyflow_output/$keyflow_suite/Products"
done
git rev-parse HEAD > "$keyflow_output/build-commit.txt"
xcodebuild -version > "$keyflow_output/xcode-version.txt"
# Transfer products only, never the intermediate object files or dependency tree.
tar -czf "$keyflow_output/../ios-test-build.tar.gz" -C "$keyflow_output" \
  Keyflow.app rendering qwerty build-commit.txt xcode-version.txt
