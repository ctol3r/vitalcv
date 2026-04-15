# VitalCV Gravity Engine

## Progressive Reveal Architecture
The VitalCV frontend operates under a strict "Gravity Engine" paradigm. The user experience is never a static, full-page render of data. Instead, it pulls the user forward through a sequence of deterministic steps that progressively reduce uncertainty.

### Flow Structure
1. **NPI Input**: The entry point.
2. **Identity Revealed**: System confirms "Who is this?" (NPPES Name, Taxonomy).
3. **Safety Revealed**: System confirms "Are they safe?" (OIG Exclusion checks).
4. **Authority Revealed**: System confirms "Are they authorized?" (State Board licenses, PECOS).
5. **Decision Revealed**: The Omega Orchestrator evaluates the time-locked Proof Manifest and returns the `NextBestAction`.
6. **Action Triggered**: The final Employer action (Approve/Reject/Request Data).

### Core Rules
- **No static upfront rendering**: The page must unfold step-by-step.
- **Reveal new information**: Each step must mathematically prove a new piece of the trust contract.
- **Reduce uncertainty**: Each step must transition an `UNKNOWN` or `PENDING` state into a deterministic reality.
- **Suggest next action**: Every stage must naturally lead the user to the next logical click or automatic progression.
