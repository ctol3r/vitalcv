# VitalCV Algorithm Canon (The Omega Formula)

## Core Equation
**Start = Recognition + Acceptance**

This is the governing architecture of VitalCV. Every feature, service, and database model must map to this canonical flow.

## 1. Recognition (The System’s Perspective)
The objective, cryptographic state of the credential network at any given moment.
- **Inputs**: Primary source verification (NPPES, OIG/LEIE, PECOS, State Boards).
- **Current System Mapping**: The Trust Engine (`buildDecisionPosture`, `npiPassportContract`, `sourceCoverage`).
- **Gaps**: 
  - Missing deterministic source freshness weighting.
  - Missing cryptographic anomaly detection.
  - Relying on periodic sync instead of continuous event streams.

## 2. Acceptance (The Employer’s Perspective)
The subjective human risk decision layered on top of the objective network state.
- **Inputs**: Employer risk tolerance, manual policy overrides, and explicit hiring/flagging actions.
- **Current System Mapping**: The Action Loop (`EmployerActionHooks`, `PilotMetric`, `telemetry`, `EmployerAcceptance` schema).
- **Gaps**:
  - Missing formal `Acceptance` object materialization upon clicking "Hire Candidate".
  - UI telemetry is currently disconnected from core backend state machines.
  - Missing cryptographic linkage between what the user saw (Recognition) and their decision (Acceptance).

## 3. Start (The Final State Transition)
The materialization of a hiring event. A `Start` only exists when `Recognition` and `Acceptance` overlap successfully.
- **Inputs**: 
  - Immutable Recognition Snapshot.
  - Explicit Acceptance Audit Trail.
- **Current System Mapping**: Partially mapped to `StartAttestation` model.
- **Gaps**:
  - Currently, we log telemetry on decisions but don't explicitly fire a `Start` event.
  - Missing billing linkage (Starts = Revenue).

## Integration Boundaries: The Omega Orchestrator
We will introduce a thin `OmegaOrchestrator` service. Its only job is to govern the boundaries between these three states:
1. It reads `Recognition` (the Passport).
2. It captures `Acceptance` (the Employer Action).
3. It mints a `Start` (the Attestation) if both are present and valid.

*System becomes canon-aligned, not canon-rewritten.*