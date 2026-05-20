# VitalCV · Operational Capability Boundaries

Canonical reference for what the VitalCV platform actually does, what
it asks an operator to do, what it expects the customer institution to
do, and what it explicitly does not do.

This document is binding. All user-facing operational copy MUST map
each claim to a row in one of the five capability tables below. New
operational copy is rejected if it cannot be grounded in this doc.

Sources:
- `apps/web/lib/trust/operational-status.ts` — typed status taxonomy
- `apps/web/lib/trust/assertOperationalClaimEvidence.ts` — evidence-bound claim helper
- CLAUDE.md truth contract — project-wide banned phrases

## Status taxonomy (binding)

| Status | Meaning |
|---|---|
| `implemented` | Wired end-to-end in shipping code |
| `operator_assisted` | Requires a VitalCV operator step; not autonomous |
| `institution_owned` | Owned by the customer institution; VitalCV hands off |
| `pilot_target` | Target of the current pilot engagement; not yet end-to-end |
| `planned` | On the documented roadmap; not yet a pilot target |
| `unsupported` | Explicitly not in scope |

## 1 · Implemented capabilities (evidence-bound)

| Capability | Evidence |
|---|---|
| Public NPI resolution against NPPES | `apps/web/app/api/resolve-npi/route.ts` (PR #388) |
| IP rate-limit on unauthenticated routes | `apps/web/lib/rate-limit/ipBucket.ts` (PR #388) |
| OpenEvidence ROI calculator (taxonomy → daily-bleed midpoint) | `packages/core/src/services/roiCalculator.ts` (PR #388) |
| OpenEvidence attrition risk engine (taxonomy + rural/urban) | `packages/core/src/services/riskEngine.ts` (PR #389) |
| Bi-directional audit lineage graph API | `apps/web/app/api/audit/[eventId]/graph/route.ts` (PR #389) |
| SHA-256 hash chain primitives | `packages/core/src/services/ledger/HashChainService.ts` (PR #390) |
| Antigravity verifier routing middleware | `apps/web/lib/auth/antigravity.ts` + `apps/web/middleware.ts` (PR #390) |
| did:web discovery document | `apps/web/app/api/.well-known/did.json/route.ts` |
| JWKS public key endpoint | `apps/web/app/api/.well-known/jwks.json/route.ts` |
| OID4VCI issuer metadata | `apps/web/app/api/.well-known/openid-credential-issuer/route.ts` |
| Per-request issuer host resolution (tunnel-safe) | `apps/web/lib/discovery/issuerHost.ts` (PR #384) |
| Stacked Provenance Ledger (Matuschak panes) | `apps/web/components/trust/StackedPaneLayout.tsx` (PR #385) |
| Canonical trust primitives (LineageHeader, ReplayTimeline, etc.) | `apps/web/components/trust/primitives/` (PR #382) |
| Canonical operational language (status + phrase constants) | `apps/web/lib/trust/institutional-language.ts` (PR #382) |
| Five-mode failure taxonomy + degradation states | `apps/web/lib/trust/degradation.ts` (PR #382) |

## 2 · Operator-assisted capabilities

| Capability | Operator role | Evidence |
|---|---|---|
| Audit-event chain insert | VitalCV ops triggers the wrapped insert per lineage | `packages/core/src/services/ledger/createAuditEventWithChain.ts` (PR #390) |
| Pilot intake review | Operator manually reviews submitted NPIs before activation | Pilot Deployment Kit Section 02 (PR #387) |
| Tunnel host pinning for demos | Operator sets `VCV_ISSUER_HOST` env on the demo cluster | `apps/web/lib/discovery/issuerHost.ts` |

## 3 · Institution-owned workflows

| Workflow | Institution role | Notes |
|---|---|---|
| State medical board PSV | Customer CVO or partner CVO | Out of pilot scope; named in Pilot Deployment Kit Section 02 |
| Credentialing committee review | Customer credentialing committee | VitalCV emits a `committee_review` audit event only |
| Privileging decisions | Customer facility credentialing | VitalCV makes no privileging assertion |
| Employment eligibility (I-9, OFAC) | Customer HRIS | Out of scope |
| Malpractice adjudication | Customer + verifier | VitalCV mints the NPDB self-query token; never the determination |
| Re-credentialing cycles | Customer CVO | Initial verification only during pilots |

## 4 · Pilot targets (Cedar Q2-2026 example)

| Target | Status |
|---|---|
| 10 NPIs / 30 days resolution against NPPES + PECOS | pilot_target |
| Time-to-receipt ≤ 1 h median across the cohort | pilot_target |
| Zero substantive discrepancies vs CVO baseline | pilot_target |
| Operator load ≤ 90 min total across 30 days | pilot_target |
| Audit defensibility on a single-read walkthrough | pilot_target |

## 5 · Planned capabilities (not yet pilot-targeted)

| Capability | Horizon | Notes |
|---|---|---|
| DEA registration resolution (active adapter) | future pilot | Currently `pilot_target`-class in some surfaces; not implemented |
| NPDB self-query token minting (live integration) | future pilot | Pilot Deployment Kit names this in scope; live adapter not built |
| SAM.gov debarment screening (live integration) | future pilot | Surfaces that name SAM.gov MUST mark `pilot_target` until the adapter ships |
| State-board PSV in-platform (under partner CVO) | post-pilot | Explicitly outside the current pilot |
| Production Prisma `AuditEvent` chain retrofit | next coherence wave | Wrapper ready (PR #390); per-callsite adoption pending |

## 6 · Explicitly unsupported

The platform does NOT:

- Touch patient PHI under any pilot configuration
- Connect to customer EMR, HRIS, or scheduling systems
- Make privileging decisions
- Issue Final Verification without operator review
- Provide HIPAA or SOC2 certifications (the platform is HIPAA-aware in design but does not claim certification)
- Replace the customer's CVO; it operates side-channel
- Provide an SLA during pilot engagements (read-only, no SLA per Pilot Deployment Kit)
- Provide military-grade or enterprise-grade encryption claims (TLS 1.3 + EdDSA / Ed25519 are the actual primitives)
- Guarantee cryptographic outcomes — receipts are re-verifiable against the public issuer DID, which is a different (and weaker) claim than "cryptographically guaranteed"

## Wallet-SDK diagnostic

`packages/wallet-sdk/` — workspace package; `main: dist/index.js` declared but `dist/` is not committed (intentional — build artifact). The only non-archive consumer in `apps/web` is `apps/web/components/developers/SdkDocs.tsx`, which references the package name in a code-example string template, not via a real `import` statement.

**Findings:**
- Not a dead package — declared workspace member with real source under `packages/wallet-sdk/src/`.
- Not orphaned — referenced in `apps/web/package.json` as `workspace:*`.
- No actual import-time export-resolution failure in production code on `origin/main`.
- The wave-listed "interoperability resolution failure" appears to be a build-artifact concern: if a downstream test or build step expects `packages/wallet-sdk/dist/index.js` to exist, it must first run `pnpm --filter @vitalcv/wallet-sdk build`.

**Recommendation (no fix made in this wave):** Add a turbo `dependsOn` so any task that imports `@vitalcv/wallet-sdk` runs the SDK build first. Defer until a real consumer takes a hard import dependency. Today's only consumer is a template string in `SdkDocs.tsx`, which does not require the dist artifact.

## Banned phrases (CLAUDE.md project-wide truth contract)

The following phrases are banned in ALL user-facing copy. Tests guard against regression. The list is mirrored in
`apps/web/lib/trust/institutional-language.ts` (`BANNED_INSTITUTIONAL_PHRASES`):

- automatically verified
- guaranteed verification
- complete credentialing
- instant credentialing
- legally accepted
- risk transferred
- final verification without review
- source confirmed before response
- certified compliant
- HIPAA compliant
- SOC2 certified
- bare "Verified" as a status label
- fully verified
- federally integrated
- fully automated
- cryptographically guaranteed
- immutable ledger
- military-grade
- enterprise-grade encryption
- fully compliant
- instant verification
- magical / seamless / effortless / magic / seamlessly

## Governance

Adding a new operational claim to a user-facing surface requires:

1. A row in one of tables 1–6 above
2. For `implemented` and `operator_assisted` claims: an evidence reference (code path, route, well-known endpoint)
3. The claim built via `defineOperationalClaim({...})` from `apps/web/lib/trust/assertOperationalClaimEvidence.ts`
4. A test that runs `auditEvidenceCoverage([...claims])` and asserts the failing-claim list is empty

PRs that introduce an unsupported claim without one of the above MUST be rejected by Codex audit.
