# VitalCV Launch Gate

**MISSION:** Enforce strict launch discipline. Nothing goes to the pilot unless it meets these unyielding requirements.

## Constraints
- **Trust first**, matching second, intelligence third.
- **No rebrand work.**
- **No platform sprawl.**

---

## The Launch Gate Checklist

Launch cannot proceed unless all of the following are definitively marked as TRUE:

- [ ] **Truthful Public Copy:** The marketing site and public-facing product surfaces precisely match the reality of our live routes, sources, and sourceCoverage. No "coming soon" listed as live.
- [ ] **Canonical Wedge Routes:** All interactions follow the official trust cycle (`/onboarding` → `/passport/[id]` → `/review/[entityId]`). UI accurately reflects backend data natively without masking delays.
- [ ] **Packet/Export Trustability:** The generated evidence packet (`/api/employer-review/:entityId/packet`) contains zero hallucinated data, including timestamped citations and `sourceCoverage` for every field.
- [ ] **Employer Decision Persistence:** Every view, decision (accept/reject/route/hold/refresh), and override is immutably logged to an `AuditEvent` with the exact source state at that moment.
- [ ] **Blocker Resolution Metrics:** The readiness recompute path correctly emits events to capture the time it takes to resolve onboarding blockers.
- [ ] **Start Outcome Capture:** Application and operator workflows can capture ultimate start dates, reasons for failure, and readiness score at start without workarounds.
- [ ] **Source-Health Visibility:** Operations and pilots can clearly see when a source is unavailable, gated, or returning partial data—preventing unsupported tools from being silently verified.
