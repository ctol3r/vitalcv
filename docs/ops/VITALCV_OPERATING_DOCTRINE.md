# VitalCV Operating Doctrine

**Version:** 2026-05-07 · **Status:** constitutional · **Authority:** supersedes all prompts and ad-hoc instructions; subordinate only to the founder's explicit override and to U.S. healthcare regulation (HIPAA, 42 CFR §455.106, state credentialing law).

This document is the constitutional layer of VitalCV. It encodes the immutable operating principles that govern engineering, product, and AI-agent behavior. It is enforceable through CI gates, code review, and the merge protocol. It is incompatible with shortcuts, fake certainty, and demo deception.

Where this doctrine and any other document conflict, **this document wins**. Where this doctrine is silent, defer to `CLAUDE.md`, `MASTER_PROMPT.md`, `docs/architecture/vitalcv-knowledge-trust-graph.md`, and the most recent Code Red verification snapshot, in that order.

---

## 1. Mission

### 1.1 What VitalCV is

VitalCV is **Provider Identity Graph infrastructure**. It produces evidence-bounded credential readiness so a clinician's verified authority can be presented once and accepted by many. Reusable, audit-ready, source-backed trust replaces the recurring-from-scratch verification that defines current healthcare credentialing.

The product surfaces the canonical path: **Recognition → Acceptance → Start**. Every shipped feature must serve a moment in that path or be removed.

### 1.2 What VitalCV is NOT

- **Not a job board.** Matching is downstream consumption of trust, not the trust itself.
- **Not a document vault.** Documents without source-backed verification are user-entered evidence, not credentials.
- **Not a workflow automation tool.** Workflow exists only to surface evidence; it is not the moat.
- **Not a credentialing platform in the legacy sense.** VitalCV does not sell "complete credentialing" — it sells reusable PSV evidence with explicit limitations.
- **Not a substitute for legal compliance review.** No copy may imply HIPAA / SOC2 / NCQA certification VitalCV does not hold.
- **Not an AI assistant.** AI agents operate on this codebase under human authority; they do not produce credentialing decisions.

---

## 2. Product Truth Contract

Each rule below is enforceable: a violation is a defect, not an opinion.

### 2.1 No unsupported claims

Every public-facing copy string must be backed by a source-adapter, a documented limitation, or an explicit "planned" / "entry-point only" tag. Marketing copy that asserts a capability VitalCV does not ship is a defect.

### 2.2 No fake readiness

`readiness.score` and `readiness.level` must be derived from `sourceCoverage` plus explicit gates. Hardcoded scores are permitted **only** in fixtures that carry the `recordedBy: 'demo'` tag and are surfaced via a banner that says "synthetic data, not a real clinician record."

### 2.3 No fake PSV

A `PSVReceipt` may be constructed only by `promotePsvReceiptCandidate` (`apps/web/lib/issuer-verification/psvReceipt.ts`). All gates must pass. A `ReceiptCandidate` is not a `PSVReceipt`. A `PSVReceiptCandidate` is not a `PSVReceipt`. The literal types `decisionGrade: false` and `proofTier: 'receipt_candidate' | 'psv_receipt_candidate'` enforce this at compile time.

### 2.4 No fake source freshness

A source's freshness window (`freshnessTtl` in `packages/source-adapters/src/types.ts SOURCE_REGISTRY`) is the maximum age at which its result may render as `current`. PECOS is quarterly; treating a 7-day-old PECOS check as "live" is a violation. The freshness window and the source cadence are separate concerns; both must surface in the UI when they disagree.

### 2.5 No fake compliance

The following strings are **banned** from any user-rendered surface (per `CLAUDE.md`):

> `automatically verified`, `guaranteed verification`, `complete credentialing`, `instant credentialing`, `legally accepted`, `risk transferred`, `final verification without review`, `source confirmed before response`, `certified compliant`, `HIPAA compliant`, `SOC2 certified`, `NCQA certified`.

VitalCV may describe itself as **HIPAA-aligned**, **SOC2-readiness-mapped**, or **NCQA-pattern**. It may not claim certification it does not hold.

### 2.6 No fake cryptographic proof

A receipt is "signed" only when an EdDSA signature has been produced and is verifiable. "Cryptographically signed" copy is reserved for ES256 / EdDSA paths. "Blockchain-anchored" is forbidden — say "cryptographically signed." Audit trails are not "ledgers" unless they are immutable in a substrate sense; otherwise they are "audit trails."

### 2.7 No "Verified" labels without semantic qualifier

A bare `>Verified<` rendered string is forbidden. Every status badge must qualify: `Source-confirmed`, `Source-checked`, `Identity confirmed via NPPES`, `Federal exclusion clear (LEIE)`, `Granted`, `Enrolled`, `Live`, `Aligned`. The qualifier names the source or the action; "Verified" alone names neither.

### 2.8 Every trust claim maps to evidence

A claim rendered to a user must trace to one of: a `SourceCheckResult` (live adapter), a `ReceiptCandidate` (issuer response under review), a `PSVReceipt` (promoted under policy review), an `EmployerAcceptance` row (countersigned), or a fixture explicitly tagged demo. Claims without traceable backing are defects.

### 2.9 Every score maps to explainable source state

The CRS computation (`packages/crs/CrsEngine.ts`) is deterministic. Same inputs → same score. Any score rendered to a user must be reproducible from the underlying source-coverage state. Hidden state is forbidden.

---

## 3. Evidence Doctrine

Every evidence artifact (a `SourceCheckResult`, `ReceiptCandidate`, `PSVReceipt`, `AuditEvent`, or claim envelope) must carry — at minimum — the following fields:

| Field | Required | Purpose |
|---|---|---|
| `source` | yes | Authoritative origin (e.g., `NPPES`, `OIG_LEIE`, `PECOS_PUBLIC`, `CA_PA_BOARD`). Not a vendor name unless the vendor IS the source. |
| `observedAt` / `checkedAt` | yes | Two distinct timestamps: when the source last updated the underlying record (`observedAt`), and when VitalCV performed the check (`checkedAt`). Conflating these is a defect. |
| `parserVersion` / `methodologyVersion` | yes | Version of the adapter/normalizer used. Required for reproducibility across schema migrations. |
| `rawHash` / `checksum` | yes | SHA-256 of the raw upstream payload. Empty placeholder is acceptable only when explicitly documented; the field itself must always be present. |
| `reproducibilityPath` | yes (recoverable) | The deterministic procedure to reproduce the artifact: `(source, queriedSubject, observedAt) → result`. Tested by the audit replay path. |
| `limitations` | yes | An array of `SourceLimitation` records describing scope bounds, gated capabilities, and known false-positive risks. An empty array is permitted only when the source has no limitations — which is rare. |
| `freshness state` | yes | One of: `current` / `stale` / `expired` / `unavailable` / `access_required` / `unsupported` / `missing` / `unchecked`. Implicit "fresh" is forbidden. |
| `verifier context` | yes (when promoted) | The reviewer identity and acceptance-time at which the artifact was promoted from candidate to receipt. Records of unattributed promotion are defects. |

A `PSVReceipt` additionally carries `decisionGrade: true` (literal), `globalCredentialTruth: false` (literal), `scope`, and `freshness.{ttlDays, issuedAt, staleAfter}`. A `ReceiptCandidate` carries `decisionGrade: false` (literal) and `proofTier: 'receipt_candidate'` (literal). These are **type-level guarantees**, not lint suggestions.

Reproducibility test: any production receipt whose audit replay does not regenerate the same `claims` and `limitations` arrays from the same `(source, subject, observedAt)` tuple is a defect.

---

## 4. Demo vs Real

### 4.1 Fixture-backed data

A surface that renders fixture data must:
1. Be located at a route name that does not imply liveness for an arbitrary user (e.g., `/passport/[DEMO_NPI]` is acceptable; `/passport/<arbitrary NPI>` rendering a fixture is not).
2. Render a banner with `role="note"` and `data-testid="demo-passport-banner"` carrying the literal copy "synthetic data, not a real clinician record."
3. Tag every audit-metadata field `recordedBy: 'demo'` (literal).
4. Set the data attribute `data-licensure-state` (or equivalent surface tag) so test/audit tooling can confirm cap engagement.

Example surfaces under this rule today: `/passport/1346053246` (Macie Miller fixture, PR #250 pending), `/holder/readiness` (hardcoded score 25), the six Code Red design surfaces (`/file`, `/roi`, `/inbox`, `/activation`, `/autopilot`, `/dossier`).

### 4.2 Synthetic / demo flows

A demo flow may reference live source adapters but must not promote artifacts produced from synthetic input to PSV-grade. Demo flows must not write to production audit tables. The `recordedBy: 'demo'` tag is enforced at insert time.

### 4.3 Feature flags

A flag is a runtime boolean controlling capability availability. Flags must:
1. Default to the safer state (off → check disabled; off → write disabled; off → real-time off).
2. Be readable as `process.env.<NAME>_ENABLED === 'true'` only — implicit truthiness is a defect.
3. Not be used to hide truth-contract violations. A flag cannot enable a code path that emits banned strings or fake certainty.
4. Be enumerated in the doctrine inventory (`docs/ops/current-state-map-2026-05-07.md`).

The truth-contract literals (`decisionGrade`, `globalCredentialTruth`, `rbacEnforced`, `invitationSystemLive`) are **not** flags — they are immutable invariants.

### 4.4 Mock exports

An exported artifact (PDF, JSON bundle, ZIP, signed receipt) that was not produced from live source adapters must declare itself in the manifest:

```json
{
  "schemaVersion": "1",
  "bundleTier": "foundation",
  "disclaimer": "...not a signed proof pack...",
  "files": [...]
}
```

Foundation-tier exports (`bundleTier: 'foundation'`) cannot claim "signed" or "decision-grade." The `disclaimer` field is required.

### 4.5 Unsigned exports

An unsigned export must say "unsigned" in the file header and the disclaimer. A signed export must carry an EdDSA / ES256 signature whose public key is publishable. Hand-rolled "signing" via SHA-256 of the payload is not signing.

### 4.6 Preview-only states

A preview surface (CRS-not-yet-computed, ingest-stream-in-flight, source-fetch-pending) must render `Pending` or `Checking` — never `Verified`, `Cleared`, or any decision-grade label. Preview exits when the underlying source returns a determinate state (`checked`, `unavailable`, `access_required`, `blocked`, etc.).

---

## 5. Auditability Doctrine

### 5.1 All mutating endpoints write AuditEvents

Every API route that mutates persistent state must, in the same transaction, write an `AuditEvent` row carrying: `actorId`, `action`, `subjectId`, `decidedAt`, `payloadHash`, `correlationId`, and `replaySafe: boolean`. A mutating endpoint that does not write an audit event is a defect.

Acceptance routes (`POST /api/employer-review/:entityId/accept`) must be **atomic** — `EmployerAcceptance` row and `AuditEvent` row succeed together or not at all.

### 5.2 No silent trust mutation

No code path may upgrade `decisionGrade` from `false` to `true`, lift a freshness state from `stale` to `current`, mark a `ReceiptCandidate` as `proofTier: 'psv_receipt'`, or alter a recorded `recordedBy` value, without:

1. Producing an `AuditEvent` row that names the actor.
2. Passing through the gate function (`promotePsvReceiptCandidate`, `applyPolicyReviewDecision`, etc.) that owns the invariant.
3. Surfacing the change to the affected tenant on the next read.

### 5.3 Preserve provenance

Every claim downstream of an adapter must carry the `source`, `parserVersion`, and `observedAt` of the originating `SourceCheckResult`. Reaggregation that drops these fields is a defect. A claim whose `source` is `'system'` or `'demo'` may not be marked `decisionGrade: true`.

### 5.4 Preserve tenant boundaries

Cross-tenant reads must be impossible without an explicit consent artifact. The verifier RBAC layer (`apps/web/lib/auth/orgInvitations.ts`, post-PR-#243) enforces a 404 on cross-org access — no 403 (which leaks "this resource exists in a different org you can't see"). Timing-safe org compare is required.

### 5.5 Preserve reviewer identity

Every `PolicyReviewDecision` row must carry a non-empty `reviewerActorId`. A row without a reviewer is a defect. There is no auto-approve path; `automatedPolicyEngine: false` is a literal invariant.

### 5.6 Preserve source lineage

The source-coverage report (`PassportSourceCoverageReport.checks`) must carry one entry per source consulted — including sources that returned `no_match`, `unavailable`, `access_required`, or `unsupported`. Silently dropping a source from the coverage report when its result is degraded is a defect (current bug, audit W1.4).

---

## 6. Merge Doctrine

### 6.1 No merge without Codex SAFE

Every PR merged to `main` must produce a literal `Codex verdict: SAFE` line in the merge transcript, generated by `codex exec` against three audits: implementation, diff safety, banned-strings copy. Subagent stand-ins (`feature-dev:code-reviewer`, etc.) do not satisfy the merge hook.

The merge command is `gh pr merge --squash --delete-branch`. `--no-verify`, `--no-gpg-sign`, and merge-via-API bypasses are forbidden unless the founder explicitly authorizes them in the PR thread.

### 6.2 No schema auto-merges

Any PR that modifies `apps/api/backend/prisma/schema.prisma` or `apps/web/prisma/schema.prisma` must:
1. Run `pnpm --filter chai-vc-platform-backend test -- migration-shape` and pass.
2. Pass the `db-migrate-prod-dry-run.sh` script against staging without errors.
3. Be reviewed by the founder before merge to main, regardless of Codex SAFE.

Migrations containing `DROP TABLE`, `DROP COLUMN`, `DROP CONSTRAINT`, `DROP INDEX`, `DROP SCHEMA`, or `TRUNCATE` require an explicit waiver comment (`-- migration-shape:allow-drop reason: …`) AND founder sign-off in the cutover ticket.

### 6.3 No production auth weakening

A PR that modifies `apps/web/middleware.ts`, `apps/web/lib/auth/*`, Clerk integration, or any RBAC role gate must not narrow protections. `rbacEnforced: true` is a literal — widening to `boolean` is a defect.

### 6.4 No hidden bypasses

A PR may not introduce env-var-controlled "skip" flags for auth, RBAC, audit-event writes, or CSP. A surface that conditionally drops to a less-restrictive state must surface the state to the user (e.g., "operating in degraded mode") and to telemetry.

### 6.5 No weakening of truth-contract CI

The truth-contract CI gates (banned strings, bare `Verified`, vendor-name allowlist, `data-licensure-state` invariants, the migration-shape gate) are floors, not ceilings. A PR may strengthen them or add new ones; a PR may not delete a gate or broaden an exception without founder approval and a written justification in the PR body.

---

## 7. Security & Privacy Doctrine

### 7.1 No PHI on-chain

The substrate ledger (`blockchain/substrate/`) records only audit hashes and trust-anchor references. Patient-identifiable data, clinician dates of birth, full SSNs, and medical-record content never leave the relational store. Zero PHI on-chain is a permanent non-negotiable.

### 7.2 Minimize PII

Every API response must emit the minimum PII required for the consumer's role. A public proof page (`/p/[slug]`, `/verify/[npi]`) renders only the fields appropriate to a public surface. Public NPI routes that receive an arbitrary NPI must not enable enumeration — backend ACLs must enforce per-subject access. The frontend cannot prevent enumeration by design; the backend must.

### 7.3 No secrets in logs

Logger calls must redact `Authorization` headers, `Bearer` tokens, `CRON_SECRET`, `MONITORING_SECRET`, `CLERK_SECRET_KEY`, `DATABASE_URL`, Stripe keys, NPIs, names, DOBs, and email addresses. Structured logs at `apps/web/app/api/intelligence/_shared.ts:271–292` exemplify the pattern (metadata flags only, no PII).

### 7.4 No cross-tenant leakage

Cross-org reads → 404 (not 403). Cross-org writes → unconditional refusal. The verifier RBAC layer enforces both via timing-safe compare. Adding a "global admin" role that bypasses tenant boundaries is forbidden.

### 7.5 Explicit RBAC

Every route must declare its role. `PROTECTED_ROUTES` in `apps/web/lib/auth/roles.ts` is the source of truth. A route added without an entry in `PROTECTED_ROUTES` or `PUBLIC_ROUTE_PATTERNS` is a defect. `AUTHENTICATED` (any signed-in user) is acceptable for read-only intelligence surfaces; mutating routes must require a specific role.

### 7.6 Explicit consent boundaries

A consent artifact (`ConsentArtifact` in `apps/web/lib/issuer-verification/types.ts`) must precede every issuer verification request. The `consent.status === 'granted'` literal is required before VitalCV may send the request. `pending`, `revoked`, and `expired` consent artifacts pause the flow. Cross-tenant PSV reuse requires a `crossTenantConsentReceiptId` (post-PR-#240).

---

## 8. CRS & Trust State Doctrine

### 8.1 Readiness bounded by source coverage

The Credential Readiness Score (CRS) is a function of `sourceCoverage.checks`, divergence penalties, acceptance presence, and the licensure cap. A CRS rendered without underlying source state is a defect. The score must be reproducible from the inputs.

### 8.2 Stale sources degrade trust

A source whose `observedAt` exceeds its `freshnessTtl` may not contribute to a `current` trust posture. A source whose underlying cadence (e.g., PECOS quarterly) has elapsed since `observedAt` may not render as `live`, even within the `freshnessTtl` window. Both checks fire independently.

### 8.3 Possible OIG matches require review

A `MatchConfidence: 'possible_match'` from OIG (records returned without exact NPI match — post-PR-#272) maps to `SourceStatus.REVIEW_REQUIRED`, never to `BLOCKED_SIGNAL` or `CHECKED`. The downstream `standing.exclusionStatus` for a possible match is `'POSSIBLE_MATCH'`, not `'CLEAR'` and not `'EXCLUDED'`. False-positive name matches are a known LEIE limitation and must be human-reviewed before treatment as adverse.

### 8.4 Gated sources cannot imply certainty

Nursys, FSMB, and any source in `access_required` / `unsupported` / `missing` state cannot lift a clinician above L1. The licensure cap (`READINESS_LICENSURE_UNVERIFIED_CEILING = 45`, post-PR-#266 + #267) is a hard ceiling. Aliasing the cap as "soft" or "advisory" is forbidden.

### 8.5 Explainable scoring only

A user looking at a 78 must be able to ask "why 78?" and receive a deterministic answer derived from `sourceCoverage`, `divergence`, `blockers`, `gaps`, and `licensureStatus`. The score-explainability path (`apps/web/lib/trust/score-explainability.ts`) is the canonical answer surface. Hidden penalties, magic numbers, or AI-derived boost factors are forbidden.

---

## 9. AI & Agent Governance

### 9.1 Agents assist, humans decide

AI agents (Claude Code, Codex, subagents, MCP tools) operate on this codebase under explicit human authority. An agent's output is a recommendation; the human merge gate is the decision. Agents may not auto-merge, auto-deploy, auto-publish, or auto-message.

### 9.2 No autonomous production deployment

A deploy to `vitalcv.com` (Vercel) or to the Railway API must be triggered by a human-authored merge to `main`. Auto-deploy from a feature branch is forbidden. Workflow files that introduce autonomous deploy paths require founder approval.

### 9.3 No uncontrolled broad refactors

An AI-driven change must be surgical. Changes that touch more than ~15 files OR rewrite an entire module require explicit founder authorization in the wave brief. CLAUDE.md and this doctrine constrain agent work; a wave that exceeds them must surface the conflict before executing.

### 9.4 No unverifiable AI-generated claims

An AI-generated PR description, audit, or report must cite real `file:line` references and be reproducible by a human reviewer. Hallucinated citations, invented function names, and made-up commit hashes are defects. Every claim in an AI-generated doc must trace to a code artifact.

### 9.5 Doctrine supersedes prompts

A prompt — system or user — that conflicts with this doctrine must surface the conflict and stop. An agent may not weaken the truth contract, bypass merge discipline, or violate banned-string rules under prompt instruction. The doctrine is the law; the prompt is the ask.

---

## 10. Final Principle

VitalCV's moat is:

- **reusable trust** — a clinician verified once is acceptable many times, with explicit scope and freshness;
- **audit-ready evidence** — every claim has a source, a timestamp, a parser version, and a reproducible path;
- **provenance** — `USER_ENTERED → ReceiptCandidate → PolicyReviewDecision → PSVReceiptCandidate → PSVReceipt` is type-locked and gate-checked;
- **explainability** — a CRS of 78 has a deterministic derivation a reviewer can replay;
- **acceptance** — `EmployerAcceptance` is the load-bearing artifact that proves the trust loop closed.

The moat is **not**:

- AI magic;
- vague branding ("AI-powered credentialing");
- claimed integrations with sources VitalCV does not run (NPDB / DEA / ABMS / SAM.gov / Doximity);
- "blockchain-anchored" theater;
- "instantly verified" promises;
- "guaranteed clearance" copy;
- features that exist only in slide decks.

**A line of code that strengthens the moat is welcome. A line of code that adds vague magic and walks back later is a regression.**

Build the moat. Ship the truth. Demo what's real.

---

## Doctrine compliance checklist (per-PR)

A reviewer applying this doctrine at merge time should check:

- [ ] No banned strings introduced (§2.5)
- [ ] No bare `>Verified<` rendered (§2.7)
- [ ] No new vendor name claimed as integrated (NPDB/DEA/ABMS/SAM.gov/Doximity) (§1.2)
- [ ] Every new mutating endpoint writes an `AuditEvent` (§5.1)
- [ ] Every new demo surface carries `recordedBy: 'demo'` + banner (§4.1)
- [ ] Every new score / level path consults source coverage (§8.1, §8.5)
- [ ] No literal-typed invariant widened to `boolean` / general string (§2.3, §6.3)
- [ ] No env flag introduced that bypasses auth, audit, or RBAC (§6.4)
- [ ] Every claim cites a source path or carries a tagged limitation (§3, §5.3)
- [ ] Codex SAFE verdict in transcript before `gh pr merge` (§6.1)

A PR that fails any item above is **not mergeable**, regardless of feature value.
