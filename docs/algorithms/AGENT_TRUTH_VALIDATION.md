# VitalCV Agent Truth Validation

## 1. Validation Pass
Every agent output (e.g., AI explanations, documentation summaries, UI text recommendations) MUST be strictly validated against actual system capabilities.
- The agent must compare its generated claim to the underlying system truth.

## 2. Detecting Mismatches
If `agent_output != system_truth`:
- It is flagged as a **TRUTH VIOLATION**.
- Example: Claiming "100% blockchain secured" when the system uses a standard Postgres database with SHA-256 receipts.

## 3. Corrective Action
Upon detecting a mismatch:
- The agent must downgrade the claim to match empirical reality.
- The violation must be logged.
- The incorrect output must be structurally blocked.
