import tempfile
from pathlib import Path
import unittest
from instrumentation import report


def case(name, result=0):
    return (
        f"INSTRUMENTATION_STATUS: class=KeyboardTests\n"
        f"INSTRUMENTATION_STATUS: test={name}\nINSTRUMENTATION_STATUS_CODE: 1\n"
        f"INSTRUMENTATION_STATUS: class=KeyboardTests\n"
        f"INSTRUMENTATION_STATUS: test={name}\nINSTRUMENTATION_STATUS_CODE: {result}\n"
    )


class InstrumentationTests(unittest.TestCase):
    def check(self, output):
        with tempfile.TemporaryDirectory() as directory:
            return report(output, Path(directory) / "results.xml")

    def test_individual_results_are_preserved(self):
        self.assertEqual(
            self.check(
                case("letters") + case("accents") + "INSTRUMENTATION_CODE: -1\n"
            ),
            2,
        )

    def test_failed_test_is_not_hidden_by_successful_adb_exit(self):
        with self.assertRaisesRegex(ValueError, "1 failed"):
            self.check(case("overflow", -2) + "INSTRUMENTATION_CODE: -1\n")

    def test_crash_or_truncated_run_fails(self):
        for output in [
            "",
            case("first"),
            case("first")
            + "INSTRUMENTATION_STATUS: class=KeyboardTests\nINSTRUMENTATION_STATUS: test=unfinished\nINSTRUMENTATION_STATUS_CODE: 1\nINSTRUMENTATION_CODE: -1\n",
        ]:
            with self.subTest(output=output), self.assertRaises(ValueError):
                self.check(output)

    def test_all_skipped_is_not_a_pass(self):
        with self.assertRaisesRegex(ValueError, "skipped"):
            self.check(case("letters", -3) + "INSTRUMENTATION_CODE: -1\n")

    def test_missing_declared_cases_cannot_pass(self):
        output = case("only") + "INSTRUMENTATION_CODE: -1\n"
        output = output.replace(
            "INSTRUMENTATION_STATUS_CODE: 1",
            "INSTRUMENTATION_STATUS: numtests=2\nINSTRUMENTATION_STATUS_CODE: 1",
        )
        with self.assertRaisesRegex(ValueError, "Expected 2"):
            self.check(output)
