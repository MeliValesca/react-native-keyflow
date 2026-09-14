"""Warm the exact platform launch bundle from Metro's Expo manifest once per suite."""

import json
import sys
import time
import urllib.parse
import urllib.request


def warm_bundle(port, platform="android"):
    if platform not in ("android", "ios"):
        raise ValueError("Expected android or ios platform")
    origin = f"http://127.0.0.1:{int(port)}"
    started = time.monotonic()
    request = urllib.request.Request(
        origin, headers={"expo-platform": platform, "accept": "application/expo+json"}
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        manifest = json.load(response)
    bundle = manifest["launchAsset"]["url"]
    if urllib.parse.urlsplit(bundle).netloc != urllib.parse.urlsplit(origin).netloc:
        raise ValueError("Metro launch asset must use the requested local server")
    size = 0
    with urllib.request.urlopen(bundle, timeout=180) as response:
        while chunk := response.read(64 * 1024):
            size += len(chunk)
    if not size:
        raise ValueError("Metro returned an empty launch bundle")
    return {"bundleBytes": size, "seconds": round(time.monotonic() - started, 2)}


if __name__ == "__main__":
    print(
        json.dumps(
            warm_bundle(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "android")
        )
    )
