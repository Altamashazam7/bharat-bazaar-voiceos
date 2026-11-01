import json
from pathlib import Path
from typing import Any

from backend.app.services.order_workflow import process_audio


PROJECT_ROOT = Path(__file__).resolve().parents[3]
GROUND_TRUTH_PATH = PROJECT_ROOT / "eval" / "ground_truth.json"
SAMPLES_PATH = PROJECT_ROOT / "samples" / "eval"


def evaluate_dataset() -> dict[str, Any]:
    """Run the audio benchmark and compare each cart with its expected result."""
    with GROUND_TRUTH_PATH.open(encoding="utf-8") as ground_truth_file:
        ground_truth: dict[str, dict[str, int]] = json.load(ground_truth_file)

    results = []
    for filename, expected in ground_truth.items():
        sample_path = SAMPLES_PATH / filename
        if not sample_path.is_file():
            results.append(
                {
                    "file": filename,
                    "status": "error",
                    "expected": expected,
                    "actual": {},
                    "transcript": "",
                    "error": "Benchmark audio file is missing.",
                }
            )
            continue

        try:
            order = process_audio(str(sample_path), include_audio=False)
            actual = order["cart"]
            passed = actual == expected
            results.append(
                {
                    "file": filename,
                    "status": "passed" if passed else "failed",
                    "expected": expected,
                    "actual": actual,
                    "transcript": order["transcript"],
                    "error": None,
                }
            )
        except Exception as error:
            results.append(
                {
                    "file": filename,
                    "status": "error",
                    "expected": expected,
                    "actual": {},
                    "transcript": "",
                    "error": str(error),
                }
            )

    total_samples = len(results)
    passed_samples = sum(
        result["status"] == "passed"
        for result in results
    )
    failed_samples = sum(
        result["status"] != "passed"
        for result in results
    )

    return {
        "total_samples": total_samples,
        "passed": passed_samples,
        "failed": failed_samples,
        "accuracy": (
            round(passed_samples / total_samples * 100, 1)
            if total_samples
            else 0
        ),
        "results": results,
    }
