# W205 — Career Packet Implementation Report

**Wave:** 205 (Career Packet Implementation, P0)
**Branch:** `wave/career-evidence-network-alignment`
**Date:** 2026-06-20
**Status:** built + tested locally. Not committed/merged — Codex SAFE verdict still required before any `gh pr merge` (doctrine).

---

## Outcome

A recruiter can open `/packet/[entityId]` and answer all five success-criteria questions on one screen:

1. **Who is this clinician?** — Executive Summary + Identity
2. **What evidence exists?** — Verification Sources + Evidence
3. **What evidence is missing?** — Missing Evidence
4. **Are they ready?** — Recruiter status chip + Credential Readiness
5. **Can I move them forward?** — Employer View + gated PDF export

The UI and the PDF consume the **same** derivation layer (`lib/packet/career-packet.ts`), so the screen and the document cannot disagree. `READY` is provably reachable only for decision-grade passports with zero blockers.

---

## Files added

| File | Purpose | Wave item |
|---|---|---|
| `apps/web/lib/packet/career-packet.ts` | Pure derivation layer — `buildCareerPacket` + `deriveExecutiveSummary` / `deriveRecruiterRollup` / `deriveMissingEvidence` / `deriveRecommendations`. Single source of truth for UI + PDF. | W205-1, W205-3 |
| `apps/web/app/packet/[entityId]/page.tsx` | Server route (thin), `force-dynamic`. | W205-2 |
| `apps/web/app/packet/[entityId]/PacketClient.tsx` | Read-only client renderer of all ten sections + gated export button. No auth, no wallet, no mutations. | W205-2 |
| `apps/web/__tests__/career-packet-derive.test.ts` | 13 unit tests for the derivation layer + honesty invariants. | W205-1, W205-3 |
| `apps/web/__tests__/career-packet-pdf.test.ts` | 2 tests: PDF model == `buildCareerPacket`; export gate still blocks partial/gated. | W205-4 |
| `docs/wave205/packet-demo-walkthrough.md` | NPI → Passport → Packet → PDF → Employer Review demo script. | W205-5 |
| `docs/wave205/implementation-report.md` | This report. | output |

## Files modified

| File | Change | Wave item |
|---|---|---|
| `apps/web/lib/export/employer-proof-packet-pdf.tsx` | Extended `EmployerProofPacketPdfModel` with `careerPacket: CareerPacketModel` (built via `buildCareerPacket`); rendered Recruiter View / Credential Readiness / Missing Evidence / Recommendations sections from it. Footer copy "Verified by VitalCV" → "Source-backed by VitalCV". No change to existing `sourceRows` logic. | W205-4 |

---

## Routes added

- `GET /packet/[entityId]` (UI) — read-only Career Packet. Accepts entityId (UUID) or 10-digit NPI via the existing `fetchPassportEntity` path (`/api/passport/entity/[id]` or `/api/passport/npi/[npi]`).

No API route was changed. `GET /api/export/packet?npi=` is unchanged — its PDF output now includes the career sections because `renderEmployerProofPacketPdf` builds from the extended model. The existing export gate (`resolveEmployerPacketExportGate`) is untouched.

---

## Tests added / passing

| Suite | Tests | Result |
|---|---|---|
| `career-packet-derive.test.ts` | 13 | ✅ |
| `career-packet-pdf.test.ts` | 2 | ✅ |
| `employer-proof-packet.test.ts` (existing, regression) | 2 | ✅ |
| `export-packet-route.test.ts` (existing, regression) | 6 | ✅ |
| `employer-review-proxy.test.ts` (existing, regression) | 15 | ✅ |
| `banned-verified-label.test.ts` (existing, regression) | 1 | ✅ |

**Key honesty assertions proven:**
- `deriveRecruiterRollup` returns `ready` **only** for `DECISION_GRADE` with zero blockers; a `PARTIAL` fixture never returns `ready`.
- Readiness blockers force `blocked` even when status is `DECISION_GRADE`.
- `reviewRequired` coverage → `needs_review`; `gated` coverage → `missing_evidence`.
- Serialized packet contains no bare `"Verified"` status label.
- Degraded snapshots are flagged (`footer.degraded`).

---

## Validation performed

| Check | Command | Result |
|---|---|---|
| Unit + regression tests | `pnpm --filter @vitalcv/web exec vitest run …` | 38/38 pass across the 5 impacted suites |
| Public-claims guard | `pnpm check:claims` | PASS — 20 phrases checked, 0 hits on new surfaces |
| Bare-"Verified" guard | `vitest run __tests__/banned-verified-label.test.ts` | PASS |
| Typecheck | `tsc --noEmit` (apps/web) | exit 0, 0 errors |
| Route inventory | manual | `/passport`, `/passport/[id]`, `/packet/[entityId]`, `/api/export/packet`, `/review/[entityId]` all present — no broken links in the demo path |

---

## Acceptance-criteria check

- **W205-1** ✓ pure functions, no side effects, unit tested, same output used by UI and PDF (`career-packet-pdf.test.ts` asserts `model.careerPacket` deep-equals `buildCareerPacket(passport)`).
- **W205-2** ✓ loads existing PassportData via `fetchPassportEntity`, uses derivation layer, recruiter- and employer-readable, read-only, no auth/wallet changes.
- **W205-3** ✓ recruiter rollup with four states; `READY` requires decision-grade + zero blockers; partial never appears ready; unit tested.
- **W205-4** ✓ extends `/api/export/packet` PDF via `career-packet.ts`; same data as UI; no duplicate logic for new sections; export gate preserved.
- **W205-5** ✓ demo walkthrough doc; under-3-minute path; no dead ends; no broken routes.
- **W205-6** ✓ `pnpm check:claims` clean; no partial data represented as complete (partial-stays-partial enforced in both renderers); trust posture preserved.

---

## Remaining gaps / not done in this wave

1. **No `next build` run.** Local validation was tests + `tsc --noEmit` + `check:claims`. A full `pnpm turbo run build --filter @vitalcv/web` should run in CI before merge (it enforces TS + ESLint).
2. **Export route is still NPI-only.** `/packet/[entityId]` resolves the export link from `model.generatedFor.npi`; an entity that has no NPI cannot export a PDF (UI shows the gated message). A future `?entityId=` export path is deferred (was W200-1 gap G7, non-blocking for the demo).
3. **Share link is not wired.** The packet has no "share internally" affordance yet — that is W210-4 (recruiter share links), which reuses the existing `chk_*` token mechanism.
4. **No visual/QA pass on a live render.** Components use existing Tailwind tokens and primitive patterns but have not been screenshotted in a running app; recommend a Browser/Cowork QA pass per the operating stack.
5. **PDF sections are text-only.** The new PDF sections render as plain `@react-pdf` text blocks (functional, not styled to match the hero table). Visual polish deferred.
6. **Codex verification + merge.** Per doctrine, a real `codex exec` SAFE verdict (implementation / diff / copy audits) is required before `gh pr merge`. Not yet run.

---

## Suggested next step

Run `pnpm turbo run build --filter @vitalcv/web` in CI, then a Codex audit on the diff. After SAFE, the recruiter primitive (`deriveRecruiterRollup`) is ready to be lifted directly into **W210-2 (Recruiter Summary Card)** with no redefinition.
