# M4 — Compliance Program — Status

**Date:** 2026-07-06
**Principle:** never claim a certification before it exists. Language stays
"HIPAA-aligned", never "HIPAA compliant/certified" (enforced by the copy gate).

## Shipped this wave

- **M4-1 Data map + zero-PHI-on-chain guard.** `docs/compliance/data-map.md` +
  `assertHashOnlyAnchor()` enforced at the anchor boundary (`anchorWorker.ts`),
  15-case test. Fails closed on any non-hash payload. **Done.**

## Documented / follow-up (with honest disposition)

| Item | State | Disposition |
|---|---|---|
| **M4-2 Encryption posture** | Railway Postgres = encryption at rest (provider default); TLS everywhere | Needs a written attestation citing Railway's evidence + a key-management note. Field-level encryption for sensitive receipt payloads = code follow-up. |
| **M4-3 HIPAA-alignment packet** | Not written | Real deliverable I can draft (safeguards mapping, access-control policy built on the audit-first rule, incident-response plan). **BAA template needs legal counsel review — external.** |
| **M4-4 Access logging & review** | Audit-first mutation rule exists; operator-access logging partial | Add operator/admin data-access logging + a quarterly review procedure. |
| **M4-5 Data-subject rights** | Not built | Export (full evidence bundle) + deletion honoring append-only audit via tombstone pattern. Code follow-up. |
| **M4-6 SOC 2 Type I** | Not started | **External** — auditor selection + evidence tooling (Vanta/Drata) + audit engagement. Cannot be completed in-repo. |
| **M4-7 NCQA CR1–CR5 mapping** | Not written | Buyer-facing mapping doc against *implemented* behavior only (PSV receipts, monitoring, audit trail). Doc I can draft. |
| **M4-8 Compliance copy hook** | **Partially done** — the copy gate (M1-8) already bans HIPAA/SOC2/NCQA certified claims. Extend with a compliance-claims allowlist + sign-off process. |

## Assessment

The one **code-enforceable** compliance control in M4 — zero-PHI-on-chain — is
shipped and test-proven. The rest of M4 is a documentation + external-auditor
program: the HIPAA-alignment packet and NCQA mapping are drafts I can produce, but
SOC 2 Type I and the BAA legal review are genuinely external and cannot be
"completed" from the repo. The copy gate already prevents premature certification
claims.
