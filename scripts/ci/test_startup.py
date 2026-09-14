import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from startup import warm_bundle


class BundleWarmupTests(unittest.TestCase):
    def manifest(self, url="http://127.0.0.1:8084/entry.bundle?platform=android"):
        return io.BytesIO(json.dumps({"launchAsset": {"url": url}}).encode())

    def test_warms_manifest_selected_bundle(self):
        with patch(
            "startup.urllib.request.urlopen",
            side_effect=[self.manifest(), io.BytesIO(b"compiled bundle")],
        ) as request:
            self.assertEqual(warm_bundle(8084)["bundleBytes"], 15)
            self.assertEqual(
                request.call_args_list[1].args[0],
                "http://127.0.0.1:8084/entry.bundle?platform=android",
            )

    def test_empty_bundle_is_not_ready(self):
        with patch(
            "startup.urllib.request.urlopen",
            side_effect=[self.manifest(), io.BytesIO(b"")],
        ):
            with self.assertRaisesRegex(ValueError, "empty"):
                warm_bundle(8084)

    def test_transform_error_fails_setup(self):
        failure = HTTPError(
            "http://127.0.0.1:8084/entry.bundle", 500, "transform failed", {}, None
        )
        with patch(
            "startup.urllib.request.urlopen", side_effect=[self.manifest(), failure]
        ):
            with self.assertRaises(HTTPError):
                warm_bundle(8084)

    def test_manifest_cannot_redirect_warmup_to_another_server(self):
        with patch(
            "startup.urllib.request.urlopen",
            return_value=self.manifest("https://example.com/bundle"),
        ):
            with self.assertRaisesRegex(ValueError, "local server"):
                warm_bundle(8084)

    def test_ios_uses_its_own_manifest(self):
        with patch(
            "startup.urllib.request.urlopen",
            side_effect=[self.manifest(), io.BytesIO(b"ios")],
        ) as request:
            self.assertEqual(warm_bundle(8084, "ios")["bundleBytes"], 3)
            self.assertEqual(
                request.call_args_list[0].args[0].get_header("Expo-platform"), "ios"
            )
