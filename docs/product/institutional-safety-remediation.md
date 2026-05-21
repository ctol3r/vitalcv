# Institutional Safety Remediation

Snapshot audit + binding rule for what visible institutional
surfaces are NOT allowed to claim. The wave executes a targeted
sweep of seven banned-phrase positive uses found on origin/main and
ships a verifier that prevents regressions.

Cut date: 2026-05-21.

## The rule

A visible institutional surface (anything under `apps/web/app/**`
that is not under `_archive/` and that renders to a clinician,
operator, or institutional reader) MUST NOT use any of the
following positive-form claims:

### Banned cryptographic-guarantee claims

- `Cryptographically Verified` (positive label on UI badges)
- `tamper-proof`
- `immutable` (as a standalone label or value)
- `trustless`
- `independently verified` (as a positive label)
- `cryptographic integrity verified`
- `guaranteed verification`
- `guaranteed cryptographic` (any form)

These are unsupported guarantees. A signature check confirms the
signer held the private key matching a published key at the moment
of signing; it does NOT prove tamper-resistance, immutability, or
independent verification.

### Banned AI / autonomous theater

- `AI-powered`, `AI-driven` (as positive positioning)
- `autonomous credentialing`, `autonomous verification`,
  `autonomous agent` (in a positive-claim form)
- `fully automated`, `fully autonomous`
- `self-driving credentialing`
- `intelligent orchestration`, `intelligent automation`

These are unsupported intelligence claims. Where a surface
genuinely orchestrates operator actions, the language MUST be
operator-grounded ("Operator triggers", "Recommended actions") not
agent-grounded.

### Banned real-time / live-state theater

- `real-time verification` (when the verification is per-request, not streaming)
- `live cryptographic state` (when the surface renders a snapshot)
- `streaming verification` (when no stream exists)
- `magical continuity`
- `auto-refresh` (positive claim of live state when the surface is fetch-on-demand)

These misrepresent the operational shape. Per-request resolution
is the truthful form; "real-time" is not.

## Acceptable replacements (binding)

| Replace | With |
|---|---|
| `Cryptographically Verified` | `Signature confirmed against published key` |
| `Immutable audit trail` | `Hash-chained, append-only audit trail` |
| `Immutable Entity Record` | `Hash-chained, append-only entity record` |
| `Tamper-proof` | `Signature-bound` |
| `Trustless` | (removed; institutional surfaces have explicit trust owners) |
| `Independently verified` | `Source-confirmed by NPPES / OIG / PECOS` |
| `Real-time synchronization` | `Per-request resolution against primary-source registries` |
| `Autonomous Triggers` | `Operator Triggers` |
| `AI-powered onboarding` | (removed; no AI claim required) |
| `Fully automated` | `Bounded; operator-completed` |

## Audit · what was repaired in this wave

Seven positive-claim hits were found on origin/main and repaired:

| File | Before | After |
|---|---|---|
| `apps/web/components/ui/receipt-viewer.tsx:211` | `Cryptographically Verified` | `Signature confirmed against published key` |
| `apps/web/components/employer/ReceiptVerificationBadge.tsx:45` | `✓ Cryptographically Verified` | `✓ Signature confirmed against published key` |
| `apps/web/components/employer/ReceiptVerificationBadge.tsx:50` | `✗ Tampered / Signature Failed` | `✗ Signature did not match published key` |
| `apps/web/components/decision/AuditBundlePreview.tsx:33` | `Cryptographically Verified` | `Signature confirmed` |
| `apps/web/components/clinician/ReadinessDashboard.tsx:56` | `'Audit Log', value: 'Immutable'` | `'Audit Log', value: 'Hash-chained, append-only'` |
| `apps/web/components/sandbox/EmployerWorkspaceBootstrap.tsx:142` | `Immutable Entity Record will be generated` | `Hash-chained, append-only entity record will be generated` |
| `apps/web/components/sandbox/ClinicianPassport.tsx:157-158` | `Real-time synchronization … Immutable audit trail` | `Per-request resolution against primary-source registries … Hash-chained, append-only audit trail` |
| `apps/web/components/graph/GraphInspector.tsx:399` | `Autonomous Triggers` | `Operator Triggers` |

## Surfaces deliberately NOT modified

| Surface | Reason |
|---|---|
| `/autopilot` route | Already self-discloses as "Demo autopilot — illustrative only, not a real clinician's state" |
| `_archive/*` trees | Retired code; the contract does not apply |
| API route source code that uses substrate vocabulary | API routes serve substrate clients; substrate vocabulary is appropriate there |
| Test fixtures (`apps/web/__tests__/`) | Tests may reference banned phrases for negative assertion |
| `docs/` markdown files | Documentation may enumerate banned phrases in rejection tables |

## Verifier behavior

`scripts/verify-institutional-safety.ts` is a scanner that:

1. Walks `apps/web/app/**` and `apps/web/components/**`
2. Excludes `_archive/`, `node_modules`, `.next`, and `*.test.*` files
3. Greps each file for the banned positive-form claims listed above
4. Emits `WARN` for borderline matches (substrate-jargon contexts that may be legitimate)
5. Emits `FAIL` for clear positive-claim hits (e.g. `Cryptographically Verified` as a JSX label)
6. Exits non-zero on FAIL

Three sub-modes:

- `enforce` (default) — full scan, exit on FAIL
- `report` — scan + summary, never exits non-zero
- `cryptographic-only` — just the cryptographic-guarantee subset

## Psychologically unsafe flow checklist

A visible flow surface is psychologically unsafe if it does NOT
clearly:

1. Disclose ownership (who owns the next step)
2. Disclose simulation boundaries (where the surface is bounded)
3. Explain interruptions (where the operator note travels)
4. Explain next steps (the next route or action)
5. Avoid magical-continuity assumptions (no "automatic" claims)

Repaired surfaces in this wave touch only the language; the
structural checklist (ownership + simulation + interruption + next
step + no-magic) is enforced per-surface in Wave 24's
institutional-path-completion contract. This wave does NOT
duplicate that enforcement; it eliminates the specific banned
phrases on origin/main.

## Governance

A new visible surface MUST:

1. Avoid every banned phrase in the three categories above
2. Use the binding replacement form from the Acceptable
   Replacements table when describing signature checks, audit
   trails, source resolution, or operator triggers
3. Pass `pnpm verify:institutional-safety` (default = enforce)
   with zero FAILs

PRs that violate any of the three are rejected at Codex audit.
