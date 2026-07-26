# W205-5 — Career Packet Demo Walkthrough

**Wave:** 205 (Career Packet Implementation)
**Goal:** demonstrate recruiter value in under 3 minutes — no dead ends, no broken routes.
**Date:** 2026-06-20.

The flow is **NPI → Passport → Packet → PDF → Employer Review**. Every step below is a real, shipping route in `apps/web`.

---

## The 3-minute path

| # | Step | Route | What the audience sees |
|---|---|---|---|
| 1 | **Enter NPI** | `/passport` | Public, no account. Live NPPES ingest with a 30-second result. |
| 2 | **Read the passport** | `/passport/[id]` (entityId) | Identity confirmed against NPPES, sanctions checked via OIG, readiness status generated. |
| 3 | **Open the Career Packet** | `/packet/[entityId]` | The recruiter `<30s` scan: name + specialty, a recruiter status chip (READY / NEEDS REVIEW / BLOCKED / MISSING EVIDENCE), then ten sections — Executive, Identity, Readiness, Verification Sources, Evidence, Recruiter View, Employer View, Trust Signals, Missing Evidence, Recommendations. |
| 4 | **Export the PDF** | `GET /api/export/packet?npi=<npi>` (button on the packet) | When readiness is source-backed and unblocked, the **Download Career Packet (PDF)** button is live. When it is not, the packet still renders and the button reads "PDF export unlocks once readiness is source-backed and blockers are resolved." The export gate (`resolveEmployerPacketExportGate`) is unchanged — partial coverage fails closed. |
| 5 | **Hand to employer review** | `/review/[entityId]` | The employer review surface (supports entityId and `chk_*` share tokens) with the start-ready verdict and blocking reasons. |

---

## The five questions a recruiter can answer on `/packet/[entityId]` alone

1. **Who is this clinician?** → Executive Summary + Identity (NPI, specialty, NPPES attribution).
2. **What evidence exists?** → Verification Sources + Evidence sections.
3. **What evidence is missing?** → Missing Evidence section (gated / stale / access-required, in plain copy).
4. **Are they ready?** → Recruiter status chip + Credential Readiness (score, status, time-to-start).
5. **Can I move them forward?** → Employer View (start-ready verdict, what to request) + the PDF export.

No other screen is required to answer all five.

---

## Demo honesty notes (say these out loud)

- **READY only means decision-grade with zero blockers.** A partial passport never shows READY — it degrades to NEEDS REVIEW or MISSING EVIDENCE. This is unit-tested (`career-packet-derive.test.ts`).
- **The screen shows value even when the PDF is withheld.** A recruiter can read a partial packet; the downloadable PDF stays gated until the evidence is decision-grade. Partial-stays-partial is preserved end-to-end.
- **Source states are reported honestly** — checked, gated, stale, or unknown — never as a guarantee. Acceptance is verifier-policy dependent.

---

## Route health (no broken routes / no dead ends)

| Route | File | Status |
|---|---|---|
| `/passport` | `apps/web/app/passport/page.tsx` | existing |
| `/passport/[id]` | `apps/web/app/passport/[id]/page.tsx` | existing |
| `/packet/[entityId]` | `apps/web/app/packet/[entityId]/page.tsx` | **new (W205-2)** |
| `GET /api/export/packet` | `apps/web/app/api/export/packet/route.ts` | existing (PDF now carries career sections) |
| `/review/[entityId]` | `apps/web/app/review/[entityId]/page.tsx` | existing |

Every step links forward; the packet's "Packet not available" and degraded states route back to `/passport` so the demo never dead-ends.
