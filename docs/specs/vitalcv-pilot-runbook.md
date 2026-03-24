# VitalCV Pilot Runbook

**MISSION:** Execute the first live pilot without widening scope or reintroducing demonstration theater. This runbook defines the operator path, KPI rules, commercial truth, and fallback behavior for the pilot.

## 1. Pilot Constraint Model

If a request falls outside these bounds, it is out of scope for the pilot:

- **One Buyer:** Healthcare facility credentialing / onboarding operator.
- **One Workflow:** Post-hire credentialing sprint, from accepted offer to cleared clinical start.
- **One KPI:** **Interview-to-Start Velocity** = median days from first employer review to recorded start outcome.
- **One Proof Story:** Audit-ready primary-source verification removes start delay and moves revenue earlier.

## 2. Required Environment Configuration

The pilot must run in a deterministic environment:

- `REAL_NURSYS_ENABLED=false` unless institutional E-Notify access is live.
- `FSMB_ENABLED=false` unless institutional agreement is signed and the connector is active.
- `OIG_LEIE_ENABLED=true` for safety checks.
- `PECOS_ENABLED=true` for eligibility signal handling.
- `MONITORING_SECRET="<secure-random-string>"` for pilot ops.
- `SEAL_TRAINING_EXPORT_ENABLED=false` unless explicitly authorized for offline analysis.

## 3. Canonical Pilot Routes

Operators must use these routes and no archived demo surfaces:

1. **Intake:** `/onboarding`
2. **Passport Review:** `/passport/[id]`
3. **Employer Decision:** `/review/[entityId]`
4. **Pilot Ops:** `/pilot-ops`

## 4. Scope Discipline

When the pilot is scoped, operators must carry the same scope everywhere:

- `orgContextId` for organization drilldown
- `pilotId` for engagement identity
- `workflowLane` for lane or hire type
- `geographyTag` for state/region when relevant

Manual start capture must preserve the active scope. Filtered pilot reporting must never infer scoped starts from unscoped `start_attestations`.

## 5. Fallback Behavior

When a source is unavailable or contract-gated:

- **Do not hallucinate.**
- Show `Gated`, `Unavailable`, or `Unchecked`.
- Keep readiness honest; unresolved source gaps block a clean top readiness state unless the employer explicitly accepts an exception.
- Offer the operator a manual document path or exception path. Never silently clear the clinician.

## 6. KPI Definitions

The supporting operational metrics for the pilot are:

- **Packets Shared:** distinct packet/share events sent to employers.
- **Reviews Opened:** employer opens on `/review/[entityId]`.
- **Decisions Made:** recorded employer decisions by type.
- **Median Days, Review to Decision:** first employer review to first recorded decision.
- **Median Days, Review to Ready:** first employer review to first readiness event at L2+ threshold.
- **Median Days, Review to Start:** first employer review to recorded start outcome.
- **Median Days, Share to Decision:** first packet share to first decision.
- **Blocker Resolution Time:** open/resolved blocker counts plus average and median resolution time.

Secondary metrics support the KPI. They do not replace it.

## 7. Pricing And Buyer Truth

Operators must describe pricing the same way every time:

- Buyers pay for verified pull utility, monitoring refreshes, exports, and integration utility.
- Repeat access inside the same freshness band is **not** a second charge.
- A new freshness band can create a new billable pull.
- Government and registry fees are pass-through at cost with no markup.
- If public card checkout is not live, say that plainly and use the approved manual invoice/contact flow.

## 8. Explicit Non-Promises

Do not imply any of the following unless they are truly live for the pilot:

- Nursys or FSMB coverage
- NPDB, DEA, ABMS, or SAM checks
- Nationwide geography beyond the scoped pilot geography
- Fully automated public checkout
- General recruiting, sourcing, or top-of-funnel workflow support

## 9. Demo Script (Grounded In Live Routes)

**WARNING:** Do not use archived `/demo/*` surfaces.

1. **Intake**
   - Go to `/onboarding`.
   - Enter a real or approved dev NPI.
   - Explain that the system is querying live or honestly gated sources now.
2. **Passport**
   - Go to `/passport/[id]`.
   - Explain readiness, blockers, and source coverage without overstating what is verified.
3. **Employer Review**
   - Go to `/review/[entityId]`.
   - Show timestamped evidence and source coverage.
   - Explain that the employer decision is audit logged.
4. **Pilot Ops**
   - Go to `/pilot-ops`.
   - Show the KPI window and the current scope filters.
   - If a start is recorded manually, confirm the event inherits the active scope.

See `vitalcv-launch-gate.md` for the final go/no-go criteria.
