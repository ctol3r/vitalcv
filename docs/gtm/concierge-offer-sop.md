# M9-1 — "48-Hour Recruiter-Ready Career Packet" (Concierge Offer + SOP)

**Date:** 2026-07-06
**Purpose:** a manual, sellable-today offer that produces revenue + learnings
before any self-serve automation. Manual is allowed (doctrine §16).

## The offer (buyer-facing)

**Stop starting over. Get recruiter-ready in 48 hours.**
We assemble a source-backed, shareable career-evidence packet for a clinician —
NPI identity, license status, exclusion checks, and Medicare enrollment — with a
readiness snapshot and a missing-evidence checklist, delivered in 48 hours.

- **Price:** $149 per clinician packet (introductory). Volume pricing for staffing firms.
- **Deliverable:** a shareable `/verify/:npi` profile + a PDF/JSON evidence packet
  + a one-page readiness summary with Time-to-Start estimate.

### Honest scope (what it is / isn't)

- ✅ Source **checks** with honest coverage states (checked / gated / stale / unknown).
- ✅ A shareable, employer-reviewable evidence artifact.
- ❌ NOT full credentialing, NOT "instant/guaranteed verification", NOT NPDB/DEA/
  ABMS/SAM.gov. Coverage is what our live source lanes actually cover.

## Delivery SOP (internal, ~45 min of work per packet)

1. **Intake** — collect NPI + target state/specialty + consent (intake form).
2. **Identity** — NPPES lookup (name, taxonomy, practice location).
3. **Exclusions** — OIG LEIE check.
4. **Enrollment** — CMS/PECOS status.
5. **License** — state medical board lookup (where a live lane exists); else mark
   `accessRequired` honestly.
6. **Readiness** — run the readiness snapshot; capture blockers per sub-80 dimension.
7. **Missing-evidence checklist** — list gated/stale/unknown items + how to resolve.
8. **Package** — generate the shareable `/verify/:npi` profile + evidence packet.
9. **QA** — run the copy-compliance mindset: no over-claims, every source shows its
   coverage state + timestamp.
10. **Deliver** within 48h; capture a testimonial at the "accepted as head start" moment.

## Metrics to log per packet (feeds M9-4 pilot instrumentation)

- Time-to-deliver, sources checked, coverage-state mix, missing-evidence count,
  buyer reaction, whether it converted to a repeat/subscription.

## Path to automation

Every SOP step maps to an existing surface (ingest → readiness → passport →
`/verify/:npi`). The concierge offer is the manual proof; automation replaces
steps 2–8 with the wedge product once demand is proven.
