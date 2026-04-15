# VitalCV Gravity Engine (v2)

## Progressive Disclosure of Resolved Truth
The VitalCV frontend operates under a strict "Gravity Engine" paradigm. The user experience sequences attention to progressively reduce perceived complexity, but **never** computes or fetches data piecemeal.

### 1. Atomic Truth Rule (HARD RULE)
**ALL data must be computed BEFORE rendering begins.**
- NO staged fetching.
- NO staged computation.
- NO data mutation between UI steps.
- The Omega Orchestrator must compute the full Manifest and freeze the truth state entirely before the UI receives the payload.

### 2. Flow Structure (Highlighting Only)
Once the atomic truth is frozen and delivered to the client, the UI sequentially highlights the already-resolved facts:
1. **Identity Highlighted**: System directs attention to "Who is this?" (NPPES Name, Taxonomy).
2. **Safety Highlighted**: System directs attention to "Are they safe?" (OIG Exclusion checks).
3. **Authority Highlighted**: System directs attention to "Are they authorized?" (State Board licenses, PECOS).
4. **Decision Highlighted**: System directs attention to the computed `NextBestAction`.
5. **Action Triggered**: The final Employer action (Approve/Reject/Request Data).

### Core Rules
- **No progressive rendering of truth**: The truth is instantaneous and atomic.
- **Progressive disclosure of resolved truth**: The UI merely directs the user's attention through the pre-computed cryptographically secure manifest to build cognitive trust.
- **Guide attention, NOT compute data**: Each stage MUST highlight pre-computed truth, reduce perceived complexity, and guide attention. It must never compute new data or fetch incrementally.
