import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.services.order_workflow import process_audio

GROUND_TRUTH_FILE = "eval/ground_truth.json"
AUDIO_FOLDER = "samples/eval"


def main():
    with open(GROUND_TRUTH_FILE, "r") as f:
        ground_truth = json.load(f)

    total = 0
    passed = 0

    print("\nVOICEOS EVALUATION")
    print("=" * 50)

    for filename, expected_cart in ground_truth.items():
        audio_path = f"{AUDIO_FOLDER}/{filename}"

        try:
            result = process_audio(audio_path)

            actual_cart = result["cart"]
            print("\nTranscript:")
            print(result["transcript"])

            success = actual_cart == expected_cart

            total += 1

            if success:
                passed += 1
                status = "PASS"
            else:
                status = "FAIL"

            print(f"\n{status} | {filename}")
            print(f"Expected: {expected_cart}")
            print(f"Actual  : {actual_cart}")

        except Exception as e:
            total += 1

            print(f"\nERROR | {filename}")
            print(str(e))

    print("\n" + "=" * 50)
    print(f"Passed: {passed}/{total}")

    accuracy = (passed / total) * 100 if total else 0

    print(f"Accuracy: {accuracy:.1f}%")
    print("=" * 50)


if __name__ == "__main__":
    main()