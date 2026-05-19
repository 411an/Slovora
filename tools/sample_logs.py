import os
import json
import random

import sys

sys.stdout.reconfigure(encoding="utf-8")

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "tests", "exercise_log.json")

def main():
    if not os.path.exists(LOG_PATH):
        print(f"Log file not found: {LOG_PATH}")
        return

    with open(LOG_PATH, "r", encoding="utf-8") as f:
        logs = json.load(f)

    # Pick 30 random samples
    samples = random.sample(logs, min(30, len(logs)))

    print("=== Random Sample of 30 Exercises ===")

    for i, s in enumerate(samples, 1):
        print(f"\n--- Sample {i} ({s.get('templateId')}, Lang: {s.get('native_language')}) ---")
        print(f"Prompt (Native): {s.get('native_prompt')}")
        print(f"Expected Answer: {s.get('generated_sentence')}")
        print(f"Expected Cards : {s.get('expected_cards')}")

if __name__ == "__main__":
    main()
