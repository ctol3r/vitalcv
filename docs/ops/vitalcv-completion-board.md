# VitalCV Full Scope Completion Board

Last updated: 2026-04-27
Source branch: `docs/full-scope-completion-board-deltas`

## Scoring Rules

- **Current %** = honest current state, evidenced by code on `origin/main`.
- **Target %** = 90% minimum for every major area.
- **Delta to 90%** = remaining gap (`Target − Current`).
- **Expected Wave Delta** = proposed movement for the next relevant wave. Planning value only.
- **Actual Wave Delta** = applied **only after merge + verification**. Until then it stays at `+0`.
- **No score moves on unmerged work.** A PR open or in review is not a delta.
- **Parent categories cannot hide low child rows.** Section roll-ups are computed from child rows, not asserted.
- **No row above 90% without implementation evidence**, all five required where relevant:
  - code merged to `main`
  - tests
  - user-facing route/UI
  - truth/compliance copy review
  - accessibility/mobile consideration
  - verification evidence (Codex / browser audit / live URL)

A row that fails any required-evidence check is capped at **75%** regardless of internal completeness.

## Required Table Schema

Every section uses this schema:

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|

Status vocabulary: `merged` · `boundary only` · `partial` · `not started` · `deferred` · `concept`.

---

## 🧠 Trust Engine / Issuer Infrastructure

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Issuer request / router | 80 | 90 | 10 | +0 | +0 | Routes + tests on main (#167) | merged |
| Partner route model | 75 | 90 | 15 | +0 | +0 | Partner router + tests (#167) | merged |
| Issuer response intake | 70 | 90 | 20 | +0 | +0 | Intake surface + tests (#168) | merged |
| Receipt candidate | 85 | 90 | 5 | +0 | +0 | `receiptCandidate.ts` + literal `decisionGrade:false`/`proofTier:'receipt_candidate'` tests | merged |
| Policy review decision | 85 | 90 | 5 | +0 | +0 | `policyReview.ts` 5-gate flow + tests | merged |
| PSV receipt promotion | 70 | 90 | 20 | +0 | +0 | PSV receipt + reuse boundary (#172) | merged |
| Reuse / revocation / supersession boundary | 75 | 90 | 15 | +0 | +0 | (#172) tests | merged |
| Consent / manual send / timeline | 70 | 90 | 20 | +0 | +0 | Consent + timeline (#174) | merged |
| Audit persistence boundary | 75 | 90 | 15 | +0 | +0 | (#175) `auditPersistence.ts` + tests | merged |
| Persistence adapter decision | 75 | 90 | 15 | +0 | +0 | (#176) | merged |
| Backend writer boundary | 75 | 90 | 15 | +0 | +0 | (#180) `serverPsvReceiptWriter.ts` defensive downgrade + tests; **deferred default writer only** | boundary only |
| Domain / core PSV receipt contract alignment | 80 | 90 | 10 | +0 | +0 | (#178) `packages/domain-core/psvReceipts.ts` + frozen mapper tests | merged |

---

## 🧑‍⚕️ Live Clinician Product

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Signup / account creation | 10 | 90 | 80 | +0 | +0 | Real auth (Clerk/NextAuth) wired; e2e signup test | not started |
| Login / account recovery | 10 | 90 | 80 | +0 | +0 | Sign-in flow + recovery; per memory `project_auth_google_oauth_config.md` Google OAuth currently broken in prod | not started |
| NPI check | 65 | 90 | 25 | +0 | +0 | NPPES proxy + ingest fallback in `apps/web/app/api/ingest/[npi]/route.ts` | partial |
| Rich clinician profile shell | 55 | 90 | 35 | +0 | +0 | 16-section profile shell on `/passport/[id]` (Wave GOD-2) | partial |
| Identity / contact / locations | 35 | 90 | 55 | +0 | +0 | Inputs exist as user-entered only; no verified binding | partial |
| Medical school | 25 | 90 | 65 | +0 | +0 | Free-text capture; no source verification | partial |
| Residency | 25 | 90 | 65 | +0 | +0 | Same | partial |
| Fellowship | 25 | 90 | 65 | +0 | +0 | Same | partial |
| Training programs | 20 | 90 | 70 | +0 | +0 | Same | partial |
| Specialty / subspecialty | 30 | 90 | 60 | +0 | +0 | Capture + NPPES inference only | partial |
| Current employer | 25 | 90 | 65 | +0 | +0 | User-entered, no employer-side verification | partial |
| Employer history | 20 | 90 | 70 | +0 | +0 | Same | partial |
| Affiliations | 20 | 90 | 70 | +0 | +0 | Same | partial |
| Work history | 20 | 90 | 70 | +0 | +0 | Same | partial |
| Research / publications | 15 | 90 | 75 | +0 | +0 | Section exists, no live source binding | partial |
| PubMed layer | 10 | 90 | 80 | +0 | +0 | Concept + MCP available; no in-product fetch / dedupe / display | concept |
| LinkedIn-style profile layer | 5 | 90 | 85 | +0 | +0 | Not built | not started |
| Doximity-style profile layer | 5 | 90 | 85 | +0 | +0 | Not built | not started |
| Career goals / preferences | 25 | 90 | 65 | +0 | +0 | Capture exists, no matching loop | partial |
| Profile completion score | 20 | 90 | 70 | +0 | +0 | No live score widget | partial |
| Clinician-facing value dashboard | 10 | 90 | 80 | +0 | +0 | Not built | not started |

---

## 📱 Mobile + Device Experience

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Mobile web / PWA | 35 | 90 | 55 | +0 | +0 | Responsive layout; PWA manifest foundation per Wave GOD-2; no installability/offline shell verified | partial |
| Native iOS app | 0 | 90 | 90 | +0 | +0 | None shipped | not started |
| Native Android app | 0 | 90 | 90 | +0 | +0 | None shipped | not started |
| Mobile document capture | 0 | 90 | 90 | +0 | +0 | None | not started |
| Device trust / App Attest / Play Integrity | 0 | 90 | 90 | +0 | +0 | None | not started |
| Biometric gating | 0 | 90 | 90 | +0 | +0 | None | not started |
| Push notification readiness | 0 | 90 | 90 | +0 | +0 | None | not started |
| Offline / degraded-state handling | 25 | 90 | 65 | +0 | +0 | Some 5xx graceful fallbacks (#LIVE-100C/D) but no offline data shell | partial |

---

## 🔐 Identity + Security

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Government ID verification | 0 | 90 | 90 | +0 | +0 | None | not started |
| Selfie / liveness | 0 | 90 | 90 | +0 | +0 | None | not started |
| Clinician-to-NPI binding | 15 | 90 | 75 | +0 | +0 | NPI lookup exists; no proven-person-to-NPI binding | partial |
| Identity proofing policy | 10 | 90 | 80 | +0 | +0 | No documented IAL/AAL policy | not started |
| Account recovery | 10 | 90 | 80 | +0 | +0 | Tied to broken auth slice | not started |
| Session security | 20 | 90 | 70 | +0 | +0 | Default Next/Clerk session handling, not hardened | partial |
| OWASP ASVS baseline | 15 | 90 | 75 | +0 | +0 | No published ASVS scorecard | not started |
| Security headers / secure defaults | 35 | 90 | 55 | +0 | +0 | Some headers via Next defaults; no audited CSP | partial |
| Data classification | 20 | 90 | 70 | +0 | +0 | Provenance vocab exists (VERIFIED/USER_ENTERED/INFERRED/UNKNOWN/CONFLICT); no PII/PHI tier doc | partial |
| Retention / redaction | 10 | 90 | 80 | +0 | +0 | No retention policy enforced | not started |
| Secrets / env handling | 30 | 90 | 60 | +0 | +0 | `.env` patterns in repo; no zod env validation (Phase 0.3 outstanding) | partial |

---

## ♿ Accessibility

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| WCAG 2.2 AA baseline | 12 | 90 | 78 | +0 | +0 | No published audit; no automated axe gate in CI | not started |
| Keyboard navigation | 25 | 90 | 65 | +0 | +0 | Default browser behavior; no audited focus traps | partial |
| Screen reader labels | 20 | 90 | 70 | +0 | +0 | Spot fixes; no systematic ARIA audit | partial |
| Touch targets | 30 | 90 | 60 | +0 | +0 | Mobile clip fixes (Wave GOD-2); no 44×44 audit | partial |
| Error-state accessibility | 15 | 90 | 75 | +0 | +0 | Error UIs not audited for SR | partial |
| Contrast | 30 | 90 | 60 | +0 | +0 | Design-system v2 tokens in flight on a separate branch | partial |
| Reduced motion | 10 | 90 | 80 | +0 | +0 | No prefers-reduced-motion handling verified | not started |
| Form accessibility | 15 | 90 | 75 | +0 | +0 | No labeled-region audit | partial |
| Mobile accessibility | 15 | 90 | 75 | +0 | +0 | Same | partial |

---

## 📤 Upload / Import / Export

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| CV upload | 25 | 90 | 65 | +0 | +0 | Knowledge Inbox foundation (#166) for free-text capture; binary CV upload not wired | partial |
| Document upload | 20 | 90 | 70 | +0 | +0 | Same | partial |
| Drag/drop upload UX | 15 | 90 | 75 | +0 | +0 | No verified DnD surface | not started |
| LinkedIn import | 5 | 90 | 85 | +0 | +0 | Not built | not started |
| Doximity import | 5 | 90 | 85 | +0 | +0 | Not built | not started |
| PubMed import | 10 | 90 | 80 | +0 | +0 | Concept; no in-product import | concept |
| CSV / roster import | 30 | 90 | 60 | +0 | +0 | Per existing board: "some CSV ingest; roster mgmt manual" | partial |
| Export bundle | 25 | 90 | 65 | +0 | +0 | `ARTIFACT_EXPORTED` event metadata exists; bundle UX partial | partial |
| Shareable passport | 35 | 90 | 55 | +0 | +0 | `/passport/[id]` route + provenance panel | partial |
| Proof pack export | 20 | 90 | 70 | +0 | +0 | Conceptual shape; no audited bundle | partial |
| Import error handling | 20 | 90 | 70 | +0 | +0 | Inbox classifier handles known states; UX surfacing partial | partial |
| Import provenance labels | 40 | 90 | 50 | +0 | +0 | 5-tier provenance vocab enforced (Wave GOD-3S) | partial |

---

## 🕸️ Knowledge Trust Graph

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Data model | 75 | 90 | 15 | +0 | +0 | `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` boundaries 1–28 | merged |
| Claim / source / receipt navigation | 60 | 90 | 30 | +0 | +0 | TrustGraph panel mounts on `/passport/[id]` | partial |
| Roam/Obsidian-style visual graph UX | 22 | 90 | 68 | +0 | +0 | Static panel only; no graph layout engine | partial |
| Graph search | 10 | 90 | 80 | +0 | +0 | Not built | not started |
| Graph filtering | 10 | 90 | 80 | +0 | +0 | Not built | not started |
| Graph export | 30 | 90 | 60 | +0 | +0 | Underlying JSON exportable; no UI export | partial |
| Clinician-facing graph explanation | 35 | 90 | 55 | +0 | +0 | Static explainer in panel | partial |
| Verifier-facing graph explanation | 30 | 90 | 60 | +0 | +0 | Same | partial |
| Graph-to-proof-pack path | 20 | 90 | 70 | +0 | +0 | Not connected end-to-end | partial |

---

## 🏥 Verifier / Employer Product

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Employer review | 60 | 90 | 30 | +0 | +0 | Issuer review surface (#168) demo render only — `recordedBy:'demo'` | partial |
| Request review | 55 | 90 | 35 | +0 | +0 | Same | partial |
| Verifier worklist | 30 | 90 | 60 | +0 | +0 | No audited multi-request worklist | partial |
| Evidence inspection | 50 | 90 | 40 | +0 | +0 | Receipt candidate viewer | partial |
| Reuse decision UX | 50 | 90 | 40 | +0 | +0 | (#172) reuse boundary surfaced in review | partial |
| Policy decision UX | 60 | 90 | 30 | +0 | +0 | Policy review 5-gate UX | partial |
| Exportable proof pack | 25 | 90 | 65 | +0 | +0 | Not bundled | partial |
| Team / org roles | 10 | 90 | 80 | +0 | +0 | None | not started |
| Review status tracking | 45 | 90 | 45 | +0 | +0 | Request lifecycle states present | partial |
| Employer CTA / conversion path | 40 | 90 | 50 | +0 | +0 | `/employers` redirect + `/pilot` CTA live | partial |

---

## 🏛️ Backend / Persistence / API

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Domain PSV receipt contract | 85 | 90 | 5 | +0 | +0 | (#178) frozen mapper tests | merged |
| Server writer confirmation boundary | 80 | 90 | 10 | +0 | +0 | (#180) defensive downgrade + tests | boundary only |
| Real persistence writer | 5 | 90 | 85 | +0 | +0 | Default writer is **deferred-only**; no contract-aligned Prisma table; no audit-event table; no client-safe RPC | deferred |
| Audit replay | 10 | 90 | 80 | +0 | +0 | No replay surface | not started |
| Export API | 15 | 90 | 75 | +0 | +0 | None client-safe | not started |
| Backend test coverage | 35 | 90 | 55 | +0 | +0 | Issuer 321/321 vitest pass; legacy backend repo lacks coverage | partial |
| API route hardening | 25 | 90 | 65 | +0 | +0 | No CORS/helmet/API key story (Phase 1.3) | partial |
| Repository adapter | 70 | 90 | 20 | +0 | +0 | (#176/#177) decision boundaries | boundary only |
| Database migration readiness | 5 | 90 | 85 | +0 | +0 | Per memory: SQLite + in-memory; PostgreSQL migration is Phase 1.1 (not started) | not started |

---

## 🚀 Commercial Launch Readiness

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Pricing / paywall | 5 | 90 | 85 | +0 | +0 | None | not started |
| Self-serve signup | 10 | 90 | 80 | +0 | +0 | Tied to auth slice | not started |
| Onboarding | 15 | 90 | 75 | +0 | +0 | No audited onboarding flow | partial |
| Support / admin | 10 | 90 | 80 | +0 | +0 | No support surface | not started |
| Pilot ops | 50 | 90 | 40 | +0 | +0 | `/pilot` CTA live; no funnel instrumentation | partial |
| Analytics | 20 | 90 | 70 | +0 | +0 | No PostHog product-analytics events confirmed end-to-end | partial |
| Docs / status page | 15 | 90 | 75 | +0 | +0 | No public status page | not started |
| Legal pages | 60 | 90 | 30 | +0 | +0 | `/privacy` and `/terms` live (#LIVE-100C) | partial |
| Sales / pilot collateral | 25 | 90 | 65 | +0 | +0 | Some pilot pages; no proof-pack | partial |
| Demo data / reset flow | 20 | 90 | 70 | +0 | +0 | Issuer review surface uses `recordedBy:'demo'` | partial |

---

## 🧪 Quality / CI / Release

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Web quality | 65 | 90 | 25 | +0 | +0 | TypeScript + ESLint enforced on build (no ignore flags); 321/321 issuer tests | merged |
| Monorepo CI/CD | 55 | 90 | 35 | +0 | +0 | Turbo workflows; merge-protection hook requires Codex SAFE | merged |
| Railway deploy preflight | 40 | 90 | 50 | +0 | +0 | (#179) excluded db-dependent backend packages from preflight smoke | partial |
| Vercel deploy health | 60 | 90 | 30 | +0 | +0 | Per memory `project_vercel_project_linkage.md`: vitalcv.com → `vcv-web` on `blockchaincv` team | partial |
| Regression test coverage | 45 | 90 | 45 | +0 | +0 | Heavy on issuer slice; thin elsewhere | partial |
| Route map coverage | 30 | 90 | 60 | +0 | +0 | No published route map gate | partial |
| Smoke tests | 35 | 90 | 55 | +0 | +0 | (#179) preflight smoke partial | partial |
| Release checklist | 20 | 90 | 70 | +0 | +0 | No published release checklist | not started |

---

## Wave Delta Format

Every future wave must include:

| Area | Before | After Target | Expected Delta | Actual Delta | Evidence Required | Apply When |
|---|---:|---:|---:|---:|---|---|
| Example | 20% | 35% | +15 | +0 until merge | Code + tests + route + docs | After merge + verification |

## Low-Score-First Attack Order

1. Signup / account creation
2. Identity proofing + gov ID / liveness
3. Mobile web / PWA onboarding
4. Rich clinician profile
5. Upload / import / export
6. Knowledge Graph visual UX
7. Accessibility / WCAG baseline
8. Research / PubMed layer
9. Verifier worklist / review UX
10. Native app readiness

## Notes on this revision

- Replaces the prior board's headline "100% wedge usability / 99% pilot-ready / 66% overall" framing. That framing rolled live-URL non-crashing into completion; the new schema treats route stability as one row of one section, not a system score.
- Trust-engine rows are the only ones permitted to sit in the 70–85 band; they have merged code on `main` (PRs #166–#180) and tests, but each is still capped below 90 because **real persistence is deferred** (#180), so the proof-of-action chain is incomplete end-to-end.
- Live clinician product, identity proofing, accessibility, mobile, and import/export rows are conservatively scored per the brief.
- All Expected/Actual Wave Deltas are `+0` in this PR — this PR is docs-only; it changes the framework, not the scores' underlying state.
