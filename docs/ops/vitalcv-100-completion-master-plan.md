# VitalCV 100% Completion Master Plan

**Last updated:** 2026-05-07
**Scope:** Strategic plan from current state → production-scale launch
**Author:** OpenClaw planning layer (no code changes)

---

## 1. Executive Summary

### Current State

VitalCV is a pnpm + Turborepo monorepo with real NPI lookup, OIG/LEIE semantic checking, a JWT receipt verification chain, and a design system. The issuer/PSV trust chain has the strongest engineering depth (70–85% on trust-engine rows). Clinician product, employer/verifier product, auth hardening, persistence, and launch readiness are in the 5–65% range.

The product is **not yet safe to demo externally** (W17 copy blockers unresolved), **not yet safe to run a paid pilot** (auth, RBAC, real persistence, and security headers unfinished), and **not safe to sell at scale** (PostgreSQL, OWASP baseline, signing, SOC2 evidence all incomplete).

### What "100%" Means for VitalCV

100% is not a vanity score. It means all 20 criteria in the prompt's definition are simultaneously true. The sequence is:

1. Clinician enters NPI → source-backed readiness/passport (real sources, no fake checks)
2. Every readiness score bounded by real source coverage (gated/unknown ≠ decision-grade)
3. OIG/LEIE semantics distinct end-to-end (no-match ≠ possible-match ≠ exact-match)
4. Employer/verifier can inspect packet — knows what is known/unknown/stale/gated/contradictory
5. Employer acceptance writes durable audit event
6. Evidence bundles carry source, timestamp, payload ref, checksum, methodologyVersion, verifier identity, reproducibility path
7. Policy review + PSV receipt candidate → real PSV receipt promotion (gated, feature-flagged)
8. Cross-tenant reuse requires explicit consent
9. Verifier RBAC gates all verifier APIs
10. Uploads remain USER_ENTERED until real parsing/OCR/source confirmation
11. All demo/synthetic surfaces structurally marked
12. No unsupported vendor names in public surfaces
13. All user-facing routes pass smoke, a11y, truth, banned-string checks
14. Security baseline: CSP, HSTS, CORS allowlist, env validation, upload gates, RBAC
15. GTM funnel captures pilot interest with persona routing
16. Status/source-health surfaces communicate coverage honestly
17. Dossier/export surfaces disclaim unsigned status until signing is live
18. Launch readiness scorecard wired to live DB reads
19. Real PostgreSQL persistence (not SQLite/in-memory)
20. OWASP ASVS Level 1 scorecard published

### Honest Readiness Verdict

| Gate | Status | Blocking Issues |
|---|---|---|
| Safe to Demo | ❌ BLOCKED | W17-1 through W17-7 copy fixes not merged |
| Safe to Pilot | ❌ BLOCKED | Auth (Google OAuth prod), RBAC, real persistence, security headers |
| Safe to Sell at Scale | ❌ BLOCKED | PostgreSQL, OWASP, PSV promotion, signing, A11y CI gate |

---

## 2. Domain Coverage with Current % and Gap Analysis

All percentages from `docs/ops/vitalcv-completion-board.md` (last updated 2026-05-03).

### Trust Engine / Issuer Infrastructure

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| Issuer request/router | 80% | Real persistence, audit event write | Wave P3 |
| Receipt candidate | 85% | Real persistence | Wave P3 |
| Policy review decision | 85% | Real persistence writer | Wave P3 |
| PSV receipt promotion | 70% | Promotion path tests, cross-tenant consent | Wave P4 |
| Audit persistence boundary | 75% | Real Prisma table, client-safe RPC | Wave P5 |
| Real persistence writer | 5% | No Prisma table, no audit-event table | Wave P5 |
| DB migration readiness | 5% | SQLite only, PostgreSQL not started | Wave P5 |
| Source health classifier | 65% | Probe results not DB-backed, no alerting | Wave P11/P18 |

**Gap summary:** Trust engine logic is strong. The gap is entirely in persistence — no real DB, no real audit events, deferred writer only.

### Clinician Product

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| Signup | 10% (estimated) | No production-ready signup | Wave P2 |
| Login | 10% (estimated) | Google OAuth broken in prod | Wave P2 |
| NPI check | 65% | No Clinician-to-NPI binding persisted | Wave P12 |
| Rich profile | 75% | Auth gate missing, profile not persisted | Wave P12 |
| Identity/contact | 55% | No production auth gate | Wave P12 |
| Medical school/specialty | 25–30% | Foundation-only, not wired | Post-P12 |
| Clinician-NPI binding | 28% | No proven-person-to-NPI persistence | Wave P12 |
| Identity proofing | 25% | NPI + self-attested only, no IAL2 | Post-launch |
| Session security | 20% | Default Clerk, not hardened | Wave P1/P13 |

### Verifier/Employer Product

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| Employer review | 60% | Demo render only (recordedBy:'demo') | Wave P3 |
| Request review | 55% | Same as employer review | Wave P3 |
| Verifier worklist | 48% | dbBackedWorklist: false | Wave P6 |
| Evidence inspection | 50% | Receipt candidate viewer only | Wave P8 |
| Reuse decision UX | 65% | crossTenantReuseImplemented: false | Wave P4 |
| Policy decision UX | 75% | automatedPolicyEngine: false | Wave P3 |
| Team/org roles (RBAC) | 28% | invitationSystemLive: false, rbacEnforced: false | Wave P6 |

### Security

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| Clinician-NPI binding | 28% | No proven binding | Wave P12 |
| Identity proofing | 25% | Self-attested only | Post-launch |
| Session security | 20% | Not hardened | Wave P1 |
| OWASP ASVS baseline | 15% | No published scorecard | Post-P1 |
| Security headers | 35% | No audited CSP | Wave P1 |
| Secrets/env handling | 30% | No Zod env validation | Wave P13 |

### Backend/Persistence

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| Real persistence writer | 5% | No Prisma table, deferred only | Wave P5 |
| Audit replay | 18% | Read-side only for source-health | Wave P5 |
| DB migration readiness | 5% | No PostgreSQL migration | Wave P5 |
| API route hardening | 32% | No CORS/helmet story for public routes | Wave P1/P6 |

### Launch Readiness

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| Pricing/paywall | 28% | collectsPayment: false | Post-pilot |
| Self-serve signup | 32% | accountCreationProductionReady: false | Wave P2 |
| Onboarding | 38% | completesCredentialing: false | Post-P12 |
| Analytics | 40% | No vendor wired, no production pipeline | Wave P10 |
| Pilot ops | 50% | No funnel instrumentation | Wave P10 |

### Quality/CI

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| Web quality | 85% | Strong but no a11y gate | Wave P14 |
| Monorepo CI/CD | 65% | Merge-protection requires Codex SAFE | Ongoing |
| Smoke tests | 55% | Thin on clinician/mobile/marketing | Per wave |
| Release checklist | 20% | No published checklist | Wave P1 |

### Mobile

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| PWA | 42% | No verified installability/offline | Wave P16 |
| Native iOS/Android | 25% | Not started | Post-pilot |
| Push notifications | 0% | Not built | Post-launch |

### Accessibility

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| WCAG AA baseline | 25% | No axe CI gate | Wave P14 |
| Keyboard nav | 25% | Not audited | Wave P14 |
| Screen reader labels | 25% | Not audited end-to-end | Wave P14 |

### Upload/Export

| Domain | Current % | Gap | Critical Path |
|---|---:|---|---|
| CV upload | 25% | Binary upload not wired | Post-pilot |
| Document upload | 32% | entry_only status, not production | Post-pilot |
| Export bundle | 25% | No audited bundle | Wave P8/P9 |

---

## 3. Pre-Conditions Before Any Wave Starts

These must be true before every wave, without exception:

### Branch Discipline
- Always cut from `origin/main` using `git worktree add`, never `git checkout main`
- Branch name must match the wave slug (see each wave entry in File 2)
- Do not reuse or recycle worktrees from prior waves
- Do not remove worktrees you did not create

### Codex Merge Gate
- Three Codex audit prompts must run before `gh pr merge`:
  1. Implementation audit
  2. Diff audit
  3. Copy/truth audit
- A Codex SAFE verdict must be visible in the Claude Code Terminal transcript
- A `feature-dev:code-reviewer` subagent stand-in does NOT satisfy the merge hook
- Codex must be `codex exec` v0.125+

### Truth Contract
- No banned strings in any diff (see CLAUDE.md banned list)
- No new integration claims for NPDB, DEA, ABMS, SAM.gov, Doximity
- No bare "Verified" status labels
- No `automatically verified`, `guaranteed verification`, `complete credentialing`, `instant credentialing`, `legally accepted`, `risk transferred`, `final verification without review`, `source confirmed before response`, `certified compliant`, `HIPAA compliant`, `SOC2 certified`

### Completion Board
- Update `docs/ops/vitalcv-completion-board.md` as part of every wave PR
- Numbers move only on merge + verification
- Parent categories cannot hide low child rows

### Prisma Migration Gate
- No `prisma migrate` without explicit founder (Chris) approval
- Write the SQL plan to `docs/migrations/` before executing
- Wave P5 has a mandatory approval gate before any DB work proceeds

---

## 4. Immutable Constraints (Never Violate)

These constraints survive every wave and every future decision:

1. **No fake source claims.** If a source is gated, planned, or unavailable, the UI must say so.
2. **Nursys is REAL_NURSYS_ENABLED=false.** It must show a warning or be removed, not a green checkmark.
3. **NPDB, DEA, ABMS, SAM.gov, Doximity are not integrated.** They must never appear in public surfaces.
4. **decisionGrade: false is literal.** PSV receipt candidate has `decisionGrade: false`, `proofTier: 'receipt_candidate'`. Do not widen.
5. **Issuer-verification helpers are pure transforms.** No fetches, no DB writes, no audit-event writes in `receiptCandidate.ts` or `policyReview.ts`.
6. **Demo data must be structurally marked.** `recordedBy: 'demo'` and copy disclaimers are not optional.
7. **Prisma migration requires founder approval.** No exceptions.
8. **Codex SAFE verdict required before merge.** Not negotiable.
9. **Claude Code Terminal = primary builder.** Not OpenClaw, not Browser, not Cowork.
10. **All user-facing routes must pass smoke + truth + banned-string checks before merge.**
11. **OIG/LEIE semantics must be distinct.** no-match ≠ possible-match ≠ exact-match end-to-end.
12. **Cross-tenant reuse requires consent.** Never reuse evidence across tenants without explicit consent record.
13. **Uploads remain USER_ENTERED** until parsing/OCR/source confirmation is live.
14. **Launch readiness scorecard must be honest.** Do not inflate tier status.

---

## 5. Wave Sequencing Rationale

The wave sequence is driven by three principles:

**Principle 1: Unblock the critical path first.**
Nothing else matters if the product cannot be demoed. P0 (copy fixes) unblocks all external demos. P1 (security) and P2 (auth) unblock pilot signups. Without these three waves, no external progress is possible.

**Principle 2: Trust chain before persistence.**
The trust chain logic (issuer, PSV, policy review) is already strong in code. Wiring it to real persistence (P3, P4, P5) is the next highest leverage move. Once persistence is real, the audit trail becomes credible.

**Principle 3: Compliance-blocking before revenue-blocking.**
RBAC (P6), OIG semantics (P7), and evidence bundle completion (P8) are compliance prerequisites that make the pilot legally defensible. GTM (P10), source health (P11), and dossier signing (P9) follow naturally once the compliance stack is solid.

**The sequence:**
- P0 → Demo unblocked
- P1+P2 → Pilot login/auth unblocked
- P3+P4+P5 → Trust chain wired to real DB
- P6+P7+P8 → Pilot legally defensible
- P9+P10 → Revenue motion activated
- P11–P15 → Hardening and quality gates
- P16–P20 → Scale readiness

---

*This document is a planning artifact. It does not modify source code. All implementation must go through Claude Code Terminal → Codex → `gh pr merge` with SAFE verdict.*
