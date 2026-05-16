# OpenClaw Risk Classification
**Authority:** openclaw-governance-hardening.md  
**Updated:** 2026-05-07  
**Use:** Determine risk level of any proposed task before generating a task package

---

## Classification Levels

| Level | Color | Meaning |
|---|---|---|
| **SAFE** | 🟢 | Proceed immediately — bounded blast radius, no truth-contract risk |
| **GUARDED** | 🟡 | Proceed after scope lock — confirm exact files, confirm no adjacent sensitive files |
| **HIGH_RISK** | 🟠 | Require architectural justification — Claude Desktop review recommended |
| **FOUNDER_REQUIRED** | 🔴 | Stop — await explicit founder approval before generating any task |
| **HARD_BLOCK** | ⛔ | Stop immediately — task contains a truth violation or governance breach |

---

## Deterministic Classification Table

Classify by the highest-risk file or operation in the task. A task touching any file in a higher classification inherits that classification.

### ⛔ HARD_BLOCK

| File / Operation | Reason |
|---|---|
| Any file + banned string in task | Truth violation — stop before generating |
| Any file + NPDB/DEA/ABMS/SAM.gov/Doximity claim | Unsupported vendor claim |
| Removing `recordedBy:'demo'` without real data path | Blurring demo vs real |
| `decisionGrade` widened from `false` | Frozen literal |
| `proofTier` changed from `'receipt_candidate'` | Frozen literal |
| Removing `AuditEvent` write | Silent auditability gap |
| Removing any CI gate from `.github/workflows/` | CI integrity violation |
| Removing auth guard from `middleware.ts` | Auth weakening |
| Removing cross-tenant reuse block | Tenant boundary breach |

---

### 🔴 FOUNDER_REQUIRED

| File / Operation | Reason |
|---|---|
| `apps/web/prisma/schema.prisma` | Schema change = migration risk |
| `apps/api/backend/prisma/schema.prisma` | Same |
| `docs/migrations/*.sql` | Migration SQL = production risk |
| `prisma migrate` command | Direct DB mutation |
| `CLAUDE.md` | Truth doctrine |
| `MASTER_PROMPT.md` | Operating doctrine |
| Coverage state rename/meaning change | Frozen semantics |
| Policy review gate count change | Frozen 5-gate flow |
| Service / package deletion | Irreversible architectural change |
| Merge policy change | CI discipline |
| Tenant boundary logic removal | Cross-tenant trust leak |
| PSV receipt promotion gate removal | Trust chain break |

---

### 🟠 HIGH_RISK

| File / Operation | Reason |
|---|---|
| `packages/crs/CrsEngine.ts` | CRS scoring — wrong cap breaks trust floor |
| `packages/crs/index.ts` | CRS exports |
| `packages/trust-state/TrustStateResolver.ts` | 9 coverage states — wrong mapping = fake certainty |
| `packages/trust-state/sourceCoverage.ts` | Coverage state definitions |
| `packages/source-adapters/src/adapters/oig.ts` | OIG confidence semantics |
| `packages/source-adapters/src/adapters/nppes.ts` | NPPES identity confidence |
| `packages/source-adapters/src/types.ts` | Adapter type contracts |
| `apps/web/middleware.ts` | Route auth — any change |
| `apps/web/lib/auth/roles.ts` | RBAC role definitions |
| `apps/web/lib/auth/orgInvitations.ts` | Invitation + RBAC enforcement |
| `apps/web/lib/issuer-verification/receiptCandidate.ts` | Receipt candidate — frozen literals |
| `apps/web/lib/issuer-verification/policyReview.ts` | 5-gate policy review |
| `apps/web/lib/issuer-verification/psvReceiptReuse.ts` | Cross-tenant reuse boundary |
| `apps/web/lib/issuer-verification/psvReceiptPromotion.ts` | Receipt promotion gate |
| `apps/web/app/api/employer-review/*/route.ts` | Acceptance + audit event write |
| `apps/web/app/api/verifier/*/route.ts` | RBAC-gated verifier routes |
| `apps/web/next.config.mjs` | CSP, HSTS, security headers |
| `apps/web/lib/audit/auditPersistence.ts` | Audit event boundary |
| `packages/psv/psvStore.ts` | PSV receipt store |
| `packages/psv/validateReceipt.ts` | Receipt validation |
| `packages/domain-common/psvPolicy.ts` | PSV policy — frozen |
| `apps/web/lib/env.ts` | Env validation — adding or removing vars |
| Any signing / export / dossier path | Cryptographic claims |
| Source freshness window changes | Staleness semantics |

---

### 🟡 GUARDED

| File / Operation | Reason |
|---|---|
| `apps/web/app/passport/[id]/PassportEntityClient.tsx` | High-visibility trust surface |
| `apps/web/app/review/[entityId]/ReviewPageClient.tsx` | Employer decision surface |
| `apps/web/app/clinician/*/page.tsx` | Clinician product surfaces |
| `apps/web/app/employer/*/page.tsx` | Employer product surfaces |
| `apps/web/app/issuer/*/page.tsx` | Issuer surfaces (demo-only) |
| `apps/web/app/api/**` | Any API route handler |
| `apps/web/lib/demo/` | Demo fixtures — must not leak to production |
| Feature flag flip (`isLive: false → true`) | Behavior change under flag |
| File deletions | Irreversibility risk |
| `apps/web/lib/env.ts` env additions | Env hygiene |
| Tasks with > 8 files | Scope explosion risk |
| Tasks spanning > 1 domain | Coupling risk |
| `.github/workflows/` additions | CI scope |
| `scripts/` production scripts | Runtime risk |

---

### 🟢 SAFE

| File / Operation | Condition |
|---|---|
| `docs/**` | Docs only — no product logic |
| `docs/ops/**` | Ops docs — confirm no code references that invite unsafe edits |
| `docs/architecture/**` | Architecture docs |
| `apps/web/__tests__/**` | Tests only — no production logic changes |
| New UI component, no data fetching, no auth, no scoring | Isolated visual component |
| CSS tokens / design system tokens only | No logic changes |
| Single-file type-only fix (no logic change) | Bounded, type-safe |
| `.github/workflows/` additions (new gate, no removal) | Additive CI |
| `scripts/` read-only diagnostic scripts | No mutations |
| `MEMORY.md`, `memory/*.md` | OpenClaw memory — no product impact |
| `docs/ops/release-checklist.md` | Release process docs |

---

## Classification Precedence

When a task touches files from multiple levels, the task inherits the **highest** level:

```
SAFE + GUARDED = GUARDED
SAFE + HIGH_RISK = HIGH_RISK
GUARDED + HIGH_RISK = HIGH_RISK
HIGH_RISK + FOUNDER_REQUIRED = FOUNDER_REQUIRED
Any + HARD_BLOCK = HARD_BLOCK (stop immediately)
```

---

## Classification Audit Trail

For every HIGH_RISK and above, record before task generation:

```
RISK CLASSIFICATION RECORD
Task: [description]
Classification: [level]
Highest-risk file: [file path]
Reason: [one sentence]
Justification: [one paragraph for HIGH_RISK; founder approval confirmation for FOUNDER_REQUIRED]
Generated by: OpenClaw [session date]
```
