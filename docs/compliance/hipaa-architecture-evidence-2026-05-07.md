# HIPAA Architecture Evidence — 2026-05-07

> **What this document is.** A point-in-time snapshot of the technical
> controls VitalCV has implemented that map to HIPAA Security Rule
> requirements. It is **architecture evidence**, not a certification claim.
>
> **What this document is NOT.** This document does not claim a HIPAA
> certification status, does not serve as a Business Associate Agreement
> (BAA), and is not the output of a covered-entity HIPAA assessment.
> Each of those is a vendor-procurement gate that is explicitly out of
> scope per our completion-board guidance.
>
> Use this document as a vendor-questionnaire artifact and as input to a
> HIPAA assessor's gap analysis.

## Scope

This document covers the controls implemented in `apps/web/`,
`apps/api/`, and `packages/` as of `origin/main` HEAD `9eb5cdee` on
2026-05-07. Each control is keyed to a HIPAA Security Rule
specification and traced to the file(s) that implement it.

The Security Rule is structured around three safeguard families:

- **Administrative** — 45 CFR §164.308
- **Physical** — 45 CFR §164.310 (deferred to hosting-provider BAA)
- **Technical** — 45 CFR §164.312

This document focuses on the technical and administrative safeguards
that live in code and configuration. Physical safeguards inherit from
the hosting provider (Vercel for web, Railway for backend) and are
documented separately during procurement.

## Technical safeguards (§164.312)

### §164.312(a)(1) — Access control · Unique user identification

| Implementation | File | Status |
|---|---|---|
| Per-user unique identifiers issued via authentication provider claims | `apps/web/middleware.ts` (Clerk middleware), `apps/web/lib/auth/roles.ts` | live |
| Server-side role resolution + JWT-claim fast path | `apps/web/middleware.ts`, `apps/web/app/api/auth/resolve-role/` | live |
| Org-membership role resolution stub for `/api/verifier/*` | Open PR #243 (`feat/verifier-rbac`); a security finding on that PR (`x-verifier-org` header trusted client-side) must be addressed before merge — see PR #243 comments. Not on main yet. | open PR with security finding |

### §164.312(a)(2)(i) — Access control · Automatic logoff

| Implementation | File | Status |
|---|---|---|
| Authentication provider session lifetime | Clerk default (configurable via dashboard) | inherits provider |
| Magic-link timing-safe path | `apps/web/lib/auth/` (signup-gate from #238) | live |

### §164.312(a)(2)(iv) — Access control · Encryption and decryption

| Implementation | File | Status |
|---|---|---|
| HTTPS-only on all public surfaces (HSTS) | `apps/web/security-headers.mjs` (#226) | live |
| Database connection over TLS (Postgres over `sslmode=require`) | Provisioning doc; enforced at connection-string level | inherits provider |
| ES256 receipt issuer (signs the JWT, generates the keypair, exposes the public JWK) | `apps/web/lib/crypto/receiptIssuer.ts` (#203/#204) | live |
| ES256 receipt-candidate signer (per-candidate signing wrapper) | `apps/web/lib/crypto/receiptCandidateSigner.ts` (#203/#204) | live |
| JWKS endpoint for verifier-side receipt validation | `apps/web/app/api/.well-known/jwks.json/route.ts` | live |

### §164.312(b) — Audit controls

| Implementation | File | Status |
|---|---|---|
| Audit-event logging boundary | `apps/web/lib/issuer-verification/auditPersistence.ts` (#175) | scaffold |
| Audit metadata required on every receipt-candidate write | `ReceiptCandidateAuditMetadata.recordedBy ∈ {'demo','review_surface','system'}` enforced as a literal type AND a DB CHECK constraint | live |
| Persistence writer logs every write outcome | `apps/web/lib/issuer-verification/issuerPersistenceWriter.ts` (#255) | live (feature-flagged) |
| Audit row writer wired into 3 of 4 issuer surfaces | `/issuer/review`, `/issuer/policy-review`, `/issuer/psv-receipt` (#256/#257/#258) | live (feature-flagged) |
| Source-health probe writes structured event log | `scripts/deploy-health-probe.sh` + `apps/web/app/api/internal/source-health/probe/_handler.ts` (#252) | live |

### §164.312(c)(1) — Integrity · PHI not improperly altered or destroyed

| Implementation | File | Status |
|---|---|---|
| Receipt-candidate truth-contract CHECK constraints at the DB level | `apps/api/backend/prisma/migrations/20260504000000_issuer_persistence_scaffold/migration.sql` (#221) | live |
| `decisionGrade = FALSE` enforced as a SQL CHECK | same | live |
| `proofTier IS NULL OR = 'receipt_candidate'` enforced as a SQL CHECK | same | live |
| `recordedBy IN ('demo','review_surface','system')` enforced as a SQL CHECK | same | live |
| SQLSTATE 23514 → `tamper_detected` outcome, classified by `classifyConstraintViolation` | `apps/web/lib/issuer-verification/receiptCandidate.ts` (#235) | live |
| Cross-tenant reuse blocked unless explicit consent receipt | `apps/web/lib/issuer-verification/psvReceiptReuse.ts` (#235) | live |

### §164.312(c)(2) — Mechanism to authenticate PHI

| Implementation | File | Status |
|---|---|---|
| ES256-signed receipts (JWT) | `apps/web/lib/crypto/receiptIssuer.ts`, `apps/web/lib/crypto/receiptCandidateSigner.ts` (#203/#204) | live |
| Verifier-side receipt verification engine (zero-trust JWT) | `apps/verifier-api/src/oidc4vp/routes.ts`, `apps/web/app/api/receipts/verify/route.ts` (#204) | live |

### §164.312(d) — Person or entity authentication

| Implementation | File | Status |
|---|---|---|
| Authentication provider integration | Clerk (web) | live |
| Domain-gate signup allowlist | `apps/web/lib/auth/` (#238) | live |
| RBAC role separation (clinician / verifier / admin) | `apps/web/lib/auth/roles.ts` | live |

### §164.312(e)(1) — Transmission security

| Implementation | File | Status |
|---|---|---|
| HTTPS enforcement via response headers | `apps/web/security-headers.mjs` (#226) | live |
| Strict CSP with allowlist | same | live |
| CORS allowlist for cross-origin API calls | `apps/web/lib/security/corsAllowlist.ts` (#234) | live |
| API key foundation for service-to-service auth | `apps/web/lib/security/apiKeyFoundation.ts` (#234) | scaffold |
| Booking-embed iframe sandbox (no top-navigation) | `apps/web/components/pricing/CalendarBookingEmbed.tsx` (#262) | live |

## Administrative safeguards (§164.308)

### §164.308(a)(1)(ii)(A) — Risk analysis

The completion board (`docs/ops/vitalcv-completion-board.md`) is the
ongoing risk-analysis artifact. It tracks every architectural row
with current % completion, open blockers, and explicit "vendor-gated"
markers for items that depend on procurement (HIPAA assessor, SOC2
audit firm, controlled-substance authority registration, etc.).

### §164.308(a)(1)(ii)(B) — Risk management

| Mechanism | Reference |
|---|---|
| Truth-contract CI gate (banned-strings) | `apps/web/lib/trust/trust-container-view.ts` regex patterns |
| Banned-strings sweep run on every PR | Codex 3-pass audit (implementation / diff / banned strings) |
| axe-core WCAG 2.2 AA gate on hero routes | `.github/workflows/a11y-gate.yml` (#232) |
| Web Quality CI: vitest + typecheck + build | `.github/workflows/ci.yml` |
| Post-deploy source-health probe | `scripts/deploy-health-probe.sh` (#252) |

### §164.308(a)(1)(ii)(D) — Information system activity review

| Mechanism | Reference |
|---|---|
| Source-health public panel on `/status` | `apps/web/app/status/page.tsx` (#261) |
| Compliance-evidence section on `/status` | `apps/web/app/status/page.tsx` (#230) |
| Machine-readable evidence shape (planned) | `GET /api/compliance/evidence` |

### §164.308(a)(3) — Workforce security

The role separation enforced by `apps/web/lib/auth/roles.ts` is the
technical layer. The administrative layer (workforce hiring, training,
sanction policy) is out of scope for code and lives in the operator's
HR documentation.

### §164.308(a)(4) — Information access management

| Implementation | File | Status |
|---|---|---|
| Role-based access at the route level | `apps/web/middleware.ts` | live |
| Per-org membership scope (verifier surfaces) | Open PR #243; same security finding documented on that PR — not on main yet. | open PR with security finding |

### §164.308(a)(5)(ii)(B) — Protection from malicious software

| Mechanism | Reference |
|---|---|
| Strict response-header baseline (CSP, X-Content-Type-Options) | `apps/web/security-headers.mjs` (#226) |
| Sandboxed iframes for any third-party embed | `CalendarBookingEmbed.tsx` (#262) |
| Banned-strings + truth-contract CI gates | enumerated above |

### §164.308(a)(6) — Security incident procedures

The `/status` page shows source-health state per source. Incident
response runbooks live in `docs/ops/` and are operator-owned.

### §164.308(a)(8) — Evaluation

This document is the architecture-side input to that evaluation. The
operator's HIPAA assessor closes the loop with:
- BAA with hosting providers (Vercel, Railway, Postgres provider)
- Workforce sanction policy
- Incident-response runbook walk-through
- Penetration test against deployed staging

## Physical safeguards (§164.310)

VitalCV is a SaaS application; physical safeguards are inherited from
the hosting providers. Each provider must have a BAA in place with
the operator before any production PHI flows through the system.

| Provider | Service | BAA status |
|---|---|---|
| Vercel | Web hosting (apps/web, apps/marketing) | residual manual #6 — operator must sign BAA with Vercel prior to production PHI |
| Railway | Backend hosting (apps/api/backend) | residual manual #6 — operator must sign BAA with Railway prior to production PHI |
| Postgres provider (Supabase or Neon) | Persistence | residual manual #2 + #6 |
| Authentication provider (Clerk) | Identity | residual manual #6 |
| Slack | Pilot intake destination (when configured) | residual manual #8 — only triggered when `SLACK_PILOT_INTAKE_WEBHOOK_URL` set |
| Calendar booking (Cal.com / Calendly) | Optional booking | residual manual #9 — operator must verify BAA viability if used for PHI; demo only otherwise |

## Out of scope for this document

The following are **explicitly out of scope** for this evidence
document:

1. Any HIPAA certification claim. The architecture never makes
   such a claim; HIPAA certification is a procurement activity.
2. A Business Associate Agreement. The operator must execute a BAA
   with each hosting provider listed above before production PHI
   flows.
3. The output of a HIPAA assessor's audit. This document is the
   architecture's input to that audit, not its substitute.
4. Vendor-gated controls (gov-ID + selfie liveness, native iOS/Android
   app stores, HRIS integrations, LinkedIn/Doximity import adapters).
   These are tracked separately on the completion board with explicit
   `vendor-gated` markers.

## Reproducibility

This document was generated from `origin/main` HEAD `9eb5cdee` on
2026-05-07. To re-verify the evidence map against any later main HEAD,
run the three steps below from a fresh worktree of `origin/main`.

```bash
# 1. Verify every cited file ACTUALLY EXISTS on disk. The list is
#    derived directly from the rows above; a missing file is a
#    traceability failure for that row and must be fixed before the
#    document can be used as audit evidence.
PATHS=(
  apps/web/middleware.ts
  apps/web/lib/auth/roles.ts
  apps/web/app/api/auth/resolve-role/
  apps/web/security-headers.mjs
  apps/web/lib/crypto/receiptIssuer.ts
  apps/web/lib/crypto/receiptCandidateSigner.ts
  apps/web/app/api/.well-known/jwks.json/route.ts
  apps/web/lib/issuer-verification/auditPersistence.ts
  apps/web/lib/issuer-verification/issuerPersistenceWriter.ts
  apps/web/lib/issuer-verification/receiptCandidate.ts
  apps/web/lib/issuer-verification/psvReceiptReuse.ts
  apps/web/lib/issuer-verification/types.ts
  apps/api/backend/prisma/migrations/20260504000000_issuer_persistence_scaffold/migration.sql
  apps/verifier-api/src/oidc4vp/routes.ts
  apps/web/app/api/receipts/verify/route.ts
  apps/web/lib/security/corsAllowlist.ts
  apps/web/lib/security/apiKeyFoundation.ts
  apps/web/lib/security/dataClassificationFoundation.ts
  apps/web/lib/security/retentionFoundation.ts
  apps/web/components/pricing/CalendarBookingEmbed.tsx
  apps/web/app/legal/dpa/
  apps/web/app/legal/cookies/
  apps/web/app/status/page.tsx
  apps/web/app/api/internal/source-health/probe/
  apps/web/lib/trust/trust-container-view.ts
  .github/workflows/a11y-gate.yml
  .github/workflows/deploy-health-probe.yml
  scripts/deploy-health-probe.sh
)
missing=0
for p in "${PATHS[@]}"; do
  if [ ! -e "$p" ]; then echo "MISSING: $p"; missing=$((missing+1)); fi
done
[ "$missing" -eq 0 ] && echo "OK: all $((${#PATHS[@]})) cited paths exist" || \
  { echo "FAIL: $missing cited path(s) missing — fix the doc"; exit 1; }

# 2. Verify the cited PRs are merged
for pr in 175 203 204 221 226 228 232 234 235 252 255 256 257 258 261 262 230 238 242; do
  state=$(gh pr view $pr --repo ctol3r/vitalcv --json state,mergedAt \
            --jq '"\(.state) \(.mergedAt // "")"')
  echo "PR #$pr: $state"
done

# 3. Confirm the truth-contract CHECK constraints are in main
grep -A 1 "decisionGrade.*FALSE\|proofTier.*receipt_candidate\|recordedBy.*IN" \
  apps/api/backend/prisma/migrations/20260504000000_issuer_persistence_scaffold/migration.sql

# 4. Confirm banned-strings CI gate exists. The full phrase list lives
#    in apps/web/lib/trust/trust-container-view.ts as VERIFIER_OVERCLAIM_PATTERNS;
#    the gate fires whenever a verifier-side payload contains any of them.
test -f apps/web/lib/trust/trust-container-view.ts && \
  grep -c VERIFIER_OVERCLAIM_PATTERNS apps/web/lib/trust/trust-container-view.ts
```

If step 1 reports `FAIL`, the evidence map is out of date and must be
fixed — every cited path is load-bearing for an audit reviewer.

## Revision history

| Date | Revision | Notes |
|---|---|---|
| 2026-05-07 | 1.0 | Initial architecture evidence document. |
