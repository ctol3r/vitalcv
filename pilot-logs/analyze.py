#!/usr/bin/env python3
"""Analyze pilot logs for patterns and blocking issues."""

import json
import os
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime

LOG_DIR = Path(__file__).parent

def load_logs():
    """Load all JSON logs from directory."""
    logs = []
    for file in LOG_DIR.glob("*.json"):
        if file.name == "template.json" or file.name == "summary.json":
            continue
        try:
            with open(file) as f:
                logs.append(json.load(f))
        except (json.JSONDecodeError, IOError):
            continue
    return logs

def analyze_friction_points(logs):
    """Extract and count friction points."""
    all_friction = []
    by_user_type = defaultdict(list)

    for log in logs:
        user_type = log.get("user_type", "unknown")
        for fp in log.get("friction_points", []):
            all_friction.append(fp["description"])
            by_user_type[user_type].append(fp["description"])

    return {
        "all": Counter(all_friction),
        "by_user_type": {k: Counter(v) for k, v in by_user_type.items()}
    }

def analyze_completion_rate(logs):
    """Calculate completion rates by user type."""
    completion = defaultdict(lambda: {"total": 0, "completed": 0})

    for log in logs:
        user_type = log.get("user_type", "unknown")
        completion[user_type]["total"] += 1
        if log.get("completed", False):
            completion[user_type]["completed"] += 1

    return {
        k: f"{v['completed']}/{v['total']} ({v['completed']/v['total']*100:.1f}%)"
        for k, v in completion.items()
    }

def analyze_completion_time(logs):
    """Calculate average completion time by user type."""
    times = defaultdict(list)

    for log in logs:
        if log.get("completed", False) and log.get("time_to_complete_seconds", 0) > 0:
            user_type = log.get("user_type", "unknown")
            times[user_type].append(log["time_to_complete_seconds"])

    return {
        k: f"{sum(v)/len(v):.0f}s (n={len(v)})"
        for k, v in times.items() if v
    }

def analyze_trust_issues(logs):
    """Extract and categorize trust issues."""
    all_issues = []

    for log in logs:
        for issue in log.get("trust_issues", []):
            all_issues.append(issue)

    return Counter(all_issues)

def get_top_blocking_issues(logs):
    """Get top 5 issues blocking usage."""
    friction = analyze_friction_points(logs)["all"]
    trust = analyze_trust_issues(logs)

    # Combine friction and trust issues
    combined = defaultdict(int)
    combined.update(friction)

    # Weight trust issues higher
    for issue, count in trust.items():
        combined[issue] += count * 2

    # Sort by frequency
    top_issues = combined.most_common(5)

    return [{"issue": issue, "count": count} for issue, count in top_issues]

def main():
    logs = load_logs()

    if not logs:
        print("No logs found in pilot-logs/")
        return

    print(f"\n=== VitalCV Pilot Analysis ({len(logs)} sessions) ===\n")

    # Completion rates
    print("Completion Rates:")
    for user_type, rate in analyze_completion_rate(logs).items():
        print(f"  {user_type}: {rate}")

    # Completion times
    print("\nAvg Completion Time:")
    for user_type, time_str in analyze_completion_time(logs).items():
        print(f"  {user_type}: {time_str}")

    # Friction points
    print("\nTop Friction Points:")
    friction_by_type = analyze_friction_points(logs)["by_user_type"]
    for user_type, counter in friction_by_type.items():
        print(f"  {user_type}:")
        for issue, count in counter.most_common(3):
            print(f"    - {issue} ({count})")

    # Trust issues
    trust_issues = analyze_trust_issues(logs)
    if trust_issues:
        print("\nTrust Issues:")
        for issue, count in trust_issues.most_common():
            print(f"  - {issue} ({count})")

    # Top 5 blocking issues
    print("\n=== TOP 5 BLOCKING ISSUES ===")
    for i, item in enumerate(get_top_blocking_issues(logs), 1):
        print(f"{i}. {item['issue']} ({item['count']} occurrences)")

    # Save summary
    summary = {
        "generated_at": datetime.now().isoformat(),
        "total_sessions": len(logs),
        "completion_rates": analyze_completion_rate(logs),
        "completion_times": analyze_completion_time(logs),
        "top_5_blocking_issues": get_top_blocking_issues(logs),
        "friction_by_type": {k: dict(v.most_common(5)) for k, v in analyze_friction_points(logs)["by_user_type"].items()},
        "trust_issues": dict(analyze_trust_issues(logs))
    }

    with open(LOG_DIR / "summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nSummary saved to {LOG_DIR / 'summary.json'}")

if __name__ == "__main__":
    main()
