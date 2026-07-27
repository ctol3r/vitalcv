# Career Evidence Network Alignment — Launch Checklist

> Wave: `wave/career-evidence-network-alignment` · Date: 2026-06-20
> Convergence pass aligning doctrine, public copy, and the first-revenue wedge
> behind one product truth. **Not** a rewrite — the shippable wedge is unchanged.

## Strategic Doctrine

- VitalCV is the **Provider Career Evidence Network**, powered by Provider Identity Graph infrastructure (substrate, not headline).
- The credential **wallet/passport is the first wedge**; the company is reusable, source-backed clinician career evidence that follows providers across opportunities, employers, credentialing teams, payer enrollment, privileging, staffing, and future AI matching.
- Current pilot remains: `NPI → Source Checks → Readiness Snapshot → Passport / Proof Packet → Employer Review → Accept as Head Start / Request Refresh / Route to Review`.
- Canonical path preserved: **Recognition → Acceptance → Start**.
- Do **not** widen into generic recruiting or job-board behavior.
- Layer map: wallet = clinician home base · passport/proof packet = shareable artifact · readiness engine = evaluation layer · employer review = monetization bridge · career evidence network = company-scale moat.

## Public Copy Checks

- [x] Mentions career evidence — homepage eyebrow "The Provider Career Evidence Network"; hero "source-backed career readiness packet you can carry across healthcare opportunities".
- [x] Mentions clinician-owned readiness — clinician card "Career evidence that travels with you" + portable-packet bullets.
- [x] Mentions employer-ready packet — employer card "Start with a review-ready proof packet, not scattered documents".
- [x] Ecosystem framing present (one strong placement) — "Every accepted packet makes the next opportunity easier."
- [x] Avoids unsupported certification claims — no SOC 2 / NCQA / HIPAA-certified language on public surfaces (guarded by `pnpm check:claims`).
- [x] Avoids instant-hire / instant-credentialing claims — none present; banned phrases enforced by scanner.

## Source Honesty Checks

- [x] Gated sources displayed as gated; unknown as unknown; stale as stale (trust-state coverage model unchanged — `packages/trust-state/sourceCoverage.ts`, 9 canonical states).
- [x] Revoked fails closed (DOCTRINE.md point 4–5, unchanged).
- [x] No NPDB / DEA / ABMS / SAM.gov claims introduced.
- [x] No SOC 2 / NCQA certification claims introduced.
- [x] Over-claim fixed: `AuditProofViewer` and `TrustConsentModal` no longer say "Zero-Knowledge Proof" — VitalCV uses **SD-JWT selective disclosure**, so copy now reads "Selectively disclosed via SD-JWT".

## Revenue Wedge Checks

- [x] First offer present — **Verified Clinician Career Packet** section on the homepage.
- [x] 48-hour readiness review language framed as a **service promise**, not an automated guarantee ("Get recruiter-ready in 48 hours" + "A source-backed readiness review — honest about what is checked, gated, or missing").
- [x] Deliverables listed: NPI identity snapshot · credential readiness summary · source coverage and freshness · known blockers or missing evidence · recruiter-ready career summary · employer-facing proof packet.
- [x] CTA routes to a working path — "Request a readiness review" → `/contact` (real intake form → `/api/pilot-intake`, includes an "Individual Clinician" persona).

## Technical Safety Checks

- [x] No Prisma migrations run.
- [x] No trust-state semantic changes; no source-coverage states altered.
- [x] No audit-event write paths touched (copy/doc/script only).
- [x] No PHI-on-chain language or behavior introduced.
- [x] No bare `Verified` status label introduced (offer name "Verified Clinician Career Packet" is a compound product name, not a status label — `banned-verified-label` gate passes).

## Validation Commands

| Command | Result |
| --- | --- |
| `pnpm check:claims` | **PASS** — 20 prohibited phrases checked, 0 hits on `apps/web/{app,components}` |
| `pnpm --filter @vitalcv/web exec tsc --noEmit` | **PASS** — exit 0, 0 errors |
| `pnpm --filter @vitalcv/web exec vitest run __tests__/banned-verified-label.test.ts __tests__/homepage-public-truth.test.tsx __tests__/public-wedge-parity.test.tsx __tests__/persona-landing-content.test.ts __tests__/passport-copy-truth.test.ts` | **PASS** — 5 files, 28 tests |

Not run (heavy / out of scope for a copy wave): full `next build` (requires `@vitalcv/trust-state` dist prebuild + Clerk/backend env) and Playwright e2e (`tests/e2e/**` is excluded by vitest config). The TypeScript gate that `next build` enforces is covered by the `tsc --noEmit` pass above.

## New Guardrail

`scripts/check-public-claims.ts` (wired as `pnpm check:claims`) scans the live public web surfaces for unsupported claims and exits non-zero on any hit. Add it to CI alongside the existing `apps/web/__tests__/banned-verified-label.test.ts` and `postrelease-truth-cleanup` copy guards.
