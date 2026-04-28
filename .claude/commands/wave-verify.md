---
description: Verify an active VitalCV PR with implementation, diff, copy/truth, and board gates
---

Verify the active VitalCV PR.

Required checks:
1. Implementation evidence
2. Tests/build
3. Diff scope
4. Truth/copy safety
5. Completion board delta correctness
6. No secrets/env files
7. No unsupported claims
8. Merge recommendation

Return:
- SAFE TO MERGE
- NEEDS FIX
- BLOCKED
