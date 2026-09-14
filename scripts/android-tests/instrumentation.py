"""Run the already-built native test APK, preserving individual JUnit results."""

import os
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET


def parse_results(output):
    status = {}
    cases = []
    started = set()
    completed = set()
    expected = None
    for line in output.splitlines():
        match = re.match(r"INSTRUMENTATION_STATUS: ([^=]+)=(.*)", line)
        if match:
            status[match[1]] = match[2]
        elif line.startswith("INSTRUMENTATION_STATUS_CODE:"):
            code = int(line.split(":", 1)[1])
            if "numtests" in status:
                expected = int(status["numtests"])
            identity = (status.get("class"), status.get("test"))
            if all(identity):
                if code == 1:
                    started.add(identity)
                else:
                    cases.append((identity, code, dict(status)))
                    completed.add(identity)
            status = {}
    if not cases or started != completed:
        raise ValueError("Native instrumentation did not complete every started test")
    if expected is not None and len(cases) != expected:
        raise ValueError(f"Expected {expected} native tests, received {len(cases)}")
    if len(cases) != len(completed):
        raise ValueError("Duplicate native test results")
    if not re.search(r"^INSTRUMENTATION_CODE: -1\s*$", output, re.MULTILINE):
        raise ValueError("Native instrumentation did not finish successfully")
    return cases


def report(output, destination):
    cases = parse_results(output)
    suite = ET.Element("testsuite", name="Android native", tests=str(len(cases)))
    failed = 0
    skipped = 0
    for (class_name, name), code, status in cases:
        case = ET.SubElement(suite, "testcase", classname=class_name, name=name)
        if code in (-3, -4):
            ET.SubElement(case, "skipped", message=status.get("stream", "Skipped"))
            skipped += 1
        elif code != 0:
            ET.SubElement(case, "failure", message=status.get("stack", str(code)))
            failed += 1
    suite.set("failures", str(failed))
    suite.set("skipped", str(skipped))
    ET.ElementTree(suite).write(destination, encoding="utf-8", xml_declaration=True)
    if failed or skipped == len(cases):
        raise ValueError(
            f"Native tests: {failed} failed, {skipped}/{len(cases)} skipped"
        )
    return len(cases)


if __name__ == "__main__":
    serial = os.environ["KEYFLOW_ANDROID_SERIAL"]
    output_dir = Path(sys.argv[1])
    output_dir.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "adb",
            "-s",
            serial,
            "shell",
            "am",
            "instrument",
            "-w",
            "-r",
            "com.keyflow.test/androidx.test.runner.AndroidJUnitRunner",
        ],
        capture_output=True,
        text=True,
        timeout=600,
    )
    output = result.stdout + result.stderr
    (output_dir / "native-tests.log").write_text(output)
    print(output, flush=True)
    result.check_returncode()
    count = report(output, output_dir / "native-tests.xml")
    print(f"Completed {count} native tests without rebuilding")
