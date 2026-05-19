# SOC 2 Readiness Map — 2026-05-07

> **What this document is.** A control-by-control mapping of VitalCV's
> current technical architecture to the SOC 2 Trust Services Criteria,
> for use as input to a Type 1 readiness assessment.
>
> **What this document is NOT.** This document does not claim VitalCV
> has a SOC 2 report. It does not replace the audit firm's procedures,
> the operator's internal-control descriptions, or the management
> assertion. Both Type 1 and Type 2 reports require an audit-firm
> engagement that is explicitly out of scope (residual manual #7 per
> the completion board).

## Scope

This document maps controls implemented in `apps/web/`, `apps/api/`,
and `packages/` as of `origin/main` HEAD `9eb5cdee` (2026-05-07) to
the five SOC 2 Trust Services Criteria categories:

- **CC** — Common Criteria (security, applicable to every report)
- **A** — Availability
- **C** — Confidentiality
- **PI** — Processing Integrity
- **P** — Privacy

The default assumption is that a first SOC 2 engagement covers
**Security only** (Common Criteria + sometimes Availability and
Confidentiality). Privacy and Processing Integrity are typically
deferred to a later report.

## Common Criteria (CC)

### CC1 — Control environment

| Sub-criterion | Implementation | Reference |
|---|---|---|
| CC1.1 — Demonstrates commitment to integrity and ethical values | Truth-contract banned-strings CI gate | `apps/web/lib/trust/trust-container-view.ts` |
| CC1.2 — Exercises oversight responsibility | Codex 3-pass audit on every PR | Operating model documented in `CLAUDE.md` |
| CC1.4 — Demonstrates commitment to competence | Required-evidence rule (every >90% row needs code/tests/route/copy/a11y) | `docs/ops/vitalcv-completion-board.md` |
| CC1.5 — Holds individuals accountable | Per-PR Codex SAFE/NOT-SAFE verdict; documented decisions | session memory in `~/.claude/projects/-Users-christoler-vitalcv/memory/` |

### CC2 — Communication and information

| Sub-criterion | Implementation | Reference |
|---|---|---|
| CC2.1 — Obtains relevant information | `/status` source-health public panel | `apps/web/app/status/page.tsx` (#261, #230) |
| CC2.2 — Internally communicates | Completion board updated on every wave delta | `docs/ops/vitalcv-completion-board.md` |
| CC2.3 — Externally communicates | Public-facing `/status`, `/legal/dpa`, `/legal/cookies` | `apps/web/app/legal/` (#242), `apps/web/app/status/page.tsx` |

### CC3 — Risk assessment

| Sub-criterion | Implementation | Reference |
|---|---|---|
| CC3.1 — Specifies suitable objectives | Truth contract codified as TS literal types + DB CHECK constraints | `apps/web/lib/issuer-verification/types.ts`, `migration.sql` |
| CC3.2 — Identifies risks | Completion board tracks each row's blockers | `docs/ops/vitalcv-completion-board.md` |
| CC3.3 — Considers fraud | Cross-tenant reuse blocked unless explicit consent receipt | `apps/web/lib/issuer-verification/psvReceiptReuse.ts` (#235) |
| CC3.4 — Identifies and assesses changes | Banned-strings CI gate + truth-contract literal-type tests on every PR | `apps/web/__tests__/` |

### CC4 — Monitoring activities

| Sub-criterion | Implementation | Reference |
|---|---|---|
| CC4.1 — Selects, develops, and performs ongoing evaluations | Source-health probe runs post-deploy | `scripts/deploy-health-probe.sh` (#252) |
| CC4.2 — Evaluates and communicates deficiencies | `/status` panel shows source-health state per source | `apps/web/app/status/page.tsx` |

### CC5 — Control activities

| Sub-criterion | Implementation | Reference |
|---|---|---|
| CC5.1 — Selects and develops control activities | Required-evidence rule on every >90% completion-board row | `docs/ops/vitalcv-completion-board.md` |
| CC5.2 — Selects and develops technology controls | Strict response-header baseline | `apps/web/security-headers.mjs` (#226) |
| CC5.3 — Deploys through policies and procedures | CI workflows enforce gates on every PR | `.github/workflows/` |

### CC6 — Logical and physical access

| Sub-criterion | Implementation | Reference |
|---|---|---|
| CC6.1 — Implements logical access controls | Authentication provider + RBAC middleware | `apps/web/middleware.ts`, `apps/web/lib/auth/roles.ts` |
| CC6.2 — Restricts logical access for authorized users | Per-org membership role resolution (scaffold pending) | Open PR #243 (`feat/verifier-rbac`) with documented security finding — not on main yet. |
| CC6.3 — Manages user access provisioning | Authentication provider lifecycle (Clerk dashboard) | inherits provider |
| CC6.6 — Implements logical access security measures | API key foundation + CORS allowlist | `apps/web/lib/security/apiKeyFoundation.ts`, `apps/web/lib/security/corsAllowlist.ts` (#234) |
| CC6.7 — Restricts the transmission of information | HTTPS enforced via HSTS; CSP allowlist | `apps/web/security-headers.mjs` (#226) |
| CC6.8 — Implements controls to prevent or detect unauthorized software | Strict CSP + sandboxed iframes for third-party embeds | same |

### CC7 — System operations

| Sub-criterion | Implementation | Reference |
|---|---|---|
| CC7.1 — Detects and prevents introduction of unauthorized software | CSP allowlist; iframe sandbox; no inline scripts | `apps/web/security-headers.mjs` |
| CC7.2 — Monitors system components | Source-health probe + axe-core hero-route gate | `scripts/deploy-health-probe.sh` (#252), `.github/workflows/a11y-gate.yml` (#232) |
| CC7.3 — Evaluates security events | Audit-event boundary + structured logging on every receipt-candidate write | `apps/web/lib/issuer-verification/issuerPersistenceWriter.ts` (#255) |
| CC7.4 — Responds to identified security events | `tamper_detected` outcome on SQLSTATE 23514; degrades to demo render | `apps/web/lib/issuer-verification/receiptCandidate.ts` (#235) |

### CC8 — Change management

| Sub-criterion | Implementation | Reference |
|---|---|---|
| CC8.1 — Authorizes, designs, develops, configures, documents, tests, approves, implements changes | Codex 3-pass audit + Web Quality CI + Vercel preview deploy on every PR | per-PR via `gh pr checks` |

### CC9 — Risk mitigation

| Sub-criterion | Implementation | Reference |
|---|---|---|
| CC9.1 — Identifies, selects, and develops risk mitigation activities | Vendor-gated rows tracked separately on completion board | `docs/ops/vitalcv-completion-board.md` |
| CC9.2 — Manages vendors and business partners | DPA template + cookie policy + vendor-gated procurement list | `apps/web/app/legal/` (#242), `docs/compliance/hipaa-architecture-evidence-2026-05-07.md` |

## Availability (A) — applicable when included in scope

| Sub-criterion | Implementation | Reference |
|---|---|---|
| A1.1 — Maintains, monitors, evaluates current processing capacity | Source-health probe across upstream sources | `scripts/deploy-health-probe.sh` (#252) |
| A1.2 — Implements environmental protections | inherits hosting provider (Vercel + Railway + Postgres provider) | provider documentation |
| A1.3 — Tests recovery plan procedures | scaffold — `docs/ops/database-migration-baseline.md` (deferred PR #237 covers the recovery flow) |

## Confidentiality (C) — applicable when included in scope

| Sub-criterion | Implementation | Reference |
|---|---|---|
| C1.1 — Identifies and maintains confidential information | Data-classification foundation surfaces redaction-rule count | `apps/web/lib/security/dataClassificationFoundation.ts` |
| C1.2 — Disposes of confidential information | Retention foundation surfaces per-entity retention policies | `apps/web/lib/security/retentionFoundation.ts` |

## Processing Integrity (PI) — typically deferred to second report

| Sub-criterion | Implementation | Reference |
|---|---|---|
| PI1.1 — Obtains processing requirements | Truth contract literal types — `decisionGrade: false`, `proofTier: 'receipt_candidate'` | `apps/web/lib/issuer-verification/types.ts` |
| PI1.4 — Implements policies and procedures over completeness, accuracy, timeliness, authorization | DB CHECK constraints enforce contract invariants | `apps/api/backend/prisma/migrations/20260504000000_issuer_persistence_scaffold/migration.sql` (#221) |
| PI1.5 — Implements policies and procedures over storage of inputs and outputs | Audit metadata required on every receipt-candidate write | `ReceiptCandidateAuditMetadata` enforced as a literal type |

## Privacy (P) — typically deferred to second report

| Sub-criterion | Implementation | Reference |
|---|---|---|
| P1.1 — Provides notice | DPA + cookie policy at `/legal/dpa` and `/legal/cookies` | `apps/web/app/legal/` (#242) |
| P3.1 — Personal information is collected consistent with the entity's objectives | Pilot-intake form scope-limited to name/email/org/persona/description | `apps/web/lib/pilot-intake/validate.ts` (#259) |
| P5.1 — Provides individuals access to personal information | scaffold — clinician profile surfaces in `apps/web/app/clinician/` |
| P6.1 — Implements policies and procedures for retention | Retention foundation exposes per-entity policies | `apps/web/lib/security/retentionFoundation.ts` |

## Type 1 vs Type 2 readiness

| Report type | What's needed beyond this document |
|---|---|
| **Type 1** (point-in-time) | Audit-firm engagement; management assertion; control descriptions; population sampling for the controls listed above |
| **Type 2** (operating effectiveness over a period, typically 6–12 months) | All of Type 1 + a sustained operating period of the controls + recurring monitoring evidence |

The architecture is at **Type 1 readiness** for the Common Criteria
category. Availability, Confidentiality, Processing Integrity, and
Privacy are all Type 1-ready for the cited sub-criteria but partial
for the others (each row marked `scaffold` indicates a control that
exists at the foundation level but does not yet have sustained
operating evidence).

## Out of scope for this document

1. A SOC 2 report. The operator must engage an audit firm (residual
   manual #7) and produce a management assertion before any SOC 2
   report exists.
2. The audit firm's testing procedures. This document is the input
   to those procedures, not their substitute.
3. The operator's internal-control description. SOC 2 reports
   require the service organization to describe its system; this
   document covers only the technical controls in code.
4. Penetration test results, vulnerability scans, or third-party
   audits. Those are required artifacts that complement this
   document.

## Reproducibility

```bash
# 1. Verify each cited PR is merged
for pr in 226 228 232 234 235 242 252 255 256 257 258 259 261 262 230; do
  gh pr view $pr --repo ctol3r/vitalcv --json state,mergedAt --jq '"PR #\(.number // "?") \(.state) \(.mergedAt // "")"'
done

# 2. Confirm truth-contract literal types in source
grep -n "decisionGrade: false\|proofTier?:.*'receipt_candidate'" \
  apps/web/lib/issuer-verification/types.ts

# 3. Confirm banned-strings + a11y CI gates run on every PR
ls .github/workflows/
```

## Revision history

| Date | Revision | Notes |
|---|---|---|
| 2026-05-07 | 1.0 | Initial readiness map. |
