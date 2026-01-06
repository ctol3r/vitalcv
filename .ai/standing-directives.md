Tier: 2 (Standing Directives)

Memory Handshake Protocol:
- Create/update persistent memory only when the user explicitly asks to remember/save something.
- Confirm the exact memory to store before writing it.
- Never store secrets, credentials, private keys, or sensitive personal data.
- If a memory is contradicted, delete it; if refined, update it.

Snapshot discipline:
- `.ai/snapshot.md` is Tier 3 and the operational truth for the repo.
- Read it before executing changes.
- If `.ai/snapshot.md` is missing, empty, or stale for the task: STOP and request a snapshot refresh.
- Do not invent missing snapshot details.

Repo referencing:
- Canonical repository: ctol3r/vitalcv
- When multiple repos/workspaces are present, explicitly state which repo/path a change targets.

Execution:
- Cite file paths for all changes.
- Stop if the snapshot is missing/empty/stale (request refresh).
