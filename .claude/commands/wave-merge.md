---
description: Merge a VitalCV PR only after Codex SAFE verdict and green checks
---

Merge a VitalCV PR only if:
- Codex returned SAFE
- checks are green/neutral/skipping only
- branch is mergeable
- no secrets or unrelated files are present

Commands to use:
gh pr view <PR>
gh pr checks <PR>
gh pr merge <PR> --squash --delete-branch

After merge:
- confirm origin/main SHA
- confirm expected files landed
- record actual completion deltas
