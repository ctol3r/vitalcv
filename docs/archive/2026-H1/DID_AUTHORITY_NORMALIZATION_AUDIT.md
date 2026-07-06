# DID Authority Normalization Audit
Generated: 2026-05-13T18:00:00Z
Decision recorded: 2026-05-13T17:59 PDT
Commit: pending (this document + doc patches = one commit)

---

## Decision

**Canonical institutional DID authority: `did:web:vitalcv.com`**

Decision made by: Chris (project owner)
Rationale:
- Runtime already fully converged on `.com` across all surfaces
- Verifier, receipt, replay, and chronology continuity all anchored on `.com`
- Design archive used `.health` as a design-era placeholder only
- Normalizing to `.com` avoids issuer identity bifurcation
- No migration of existing receipts, replays, or JWTs required
- Preserves institutional continuity with zero breakage

---

## Normalization Scope

### 1. Runtime Source Code

**Pre-decision state:** Already clean. Zero `vitalcv.health` references in source.

| File | DID Reference | Status |
|------|---------------|--------|
| `apps/web/app/api/.well-known/did.json/route.ts` | `did:web:vitalcv.com` | ✅ Already canonical |
| `apps/web/app/api/.well-known/trust.json/route.ts` | `did:web:vitalcv.com` | ✅ Already canonical |
| `apps/web/app/api/.well-known/openid-credential-issuer/route.ts` | `https://vitalcv.com` | ✅ Already canonical |
| `apps/web/app/api/.well-known/openid-configuration/route.ts` | `https://vitalcv.com` | ✅ Already canonical |
| `apps/web/app/api/.well-known/jwks.json/route.ts` | `https://vitalcv.com` | ✅ Already canonical |
| `apps/web/lib/crypto/receiptIssuer.ts` | `issuer: https://vitalcv.com` | ✅ Already canonical |
| `apps/web/app/api/status/route.ts` | `issuer_did: did:web:vitalcv.com` | ✅ Already canonical |
| `apps/web/app/api/receipt/[lineageKey]/route.ts` | `ISSUER_DID = 'did:web:vitalcv.com'` | ✅ Already canonical (fixed earlier session) |
| `apps/api/backend/src/` (all files) | No DID references | ✅ Clean |

**No source code changes required.**

### 2. Documentation (Patched This Session)

| File | Change | Status |
|------|--------|--------|
| `CLAUDE_DESIGN_SOURCE_MAP.md` | Removed `.health` references in discrepancy table; normalized TSA anchor notation | ✅ Patched |
| `CLAUDE_DESIGN_ALIGNMENT_AUDIT.md` | Replaced discrepancy item with RESOLVED notice | ✅ Patched |
| `FINAL_RUNTIME_TRUTH_CONVERGENCE.md` | Replaced discrepancy section with RESOLVED section | ✅ Patched |
| `FINAL_REPLAY_CONTINUITY_HARDENING.md` | No `.health` references — already clean | ✅ Clean |
| `FINAL_BLOCKER_MATRIX.md` | No `.health` references — already clean | ✅ Clean |
| `FINAL_INSTITUTIONAL_READINESS_SYNTHESIS.md` | No `.health` references — already clean | ✅ Clean |
| `FINAL_VERIFIER_CONTINUITY_AUDIT.md` | No `.health` references — already clean | ✅ Clean |
| `FINAL_OPERATOR_ACTIVATION_STATE.md` | No `.health` references — already clean | ✅ Clean |
| `DID_AUTHORITY_NORMALIZATION_AUDIT.md` | This document — canonical record of decision | ✅ New |

### 3. Design Archive (`vitalcv (7).zip`)

The design archive is a read-only historical artifact. Its `.health` references were
design-era placeholders, not production configuration. The archive is not modified.

**Treatment:** Design archive domain references are superseded by this decision.
Any future implementation work derived from the design archive must substitute
`vitalcv.com` for any `.health` occurrences encountered.

**TSA anchor:** Design specified `did:web:tsa.vitalcv.health` as the independent TSA
anchor. When TSA/RFC 3161 anchoring is implemented, the correct canonical form is:
`did:web:tsa.vitalcv.com`

---

## Verification

### Live Endpoint Confirmation (2026-05-13T17:53Z)

All `.well-known/` endpoints confirmed returning `vitalcv.com` as issuer identity:

```
GET /.well-known/jwks.json         → kid: vcv-es256-dev         ✓
GET /.well-known/did.json          → id: did:web:vitalcv.com    ✓
GET /.well-known/openid-credential-issuer → issuer: https://vitalcv.com ✓
GET /.well-known/openid-configuration    → issuer: https://vitalcv.com ✓
GET /.well-known/trust.json        → issuer: did:web:vitalcv.com ✓
GET /.well-known/trust-register    → issuer: did:web:vitalcv.com ✓
GET /api/receipt/nppes_identity:1457128589 → issuerDid: did:web:vitalcv.com ✓
GET /api/receipt/test-legacy-001   → issuer_did: did:web:vitalcv.com ✓
GET /api/status                    → issuer_did: did:web:vitalcv.com ✓
```

### Zero-Hit Verification

Post-patch grep across all source + docs:

| Scope | `vitalcv.health` hits | Result |
|-------|-----------------------|--------|
| `apps/web/app/` | 0 | ✅ |
| `apps/web/components/` | 0 | ✅ |
| `apps/web/lib/` | 0 | ✅ |
| `apps/web/styles/` | 0 | ✅ |
| `apps/api/backend/src/` | 0 | ✅ |
| `apps/marketing/` | 0 | ✅ |
| `docs/` | 0 | ✅ |
| Root `*.md` files | 0 | ✅ |
| Workspace `memories/` | 0 | ✅ |
| Workspace `memory/` | 0 | ✅ |

---

## Identity Bifurcation Check: NONE

| Concern | Status |
|---------|--------|
| Mixed issuer identity in JWKS vs DID | ✅ None — both reference `vitalcv.com` |
| Mixed issuer identity in receipt JWT vs JWKS | ✅ None — receipt `iss` resolves to `vitalcv.com` |
| Replay lineage DID mismatch | ✅ None — replay attribution uses `did:web:vitalcv.com` |
| Verifier continuity DID mismatch | ✅ None — `/verify` surfaces all read `vitalcv.com` |
| OID4VCI discovery DID mismatch | ✅ None — credential_issuer = `https://vitalcv.com` |
| Trust register DID mismatch | ✅ None — trust-register issuer = `did:web:vitalcv.com` |
| Chronology reference DID mismatch | ✅ None — no `.health` in chronology surfaces |

---

## Forward Binding

All future work is bound by this decision:

1. **New routes:** Use `ISSUER_DID = 'did:web:vitalcv.com'` — never hardcode `.health`
2. **New docs:** Reference `did:web:vitalcv.com` as the canonical institutional DID
3. **Design work:** When consuming the design archive, substitute `vitalcv.com` for any design-era domain placeholder
4. **TSA anchor (future):** Implement as `did:web:tsa.vitalcv.com`
5. **Status List (future):** Implement as `https://vitalcv.com/status/v1/list.jsonld`
6. **Backup signer key (future):** DID reference = `did:web:vitalcv.com#backup-signer-1`

---

## SUCCESS

Single canonical institutional issuer identity across all runtime and design surfaces:

**`did:web:vitalcv.com`**

No mixed identity. No continuity bifurcation. No replay/receipt/verifier drift.
Zero migration required. Decision recorded and forward-binding.
