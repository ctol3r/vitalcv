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

## Status Lexicon

The Completion Board uses exact percentages plus emoji phase labels only. The phase is **derived from** Current %, never asserted independently.

| % Range | Status Emoji | Status Name |
|---:|---|---|
| 0% | 🧊 | Planned |
| 1–24% | 🌱 | Seed |
| 25–49% | 🧱 | Foundation |
| 50–69% | 🛠️ | Buildout |
| 70–89% | 🚀 | Hardening |
| 90–99% | ✅ | Target Zone |
| 100% | 🏁 | Complete |

Forbidden qualitative labels (must never appear in a Status cell or any wave delta report):

- very low
- low
- not started
- partial
- high
- almost done
- near complete
- strong
- near target
- above target

Lookup examples:

- 0% → 🧊 Planned
- 8% → 🌱 Seed
- 18% → 🌱 Seed
- 35% → 🧱 Foundation
- 58% → 🛠️ Buildout
- 82% → 🚀 Hardening
- 92% → ✅ Target Zone
- 100% → 🏁 Complete

This lexicon supersedes the prior board's qualitative status words. Work-state nuance (merged-on-main, boundary-only, deferred, concept) lives in the **Evidence Required** column, not in Status.

## Required Table Schema

Every section uses this schema:

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|

Status vocabulary: emoji phase derived from Current % per the [Status Lexicon](#status-lexicon) above. Never assert phase independently of percentage.

---

## 🧠 Trust Engine / Issuer Infrastructure

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Issuer request / router | 80 | 90 | 10 | +0 | +0 | Routes + tests on main (#167) | 🚀 Hardening |
| Partner route model | 75 | 90 | 15 | +0 | +0 | Partner router + tests (#167) | 🚀 Hardening |
| Issuer response intake | 70 | 90 | 20 | +0 | +0 | Intake surface + tests (#168) | 🚀 Hardening |
| Receipt candidate | 85 | 90 | 5 | +0 | +0 | `receiptCandidate.ts` + literal `decisionGrade:false`/`proofTier:'receipt_candidate'` tests | 🚀 Hardening |
| Policy review decision | 85 | 90 | 5 | +0 | +0 | `policyReview.ts` 5-gate flow + tests | 🚀 Hardening |
| PSV receipt promotion | 70 | 90 | 20 | +0 | +0 | PSV receipt + reuse boundary (#172) | 🚀 Hardening |
| Reuse / revocation / supersession boundary | 75 | 90 | 15 | +0 | +0 | (#172) tests | 🚀 Hardening |
| Consent / manual send / timeline | 70 | 90 | 20 | +0 | +0 | Consent + timeline (#174) | 🚀 Hardening |
| Audit persistence boundary | 75 | 90 | 15 | +0 | +0 | (#175) `auditPersistence.ts` + tests | 🚀 Hardening |
| Persistence adapter decision | 75 | 90 | 15 | +0 | +0 | (#176) | 🚀 Hardening |
| Backend writer boundary | 75 | 90 | 15 | +0 | +0 | (#180) `serverPsvReceiptWriter.ts` defensive downgrade + tests; **deferred default writer only** | 🚀 Hardening |
| Domain / core PSV receipt contract alignment | 80 | 90 | 10 | +0 | +0 | (#178) `packages/domain-core/psvReceipts.ts` + frozen mapper tests | 🚀 Hardening |
| Source health classifier | 65 | 90 | 25 | +0 | +65 | `SourceHealthState`, `LaneHealthBadge`, `unavailableLane` (#186); snapshot store, `runAllProbes`, internal `/api/internal/source-health/{probe,snapshots}` routes, scheduled workflow, source-health tests (#187) | 🛠️ Buildout |

---

## 🧑‍⚕️ Live Clinician Product

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Signup / account creation | 10 | 90 | 80 | +0 | +0 | Real auth (Clerk/NextAuth) wired; e2e signup test | 🌱 Seed |
| Login / account recovery | 10 | 90 | 80 | +0 | +0 | Sign-in flow + recovery; per memory `project_auth_google_oauth_config.md` Google OAuth currently broken in prod | 🌱 Seed |
| NPI check | 65 | 90 | 25 | +0 | +0 | NPPES proxy + ingest fallback in `apps/web/app/api/ingest/[npi]/route.ts` | 🛠️ Buildout |
| Rich clinician profile shell | 55 | 90 | 35 | +0 | +0 | 16-section profile shell on `/passport/[id]` (Wave GOD-2) | 🛠️ Buildout |
| Identity / contact / locations | 35 | 90 | 55 | +0 | +0 | Inputs exist as user-entered only; no verified binding | 🧱 Foundation |
| Medical school | 25 | 90 | 65 | +0 | +0 | Free-text capture; no source verification | 🧱 Foundation |
| Residency | 25 | 90 | 65 | +0 | +0 | Same | 🧱 Foundation |
| Fellowship | 25 | 90 | 65 | +0 | +0 | Same | 🧱 Foundation |
| Training programs | 20 | 90 | 70 | +0 | +0 | Same | 🌱 Seed |
| Specialty / subspecialty | 30 | 90 | 60 | +0 | +0 | Capture + NPPES inference only | 🧱 Foundation |
| Current employer | 25 | 90 | 65 | +0 | +0 | User-entered, no employer-side verification | 🧱 Foundation |
| Employer history | 20 | 90 | 70 | +0 | +0 | Same | 🌱 Seed |
| Affiliations | 20 | 90 | 70 | +0 | +0 | Same | 🌱 Seed |
| Work history | 20 | 90 | 70 | +0 | +0 | Same | 🌱 Seed |
| Research / publications | 15 | 90 | 75 | +0 | +0 | Section exists, no live source binding | 🌱 Seed |
| PubMed layer | 10 | 90 | 80 | +0 | +0 | Concept + MCP available; no in-product fetch / dedupe / display | 🌱 Seed |
| LinkedIn-style profile layer | 5 | 90 | 85 | +0 | +0 | Not built | 🌱 Seed |
| Doximity-style profile layer | 5 | 90 | 85 | +0 | +0 | Not built | 🌱 Seed |
| Career goals / preferences | 25 | 90 | 65 | +0 | +0 | Capture exists, no matching loop | 🧱 Foundation |
| Profile completion score | 20 | 90 | 70 | +0 | +0 | No live score widget | 🌱 Seed |
| Clinician-facing value dashboard | 10 | 90 | 80 | +0 | +0 | Not built | 🌱 Seed |

---

## 📱 Mobile + Device Experience

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Mobile web / PWA | 35 | 90 | 55 | +0 | +0 | Responsive layout; PWA manifest foundation per Wave GOD-2; no installability/offline shell verified | 🧱 Foundation |
| Native iOS app | 0 | 90 | 90 | +0 | +0 | None shipped | 🧊 Planned |
| Native Android app | 0 | 90 | 90 | +0 | +0 | None shipped | 🧊 Planned |
| Mobile document capture | 0 | 90 | 90 | +0 | +0 | None | 🧊 Planned |
| Device trust / App Attest / Play Integrity | 0 | 90 | 90 | +0 | +0 | None | 🧊 Planned |
| Biometric gating | 0 | 90 | 90 | +0 | +0 | None | 🧊 Planned |
| Push notification readiness | 0 | 90 | 90 | +0 | +0 | None | 🧊 Planned |
| Offline / degraded-state handling | 25 | 90 | 65 | +0 | +0 | Some 5xx graceful fallbacks (#LIVE-100C/D) but no offline data shell | 🧱 Foundation |

---

## 🔐 Identity + Security

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Government ID verification | 0 | 90 | 90 | +0 | +0 | None | 🧊 Planned |
| Selfie / liveness | 0 | 90 | 90 | +0 | +0 | None | 🧊 Planned |
| Clinician-to-NPI binding | 15 | 90 | 75 | +0 | +0 | NPI lookup exists; no proven-person-to-NPI binding | 🌱 Seed |
| Identity proofing policy | 10 | 90 | 80 | +0 | +0 | No documented IAL/AAL policy | 🌱 Seed |
| Account recovery | 10 | 90 | 80 | +0 | +0 | Tied to broken auth slice | 🌱 Seed |
| Session security | 20 | 90 | 70 | +0 | +0 | Default Next/Clerk session handling, not hardened | 🌱 Seed |
| OWASP ASVS baseline | 15 | 90 | 75 | +0 | +0 | No published ASVS scorecard | 🌱 Seed |
| Security headers / secure defaults | 35 | 90 | 55 | +0 | +0 | Some headers via Next defaults; no audited CSP | 🧱 Foundation |
| Data classification | 20 | 90 | 70 | +0 | +0 | Provenance vocab exists (VERIFIED/USER_ENTERED/INFERRED/UNKNOWN/CONFLICT); no PII/PHI tier doc | 🌱 Seed |
| Retention / redaction | 10 | 90 | 80 | +0 | +0 | No retention policy enforced | 🌱 Seed |
| Secrets / env handling | 30 | 90 | 60 | +0 | +0 | `.env` patterns in repo; no zod env validation (Phase 0.3 outstanding) | 🧱 Foundation |

---

## ♿ Accessibility

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| WCAG 2.2 AA baseline | 12 | 90 | 78 | +0 | +0 | No published audit; no automated axe gate in CI | 🌱 Seed |
| Keyboard navigation | 25 | 90 | 65 | +0 | +0 | Default browser behavior; no audited focus traps | 🧱 Foundation |
| Screen reader labels | 20 | 90 | 70 | +0 | +0 | Spot fixes; no systematic ARIA audit | 🌱 Seed |
| Touch targets | 30 | 90 | 60 | +0 | +0 | Mobile clip fixes (Wave GOD-2); no 44×44 audit | 🧱 Foundation |
| Error-state accessibility | 15 | 90 | 75 | +0 | +0 | Error UIs not audited for SR | 🌱 Seed |
| Contrast | 30 | 90 | 60 | +0 | +0 | Design-system v2 tokens in flight on a separate branch | 🧱 Foundation |
| Reduced motion | 10 | 90 | 80 | +0 | +0 | No prefers-reduced-motion handling verified | 🌱 Seed |
| Form accessibility | 15 | 90 | 75 | +0 | +0 | No labeled-region audit | 🌱 Seed |
| Mobile accessibility | 15 | 90 | 75 | +0 | +0 | Same | 🌱 Seed |

---

## 📤 Upload / Import / Export

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| CV upload | 25 | 90 | 65 | +0 | +0 | Knowledge Inbox foundation (#166) for free-text capture; binary CV upload not wired | 🧱 Foundation |
| Document upload | 20 | 90 | 70 | +0 | +0 | Same | 🌱 Seed |
| Drag/drop upload UX | 15 | 90 | 75 | +0 | +0 | No verified DnD surface | 🌱 Seed |
| LinkedIn import | 5 | 90 | 85 | +0 | +0 | Not built | 🌱 Seed |
| Doximity import | 5 | 90 | 85 | +0 | +0 | Not built | 🌱 Seed |
| PubMed import | 10 | 90 | 80 | +0 | +0 | Concept; no in-product import | 🌱 Seed |
| CSV / roster import | 30 | 90 | 60 | +0 | +0 | Per existing board: "some CSV ingest; roster mgmt manual" | 🧱 Foundation |
| Export bundle | 25 | 90 | 65 | +0 | +0 | `ARTIFACT_EXPORTED` event metadata exists; bundle UX partial | 🧱 Foundation |
| Shareable passport | 35 | 90 | 55 | +0 | +0 | `/passport/[id]` route + provenance panel | 🧱 Foundation |
| Proof pack export | 20 | 90 | 70 | +0 | +0 | Conceptual shape; no audited bundle | 🌱 Seed |
| Import error handling | 20 | 90 | 70 | +0 | +0 | Inbox classifier handles known states; UX surfacing partial | 🌱 Seed |
| Import provenance labels | 40 | 90 | 50 | +0 | +0 | 5-tier provenance vocab enforced (Wave GOD-3S) | 🧱 Foundation |

---

## 🕸️ Knowledge Trust Graph

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Data model | 75 | 90 | 15 | +0 | +0 | `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` boundaries 1–28 | 🚀 Hardening |
| Claim / source / receipt navigation | 60 | 90 | 30 | +0 | +0 | TrustGraph panel mounts on `/passport/[id]` | 🛠️ Buildout |
| Roam/Obsidian-style visual graph UX | 22 | 90 | 68 | +0 | +0 | Static panel only; no graph layout engine | 🌱 Seed |
| Graph search | 10 | 90 | 80 | +0 | +0 | Not built | 🌱 Seed |
| Graph filtering | 10 | 90 | 80 | +0 | +0 | Not built | 🌱 Seed |
| Graph export | 30 | 90 | 60 | +0 | +0 | Underlying JSON exportable; no UI export | 🧱 Foundation |
| Clinician-facing graph explanation | 35 | 90 | 55 | +0 | +0 | Static explainer in panel | 🧱 Foundation |
| Verifier-facing graph explanation | 30 | 90 | 60 | +0 | +0 | Same | 🧱 Foundation |
| Graph-to-proof-pack path | 20 | 90 | 70 | +0 | +0 | Not connected end-to-end | 🌱 Seed |

---

## 🏥 Verifier / Employer Product

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Employer review | 60 | 90 | 30 | +0 | +0 | Issuer review surface (#168) demo render only — `recordedBy:'demo'` | 🛠️ Buildout |
| Request review | 55 | 90 | 35 | +0 | +0 | Same | 🛠️ Buildout |
| Verifier worklist | 30 | 90 | 60 | +0 | +0 | No audited multi-request worklist | 🧱 Foundation |
| Evidence inspection | 50 | 90 | 40 | +0 | +0 | Receipt candidate viewer | 🛠️ Buildout |
| Reuse decision UX | 50 | 90 | 40 | +0 | +0 | (#172) reuse boundary surfaced in review | 🛠️ Buildout |
| Policy decision UX | 60 | 90 | 30 | +0 | +0 | Policy review 5-gate UX | 🛠️ Buildout |
| Exportable proof pack | 25 | 90 | 65 | +0 | +0 | Not bundled | 🧱 Foundation |
| Team / org roles | 10 | 90 | 80 | +0 | +0 | None | 🌱 Seed |
| Review status tracking | 45 | 90 | 45 | +0 | +0 | Request lifecycle states present | 🧱 Foundation |
| Employer CTA / conversion path | 40 | 90 | 50 | +0 | +0 | `/employers` redirect + `/pilot` CTA live | 🧱 Foundation |

---

## 🏛️ Backend / Persistence / API

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Domain PSV receipt contract | 85 | 90 | 5 | +0 | +0 | (#178) frozen mapper tests | 🚀 Hardening |
| Server writer confirmation boundary | 80 | 90 | 10 | +0 | +0 | (#180) defensive downgrade + tests | 🚀 Hardening |
| Real persistence writer | 5 | 90 | 85 | +0 | +0 | Default writer is **deferred-only**; no contract-aligned Prisma table; no audit-event table; no client-safe RPC | 🌱 Seed |
| Audit replay | 18 | 90 | 72 | +0 | +8 | (#187) snapshot store + `getLaneSnapshots` fallback give a read-side replay path for source-health lanes | 🌱 Seed |
| Export API | 15 | 90 | 75 | +0 | +0 | None client-safe | 🌱 Seed |
| Backend test coverage | 42 | 90 | 48 | +0 | +7 | Issuer 321/321 vitest pass; (#187) adds 88-test source-health suite (runAllProbes, snapshotStore, probeRoute, snapshotsRoute, noFakeLive); legacy backend repo still lacks coverage | 🧱 Foundation |
| API route hardening | 32 | 90 | 58 | +0 | +7 | (#187) internal source-health routes use dual-auth (Bearer `CRON_SECRET` preferred; `x-monitoring-secret` legacy) and 500 fail-closed when both unset; no CORS/helmet/API key story for public routes (Phase 1.3) | 🧱 Foundation |
| Repository adapter | 70 | 90 | 20 | +0 | +0 | (#176/#177) decision boundaries | 🚀 Hardening |
| Database migration readiness | 5 | 90 | 85 | +0 | +0 | Per memory: SQLite + in-memory; PostgreSQL migration is Phase 1.1 (not started) | 🌱 Seed |

---

## 🚀 Commercial Launch Readiness

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Pricing / paywall | 5 | 90 | 85 | +0 | +0 | None | 🌱 Seed |
| Self-serve signup | 10 | 90 | 80 | +0 | +0 | Tied to auth slice | 🌱 Seed |
| Onboarding | 15 | 90 | 75 | +0 | +0 | No audited onboarding flow | 🌱 Seed |
| Support / admin | 10 | 90 | 80 | +0 | +0 | No support surface | 🌱 Seed |
| Pilot ops | 50 | 90 | 40 | +0 | +0 | `/pilot` CTA live; no funnel instrumentation | 🛠️ Buildout |
| Analytics | 20 | 90 | 70 | +0 | +0 | No PostHog product-analytics events confirmed end-to-end | 🌱 Seed |
| Docs / status page | 15 | 90 | 75 | +0 | +0 | No public status page | 🌱 Seed |
| Legal pages | 60 | 90 | 30 | +0 | +0 | `/privacy` and `/terms` live (#LIVE-100C) | 🛠️ Buildout |
| Sales / pilot collateral | 25 | 90 | 65 | +0 | +0 | Some pilot pages; no proof-pack | 🧱 Foundation |
| Demo data / reset flow | 20 | 90 | 70 | +0 | +0 | Issuer review surface uses `recordedBy:'demo'` | 🌱 Seed |

---

## 🧪 Quality / CI / Release

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Web quality | 65 | 90 | 25 | +0 | +0 | TypeScript + ESLint enforced on build (no ignore flags); 321/321 issuer tests | 🛠️ Buildout |
| Monorepo CI/CD | 55 | 90 | 35 | +0 | +0 | Turbo workflows; merge-protection hook requires Codex SAFE | 🛠️ Buildout |
| Railway deploy preflight | 40 | 90 | 50 | +0 | +0 | (#179) excluded db-dependent backend packages from preflight smoke | 🧱 Foundation |
| Vercel deploy health | 60 | 90 | 30 | +0 | +0 | Per memory `project_vercel_project_linkage.md`: vitalcv.com → `vcv-web` on `blockchaincv` team | 🛠️ Buildout |
| Regression test coverage | 50 | 90 | 40 | +0 | +5 | Heavy on issuer slice; (#186/#187) source-health suite at 88/88 in 9 files; still thin in clinician/mobile/marketing surfaces | 🛠️ Buildout |
| Route map coverage | 30 | 90 | 60 | +0 | +0 | No published route map gate | 🧱 Foundation |
| Smoke tests | 45 | 90 | 45 | +0 | +10 | (#179) preflight smoke partial; (#187) `.github/workflows/source-health-probe.yml` adds a 6h cron-driven CI smoke against the source-health classifier | 🧱 Foundation |
| Release checklist | 20 | 90 | 70 | +0 | +0 | No published release checklist | 🌱 Seed |

---

## Wave Delta Format

Every future wave must include:

| Area | Before | After Target | Expected Delta | Actual Delta | Evidence Required | Apply When |
|---|---:|---:|---:|---:|---|---|
| Example | 20% | 35% | +15 | +0 until merge | Code + tests + route + docs | After merge + verification |

## Future Wave Reporting Rule

Every future wave must report each affected row with:

- exact Current %
- exact After Target %
- exact Expected Delta
- exact Actual Delta (stays at `+0` until merge + verification)
- emoji phase label derived from the resulting % (per [Status Lexicon](#status-lexicon))
- Evidence Required (code merged, tests, route/UI, truth/copy review, accessibility/mobile, verification)
- Apply When condition (merge + verification gate)

Do not use qualitative maturity words ("very low", "low", "not started", "partial", "high", "almost done", "near complete", "strong", "near target", "above target") in place of percentages or in place of the emoji phase. Numbers move on merge + verification only; the emoji phase is **derived from** the percentage, never asserted independently. Work-state nuance (merged-on-main, boundary-only, deferred default writer, concept-only) belongs in Evidence Required, not in Status.

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
- All Expected/Actual Wave Deltas are `+0` in the framework PR — that PR is docs-only; it changes the framework, not the scores' underlying state.

## RELIABILITY-2 board delta (PR #187 evidence)

RELIABILITY-1 (#186) and RELIABILITY-2 (#187) shipped `SourceHealthState`, `LaneHealthBadge`, `unavailableLane`, the snapshot store, `runAllProbes`, internal `/api/internal/source-health/probe` and `/snapshots` routes, the scheduled `source-health-probe.yml` workflow, and the source-health test suite (88/88). This board delta records that evidence on existing full-scope rows and adds one new row (`Source health classifier`) under Trust Engine — without reviving old aggregate roll-up rows (`Drift + Monitoring`, `Source Spine`, `Truth / Enforcement`, `Enterprise-Ready Completion`, `Overall VitalCV Completion`), which were intentionally retired by the full-scope schema.
