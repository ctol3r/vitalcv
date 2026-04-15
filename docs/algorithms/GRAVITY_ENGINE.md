# VitalCV Gravity Engine (Corrected for Atomic Truth)

## Progressive Disclosure of Resolved Truth
The VitalCV frontend operates under a strict "Gravity Engine" paradigm. The user experience pulls the user forward through a sequence of deterministic steps that progressively reduce uncertainty, but **never** computes or fetches data piecemeal.

### 1. Atomic Truth Rule (HARD RULE)
**ALL data must be computed BEFORE rendering begins.**
- NO staged fetching.
- NO staged computation.
- The Omega Orchestrator must compute the full Manifest and freeze the truth state entirely before the UI receives the payload.

### 2. Flow Structure (Highlighting Only)
Once the atomic truth is frozen and delivered to the client, the UI sequentially highlights the already-resolved facts:
1. **Identity Revealed**: Highlight "Who is this?" (NPPES Name, Taxonomy).
2. **Safety Revealed**: Highlight "Are they safe?" (OIG Exclusion checks).
3. **Authority Revealed**: Highlight "Are they authorized?" (State Board licenses, PECOS).
4. **Decision Revealed**: Highlight the computed `NextBestAction`.
5. **Action Triggered**: The final Employer action (Approve/Reject/Request Data).

### Core Rules
- **No progressive rendering of truth**: The truth is instantaneous and atomic.
- **Progressive disclosure of resolved truth**: The UI merely directs the user's attention through the pre-computed cryptographically secure manifest to build cognitive trust.
