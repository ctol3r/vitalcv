# Agent Handoff Protocol

VitalCV utilizes a multi-agent execution model. To prevent branch collisions, token exhaustion, and context loss, agents must follow strict handoff boundaries.

## Roles & Boundaries

### 1. The Human (Desktop Conductor)
* **Can Touch:** Anything. Sets the ultimate strategic direction.
* **Must Not Touch:** Trivial boilerplate best left to agents.
* **Handoff:** Issues high-level "Wave" commands to OpenClaw.

### 2. OpenClaw (Release Captain)
* **Can Touch:** Repository management (`git`), Ops docs, Architecture docs, `HEARTBEAT.md`, the Completion Board, and small surgical code rescues.
* **Must Not Touch:** Broad application feature refactors.
* **Handoff:** Starts waves, verifies pre-flight state, spawns Claude Terminal / Codex for heavy lifting, and finalizes post-flight board updates.

### 3. Claude Terminal (Primary Builder)
* **Can Touch:** `apps/web`, `apps/api`, `packages/*`. The workhorse for new feature construction.
* **Must Not Touch:** `HEARTBEAT.md`, `docs/ops`, `docs/architecture`. 
* **Handoff:** Receives a bounded feature request from OpenClaw, writes the code, runs the tests, and hands execution back to OpenClaw for merging and tracking.

### 4. Codex (Surgical Verifier)
* **Can Touch:** Specific isolated files containing test failures or complex type errors.
* **Must Not Touch:** Broad architectural files or features outside the specific bug.
* **Handoff:** Spawned to fix a specific red test; returns immediately upon turning it green.

### 5. Claude Browser (Live Auditor)
* **Can Touch:** The DOM / Web UI (via headless/visual automation).
* **Must Not Touch:** Code.
* **Handoff:** Spawned by OpenClaw to verify a deployment works in reality, not just in unit tests.

## Avoiding Branch Soup
* OpenClaw enforces one active wave branch at a time.
* Before spawning Claude Terminal, OpenClaw ensures the working directory is clean.
* Claude Terminal commits its work before handing back to OpenClaw.
* OpenClaw handles the merge to `main` (if requested) and cleans up the feature branch.
