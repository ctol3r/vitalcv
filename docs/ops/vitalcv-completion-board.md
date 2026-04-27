# VitalCV Completion Board

**Last Updated**: 2026-04-27 (post BACKEND-2 / OPS-DEPLOY-3)
**Source**: BOARD-RESET-100 — honest product-readiness reset.

## Philosophy

This board tracks two distinct things side by side:

1. **Trust engine / issuer infrastructure** — the verification chain (ISSUER-1..9 + BACKEND-1..2). This is mature, gated, and tested.
2. **Live clinician product** — what an actual clinician or employer can use on vitalcv.com. This is much less mature.

A high trust-engine score does not imply product readiness. The point of this board is to make that gap explicit so future waves attack the lowest-completion areas.

### Scoring rule

**No area may be raised above 90% unless ALL of:**
- Implementation exists (not types/contracts only).
- Tests cover the area.
- A concrete UX route exists (or N/A explicitly justified).
- Accessibility / truth-copy review has run.
- Verification evidence exists (a wave with merge SHA + Codex SAFE in transcript, OR a documented external audit).

If any of those is missing, the cap is 89%.

---

## A. TRUST ENGINE / ISSUER INFRASTRUCTURE

| Area | Completion | Delta | Why / Evidence |
|:---|:---|:---|:---|
| Issuer request / partner router | 88% | new row | ISSUER-1 (PR #167). Request types, partner-category router, status copy, demo route. |
| Issuer response intake / receipt candidate | 88% | new row | ISSUER-2 (PR #168). 7 status mappings, contracted-agent vs source preserved. 28 tests. |
| Policy review decision | 88% | new row | ISSUER-3 (PR #169). 5-gate accept logic, defense-in-depth on `legally_only`. 37 tests. |
| PSV receipt promotion | 87% | new row | ISSUER-4 (PR #171). Literal `decisionGrade: true`, `globalCredentialTruth: false`. 34 tests. |
| Reuse + revocation boundary | 87% | new row | ISSUER-5 (PR #172). Modeled (not polled) revocation/supersession. 38 tests. |
| Consent + manual send link + lifecycle timeline | 86% | new row | ISSUER-6 (PR #174). Attested vs observed gates. 31 tests. |
| Audit persistence boundary (demo writer) | 86% | new row | ISSUER-7 (PR #175). `pending_not_written` default, defensive downgrade. 31 tests. |
| Persistence adapter decision | 86% | new row | ISSUER-8 (PR #176). 5 adapter kinds, repository_candidate not persisted. 31 tests. |
| Backend persistence decision (defer) | 85% | new row | ISSUER-9 (PR #177). 9-capability gate, defer-by-default. 31 tests + defer memo. |
| Domain contract alignment | 85% | new row | BACKEND-1 (PR #178). `DomainPsvReceipt` types, mapper, validator. 18 new frozen tests. |
| Server writer boundary (deferred) | 85% | new row | BACKEND-2 (PR #180). `ServerPsvReceiptWriter` contract, deferred default, defensive downgrade. 34 tests. |
| Knowledge Trust Graph spec | 90% | new row | 84 nodes, ~95 edges, ~50 rules, 60 boundaries. Co-evolves with every wave. |

**Section overall: 87%.** Real, tested, contract-checked, demo-rendered. The boundary between "scoped evidence" and "global credential truth" is enforced at the type level. Real backend persistence is intentionally deferred and documented.

---

## B. LIVE CLINICIAN PRODUCT

This section measures what a real clinician on vitalcv.com can actually do.

| Area | Completion | Delta | Why / Evidence |
|:---|:---|:---|:---|
| Signup / account creation | 35% | 🔻 new honest row | Clerk sign-in/sign-up routes exist (`/sign-in`, `/sign-up`). No identity-proofing onboarding, no MFA enforcement, no documented account-recovery UX. |
| NPI check (NPPES identity) | 70% | from "Source Spine" | NPPES proxy works; honest fallback for OIG/PECOS. NPPES is identity-only — does not prove licensure (truth contract enforces). |
| Clinician profile data model | 55% | 🔻 from inflated 82% | 16 sections exist with provenance vocabulary (VERIFIED / USER_ENTERED / INFERRED / UNKNOWN / CONFLICT). Most fields are USER_ENTERED with no PSV path. |
| Education / training data | 30% | 🔻 new honest row | Schema fields exist; no end-to-end import; verification path exists in issuer chain (residency claim) but not yet wired into product UX. |
| Work / affiliations data | 25% | 🔻 new honest row | Schema only. No employer-import, no work-history verification UX. |
| Research / publications | 10% | 🔻 new honest row | No PubMed integration, no DOI/ORCID linking, no manuscript ingest. Listed as a section heading on profile. |
| Upload / import / export | 25% | from "Bulk / CSV / Imports" | Knowledge Inbox classification works (USER_ENTERED / INFERRED). No CSV import for profiles, no document-upload OCR, no export-to-FHIR/JSON-LD. |
| Knowledge graph visual UX | 25% | 🔻 new honest row | Static 9-node panel + collapsible TrustGraphXRay component on `/passport/[id]`. Not interactive, not searchable, not the full ~84-node graph. |
| Mobile web (PWA) | 50% | 🔻 from "100% mobile UI clips fixed" | Mobile breakpoints render; PWA manifest exists. No offline mode, no push notifications, no install flow tested on iOS/Android. |
| Native mobile | 0% | 🔻 new row | No `apps/mobile` build. No iOS / Android app. No app-store submission. |
| Accessibility (WCAG 2.2 AA) | 15% | 🔻 new honest row | Semantic HTML used; no axe / Pa11y / Lighthouse-a11y baseline; no screen-reader audit; no keyboard-nav verification; no contrast audit. |
| Identity proofing (NIST SP 800-63 IAL2/IAL3) | 0% | 🔻 new row | No government-ID capture, no biometric, no liveness, no AAMVA, no ID.me/Persona/Stripe Identity. Clerk handles auth, not proofing. |

**Section overall: 28%.** The product is structurally a profile editor with verified-identity-via-NPPES on top. Most clinical-truth-bearing data is USER_ENTERED. Mobile and identity proofing are essentially unimplemented.

---

## C. VERIFIER PRODUCT

| Area | Completion | Delta | Why / Evidence |
|:---|:---|:---|:---|
| Employer review surface | 65% | 🔻 from inflated 88% | `apps/web/components/review/EmployerDecisionConsole.tsx` and `/employer/review/[applicationId]` exist; live-tested in pilot path. Truth contract for review actions in place. Not yet integrated with proof-pack export at the verifier UX level. |
| Request review (issuer side) | 60% | new row | `/issuer/request/[requestId]` demo (ISSUER-6). No integration into a real verifier worklist. |
| Evidence inspection | 55% | new row | `/issuer/review`, `/issuer/policy-review`, `/issuer/psv-receipt`, `/issuer/psv-reuse` demo surfaces. Render verbatim contract; no aggregation across receipts. |
| Reuse decision UX | 55% | new row | `/issuer/psv-reuse/[receiptId]` demo. Capability matrix renders; no operator workflow integration. |
| Policy decision UX | 55% | new row | `/issuer/policy-review/[requestId]` demo. Six actions render; no persistence. |
| Exportable proof pack | 30% | 🔻 new honest row | Trust-state types exist; `apps/web/components/trust/TrustContainerPanel.tsx` renders; export-to-PDF / export-to-VC / employer-shareable URL not productized. |
| Verifier worklist / queue | 10% | 🔻 new row | No queue UX. Single-application review only. |

**Section overall: 47%.** Demo surfaces are abundant; the integrated verifier flow (worklist → review → decide → export) is fragmented.

---

## D. SECURITY / COMPLIANCE

| Area | Completion | Delta | Why / Evidence |
|:---|:---|:---|:---|
| ASVS baseline (OWASP) | 20% | 🔻 new honest row | Clerk auth, env validation, banned-string sweep on diffs. No documented ASVS L1/L2 self-assessment. |
| NIST SP 800-63 identity proofing | 0% | 🔻 new honest row | No IAL2/IAL3 path. Clerk provides AAL2-style auth (TOTP / passkey support exists in Clerk SDK, not enforced). |
| NIST SP 800-63 authenticator strength | 25% | 🔻 new row | Clerk default password rules; MFA available via Clerk dashboard, not enforced in product. |
| WCAG 2.2 accessibility | 15% | 🔻 new row | See Section B. |
| Data classification | 35% | 🔻 new honest row | Provenance vocabulary (VERIFIED / USER_ENTERED / INFERRED / UNKNOWN / CONFLICT) functions as in-app classification. No formal PII / PHI tagging in DB schema. |
| Retention / redaction | 15% | 🔻 new row | No documented retention policy. No delete-my-account flow. No PII redaction tooling. |
| Consent / release | 60% | new row | ISSUER-6 consent gate is real; `ConsentArtifact` carried through to send link; release-form-required state modeled. Not yet wired to a signed-release-form upload UX. |
| Audit persistence | 30% | 🔻 from inflated 70% | The audit BOUNDARY exists (ISSUER-7..9); no real audit-event row is written today (boundary returns `pending_not_written` by default; backend writer deferred). |
| Device attestation | 0% | 🔻 new row | No WebAuthn-bound device attestation. No mobile-app attestation (no native app). |
| HIPAA architectural readiness | 10% | 🔻 from inflated 35% | BAA-with-vendors not documented. PHI segregation not architected. Encryption-at-rest depends on vendor defaults. |
| SOC2 readiness | 5% | 🔻 from inflated 35% | No documented controls, no auditor engagement, no continuous-compliance tooling. |

**Section overall: 18%.** This is the area most likely to block enterprise sales. The truth contract enforces honest copy, but the underlying compliance posture is early.

---

## E. COMMERCIAL LAUNCH READINESS

| Area | Completion | Delta | Why / Evidence |
|:---|:---|:---|:---|
| Self-serve signup flow | 35% | 🔻 from inflated | Clerk sign-up works. No clinician-onboarding walkthrough, no first-run profile-completion wizard, no welcome email sequence verified. |
| Pricing / paywall | 0% | 🔻 new row | No Stripe integration, no plans, no billing. Pilot is free-form. |
| Onboarding (clinician) | 25% | 🔻 new row | Pilot intake works; no guided "complete your profile" flow with progress indicator. |
| Onboarding (employer / verifier) | 30% | 🔻 new row | Employer review works in single-application context. No team setup, no role-based access. |
| Support / admin tooling | 15% | 🔻 new row | No admin UI for viewing user accounts, resetting state, or impersonating for support. |
| Pilot ops | 70% | 🔻 from inflated 93% | Pilot funnel is unbroken end-to-end (LIVE-100..102 evidence). Outreach/CRM is manual. |
| Analytics | 25% | 🔻 new row | PostHog package in repo (`@plugin:posthog`). No documented event taxonomy, no funnel dashboards, no LLM analytics wired despite plugin availability. |
| Public docs (clinician + employer) | 20% | 🔻 new row | `docs/architecture/*` is internal. No public-facing user docs at /docs or help.vitalcv.com. |
| Status page / incident comms | 5% | 🔻 new row | No public status page, no incident playbook, no postmortem template. |

**Section overall: 25%.** A working product, not a commercial product.

---

## OVERALL ROLLUP

| Surface | Completion | Notes |
|:---|:---|:---|
| **A. Trust Engine / Issuer Infrastructure** | **87%** | Real, tested, gated. Most mature surface in the codebase. |
| **B. Live Clinician Product** | **28%** | Dragged down by 0% native mobile, 0% identity proofing, ~15% accessibility. |
| **C. Verifier Product** | **47%** | Demo-heavy; integrated worklist missing. |
| **D. Security / Compliance** | **18%** | Truth-contract enforced; compliance posture early. |
| **E. Commercial Launch Readiness** | **25%** | Pilot-runnable; not commercially launchable. |
| **Weighted Overall (equal sections)** | **41%** | The trust engine is leading the rest of the product by a wide margin. |

The previous board's "Overall VitalCV Completion: 66%" was a trust-engine-weighted number that did not honestly include native mobile, identity proofing, accessibility, or commercial readiness. The corrected number is **41%**.

---

## LOWEST-SCORE ATTACK ORDER

Concrete priority queue for the next several waves. Numbered roughly by completion-gap × buyer-impact.

1. **Identity Proofing / Signup hardening** (Section B, currently 0%/35%) — without IAL2 the product cannot make any clinician-grade trust claim about identity. Wire ID.me / Persona / Stripe Identity as a candidate; document NIST SP 800-63 mapping; enforce MFA.
2. **Mobile Web / PWA + Native App Strategy** (Section B, 50%/0%) — clinicians are mobile-first. Either harden the PWA (offline, push, install flows) AND/OR scope a thin native shell. Decide explicitly; don't drift.
3. **Accessibility / WCAG 2.2 AA** (Section B+D, 15%) — run axe/Lighthouse-a11y baseline; remediate critical issues; document the audit. Required for enterprise sales.
4. **Rich Clinician Profile** (Section B, 25–55%) — wire training / work / affiliations data with real PSV paths. Use ISSUER-1..6 chain to back at least one claim type end-to-end (residency is the easiest given existing demos).
5. **Upload / Import / Export** (Section B, 25%) — clinician CV import (PDF/DOCX), CSV roster import for employers, JSON-LD/FHIR export of proof packs.
6. **Knowledge Graph Visual UX** (Section B, 25%) — promote the static 9-node panel to an interactive view of the actual ~84-node graph that powers the truth contract. Searchable, filterable, click-to-explain.
7. **Research / PubMed Layer** (Section B, 10%) — PubMed eUtils integration + ORCID + DOI lookups + author-disambiguation UI.
8. **Verifier UX Hardening** (Section C, 47%) — integrated worklist, multi-applicant queue, exportable proof pack, employer team setup.
9. **Backend Persistence Writer** (Section A, 85%) — ship BACKEND-3 (Prisma migration + server-only writer) so audit metadata can flip from `pending_not_written` to `persisted`. Acceptance criteria are documented in `docs/architecture/vitalcv-backend-persistence-defer-decision.md`.
10. **Commercial Launch Readiness** (Section E, 25%) — pricing/paywall, onboarding wizard, admin tooling, public docs, status page.

---

## Historical waves (preserved)

The following entries are kept for context. They reflect the trust-engine work that brought Section A to 87%.

### BACKEND-2 — Server writer confirmation boundary (PR #180)
- `serverPsvReceiptWriter.ts` boundary; deferred-by-default writer. 34 tests.
- No real DB write; defensive downgrade on liar writers.

### BACKEND-1 — Domain receipt contract alignment (PR #178)
- `DomainPsvReceipt` types + mapper + validator.
- Backend repo header documenting legacy-snapshot scope.
- 18 new frozen tests; 41 pre-existing untouched.

### OPS-DEPLOY-1 / OPS-DEPLOY-3 (PRs #173, #179)
- `monorepo.yml` + `ci-preflight.yml` exclusions for DB-dependent backend tests.
- Retired `Deploy Demo App` auto-trigger (Vercel native is canonical).
- First green main-branch CI/CD + Preflight runs in 5+ months.

### ISSUER-9 — Backend persistence decision boundary (PR #177)
- `evaluateBackendPersistenceReadiness`; default `defer_until_contract_aligned`.
- 31 tests; defer memo at `docs/architecture/vitalcv-backend-persistence-defer-decision.md`.

### ISSUER-1..8 — Issuer verification chain (PRs #167–#176)
- Consent → manual link → attested copy/sent → observed view/response → receipt candidate → policy review → PSV receipt promotion → reuse with revocation/supersession → audit persistence → persistence adapter decision.
- 256 tests across 8 issuer suites. 9 demo routes under `/issuer/*`.

### Pre-issuer work (Wave GOD-3S, GOD-3, GOD-2, LIVE-102/101/100*)
- Knowledge Inbox classification (deterministic 13-state).
- 16-section profile with provenance vocabulary.
- Knowledge Trust Graph panel.
- Live wedge usability verified on vitalcv.com.
- Source-of-truth deploy path: `vcv-web` Vercel project.
- 454/454 tests at last GOD-era checkpoint.

---

## Source-of-truth artifacts

- `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` — the truth contract (84 nodes, ~95 edges, ~50 rules, 60 boundaries).
- `docs/architecture/vitalcv-backend-persistence-defer-decision.md` — why backend writer is deferred + acceptance criteria.
- `CLAUDE.md` (repo root) — operating stack and gotchas.
- `apps/web/lib/issuer-verification/*` — issuer chain + audit boundary + adapter + writer boundary.
- `packages/domain-core/psvReceipts.ts`, `packages/domain-core/psvReceiptMapping.ts` — aligned domain types.
