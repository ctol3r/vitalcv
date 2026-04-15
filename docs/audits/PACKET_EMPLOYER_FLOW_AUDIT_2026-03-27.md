# VitalCV Packet & Employer Flow Audit

**Date:** 2026-03-27
**Auditor:** Claude (Cowork — Strategic Operator)
**Scope:** End-to-end clinician packet flow + employer review flow
**Method:** Full codebase trace — Prisma models, API routes, services, frontend pages/components

---

## Executive Summary

The packet and employer flows are **operationally real**. Both sides have production-grade API integration, real data, proper auth (Clerk), audit trails, and cryptographic integrity. No mock data, no placeholder endpoints, no demo-quality UI. The system supports the full lifecycle: clinician generates signed bundle → shares to employer via webhook/email → employer inspects evidence packet → employer takes action (accept / request-refresh / route-to-review) → all events are audit-logged with trust snapshots.

**Verdict: GO for design polish.** The plumbing is proven. What remains is UX refinement, not structural work.

---

## CLINICIAN POV: What Works

| Capability | Status | Notes |
|---|---|---|
| Packet generation (Apply Bundle) | **Proven** | `POST /api/apply/bundle` — SHA-256 signed, 24-hour TTL, persisted as VerificationArtifact |
| Credential population | **Proven** | Sourced from TrustPassport via `buildEmployerReviewPayload()`. Selective claims supported at API level |
| Share to employer | **Proven** | `POST /api/apply/share` — Webhook dispatch (HMAC-SHA256 signed) → email fallback → logged_only cascade |
| Share revocation | **Proven** | `DELETE /api/apply/share/:shareId` — Clinician-only, soft delete via `revokedAt` |
| Share history | **Proven** | `GET /api/apply/shares/:npi` — Last 50 shares with status, revocation state |
| Public bundle view | **Proven** | `/apply/[bundleId]` — Real credentials, issuer provenance, monitoring status, signature stamp |
| Holder dashboard | **Proven** | `/holder` — Real NPI-resolved workspace, readiness score (L0-L3), blockers, applications |
| Readiness workspace | **Proven** | `/holder/readiness` — Live refresh, delta tracking, history timeline, blocker→application linking |
| Application tracking | **Proven** | `/holder/applications` — Real status codes, proof moments, employer feedback |
| Interview mode | **Proven** | `/interview` — Portable passport view with "Share with employer" action |

## CLINICIAN POV: Issues

1. **No dedicated "Create Packet" UI.** The bundle generation is API-first. Clinicians trigger it through the Interview/Share flow, not through an explicit "Build my packet" screen. This is acceptable for pilot (the system auto-assembles), but will confuse clinicians who expect to curate what goes in.

2. **Selective claims has no frontend picker.** The API accepts `selectiveClaims[]` but there's no UI for the clinician to choose which credential domains to include/exclude. Everything goes in by default.

3. **No packet preview before share.** Clinicians share the bundle without seeing exactly what the employer will receive. The Interview mode shows the passport, but it's not framed as "this is what you're about to send."

4. **No share confirmation with delivery status.** After sharing, the clinician doesn't see real-time feedback on whether the webhook delivered or fell back to email. The API returns this data, but no UI consumes it.

5. **No packet management dashboard.** No page to see all generated bundles, their expiry status, share history, or revocation controls in one place. The `GET /api/apply/shares/:npi` endpoint exists but has no frontend consumer.

6. **Bundle TTL is fixed at 24 hours.** No clinician control over expiry. This is fine for pilot but may feel restrictive.

---

## EMPLOYER POV: What Works

| Capability | Status | Notes |
|---|---|---|
| Evidence packet export | **Proven** | `GET /api/employer-review/:entityId/packet` — JSON + ZIP formats, full manifest |
| Decision surface | **Proven** | `/review/[entityId]` — "Can you hire this person?" in <10 seconds design doctrine |
| Accept clinician | **Proven** | `POST /accept` — Creates EmployerAcceptance + DecisionTrustSnapshot + audit event + SEAL event |
| Request refresh | **Proven** | `POST /request-refresh` — Specifies stale sources + missing domains + message |
| Route to review | **Proven** | `POST /route-to-review` — HITL queue with priority + reason + trust snapshot |
| Review status check | **Proven** | `GET /status` — Latest acceptance or audit action |
| Trust signals | **Proven** | Full snapshot: readiness score/level/status, trust band, blocker count, exclusion status, credential counts, freshness |
| OIDC4VP verification | **Proven** | Nonce-based (5-min TTL, Luhn check), JWK signature validation, audience enforcement |
| Employer directory | **Proven** | `/employers` — Real launch cohort (12 employers), live stats, hiring status |
| Employer profiles | **Proven** | `/employers/[slug]` — Roles, requirements, trust registry, operational details |
| KPI tracking | **Proven** | View events fire on page load (fire-and-forget, never blocks render) |
| Audit trail | **Proven** | Every employer action → immutable AuditEvent with full metadata + trust snapshot hash |

## EMPLOYER POV: Issues

1. **No explicit "Decline" action.** Employers can accept, request-refresh, or route-to-review — but there's no `POST /decline` endpoint. Declining is implicit (not accepting). This is a real operational gap; employers need to formally close the loop.

2. **No remediation tracking after request-refresh.** The employer fires a refresh request but has no way to track whether the clinician acted on it. No status progression, no notification when refreshed data arrives.

3. **No batch operations.** Employers reviewing 50 clinicians have no bulk accept/decline/export capability. One-at-a-time only.

4. **Webhook configuration has no self-service UI.** `EmployerWebhookConfig` exists in the model, but there's no employer-facing settings page to register/test webhooks. Configuration presumably requires admin intervention.

5. **No credential drill-down in review surface.** The decision surface shows readiness score and blockers, but employers can't click into individual credentials to see the underlying PSV evidence, verification receipts, or issuer provenance without exporting the full packet.

6. **No dispute/appeal workflow.** If an employer disagrees with a credential status or a clinician contests a negative finding, there's no structured flow for resolution.

7. **The Employer Dashboard (845 lines) and Verifier Portal (597 lines) are large, complex components.** They appear operational, but their size suggests they may have accumulated functionality that would benefit from decomposition for maintainability and testability.

---

## IS THE PACKET INSPECTABLE?

**Yes, with caveats.**

**What's inspectable:**
- Credentials listed with type, issuer, status, verified date, expiration
- Issuer provenance with trust scores (visual bar + percentage)
- Monitoring status (active/partial/inactive)
- Readiness level + score + blockers
- SHA-256 verification signature
- Source coverage summary with freshness labels

**What's NOT inspectable (yet):**
- Individual verification receipts (the proof chain behind each credential)
- Raw PSV evidence (the actual registration page screenshot or API response)
- Audit history for a specific credential (when it was last checked, what changed)
- Revocation check timestamps and results per credential

**Assessment:** The packet communicates *what* is verified and *how confident* the system is. It does not yet let the employer drill into *why* or *how* for each individual credential. For pilot, the summary-level inspectability is sufficient. For enterprise buyers doing their own compliance, receipt-level drill-down will be required.

---

## DO EMPLOYER ACTIONS FEEL OPERATIONAL OR FAKE?

**Operational.** Strongly so. Here's why:

1. Every action writes a `DecisionTrustSnapshot` — capturing the full trust state at decision time with a SHA-256 hash. This is auditable and replayable.
2. Every action fires a SEAL event for downstream analytics/ML. Fire-and-forget, never blocks the UI.
3. Accept guards against duplicate open acceptances (409 Conflict).
4. Route-to-review gracefully degrades if the HITL service is unavailable — creates the audit event regardless.
5. Request-refresh captures specific stale sources and missing domains, not just a generic "refresh" flag.
6. The Review Client enforces "<10 seconds to decide" doctrine — decision-first, no tabs/sidebars, status via opacity not color.

**What feels less operational:**
- No decline endpoint (addressed above)
- No notification when a clinician responds to a refresh request
- No workflow for "I accepted this person but they haven't started yet — what's happening?"

---

## TOP 10 REMAINING OPERATIONAL UX PROBLEMS

| # | Problem | Severity | Effort |
|---|---|---|---|
| 1 | **No "Decline" employer action** — Employers can't formally close the loop on rejected clinicians. Implicit non-acceptance is not auditable. | HIGH | S |
| 2 | **No packet preview before share** — Clinicians share blind. The Interview mode shows their passport but doesn't frame it as "this is what the employer will see." | MEDIUM | S |
| 3 | **No selective claims UI** — API supports it, no frontend picker. Clinicians can't choose what to include/exclude. | MEDIUM | M |
| 4 | **No share status feedback** — After sharing, clinician gets no real-time delivery confirmation (webhook delivered vs email fallback vs logged only). | MEDIUM | S |
| 5 | **No credential drill-down in review** — Employer can't click a credential to see the verification receipt, PSV evidence, or issuer detail without exporting the full packet. | MEDIUM | M |
| 6 | **No remediation tracking loop** — Employer requests refresh, but can't track whether the clinician acted. No notification, no status change. | MEDIUM | M |
| 7 | **No packet management dashboard** — Clinician has no single page to see all bundles, shares, expiry status, and revocation controls. | LOW | M |
| 8 | **No batch employer operations** — High-volume employers reviewing many clinicians have no bulk workflow. | LOW | L |
| 9 | **No employer webhook self-service** — Webhook config exists in DB but requires admin setup. No settings page. | LOW | M |
| 10 | **No post-acceptance tracking** — After employer accepts, there's no visible "onboarding started" / "awaiting start date" state in the employer dashboard. | LOW | M |

---

## GO / NO-GO FOR DESIGN POLISH

### **GO.**

**Rationale:**

The structural foundation is complete and production-grade. Both flows (clinician packet creation/sharing and employer review/action) are wired end-to-end with real APIs, real data, real auth, real audit trails, and real cryptographic integrity. No synthetic data anywhere. No placeholder endpoints. No demo-quality components.

**What "GO for design polish" means:**
- The remaining problems are **UX refinement**, not **architectural gaps**
- Items #1 (Decline action) and #4 (share status feedback) are the only ones that touch plumbing — both are S-effort
- Items #2, #3, #5, #6, #7 are all **frontend UI additions** on top of existing API capabilities
- The audit/compliance infrastructure is already in place and doesn't need to be retrofitted

**What would make this NO-GO:**
- If the packet lacked cryptographic signing → it has SHA-256 signatures ✓
- If employer actions didn't capture trust state → DecisionTrustSnapshot with hash ✓
- If the audit trail was incomplete → every action produces AuditEvent ✓
- If data was mock/synthetic → all API integrations are real ✓
- If auth was missing → Clerk integration on all write paths ✓

**Recommended polish priority:**
1. Add `POST /decline` endpoint (S — close the action gap)
2. Add packet preview screen before share (S — frame what's being sent)
3. Add share delivery status to clinician UI (S — consume existing API data)
4. Add credential drill-down in employer review (M — requires receipt rendering)
5. Add selective claims picker (M — UI for existing API)

---

*This audit traces the actual codebase — Prisma schema, API routes, service logic, and frontend components. All claims are verifiable against the repo.*
