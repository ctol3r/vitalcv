# VitalCV Public Claims Matrix

Last updated: 2026-04-27
Source branch: `fix/truth-align-live-sales-code-claims`

This matrix is the single source of truth for what VitalCV may say in
public-facing copy (site, marketing components, employer/review surfaces).

## Reading the matrix

- **Status**:
  - **Live** — implementation merged on `main`, verified end-to-end. Use the **Allowed wording** freely.
  - **Partial** — some implementation exists; copy must use a qualifier ("pilot", "boundary", "metadata", "planned").
  - **Planned** — architecture or scaffolding only; copy must say "planned" or omit.
  - **Forbidden** — no implementation; the claim must not appear in any public surface.
- **Public surface** lists the rendering files (live, non-archived, non-sandbox).
- **Code support** points at the implementation evidence (or its absence).
- **Evidence** is the verifying merge / file path.

| Claim | Public surface (live) | Code support | Status | Allowed wording | Forbidden wording | Evidence |
|---|---|---|---|---|---|---|
| NPPES identity lookup | `marketing/HeroSection.tsx`, `hero/SystemConsole.tsx` | `apps/web/app/api/ingest/[npi]/route.ts` proxy + fallback | **Live** | "source-backed identity (NPPES)", "NPI lookup with source backing" | "verified physician identity", "identity-proofed" | LIVE-100C/D fallbacks |
| OIG / LEIE check | trust-state surfaces | NPPES fallback identity pipeline + OIG/PECOS honest fallback cadence per Wave GOD-3S | **Partial** | "OIG/LEIE source-backed check (cadence: per-source)" | "real-time OIG verification", "continuous OIG monitoring" | existing board: "Truth/Enforcement 71% — Identity, OIG, PECOS enforced" |
| PECOS public posture | trust-state surfaces | Same fallback pipeline | **Partial** | "PECOS public posture lookup" | "PECOS-certified", "real-time PECOS sync" | same |
| State board / FSMB lane | (no live surface) | Existing board: "Authority Lanes 32% — state boards require extensive adapter build-out" | **Planned** | "state-board lane on the roadmap" | "state license verified", "FSMB-verified" | existing board |
| Source-backed PSV (issuer chain) | `review/*`, `policy-review/*`, `issuer/*` | PRs #166–#180 | **Partial** | "source-backed PSV chain (boundary-only persistence)", "PSV receipt boundary" | "PSV completed", "PSV stored", "production PSV" | #180 truth contract |
| Provenance vocabulary (5-tier: VERIFIED/USER_ENTERED/INFERRED/UNKNOWN/CONFLICT) | `passport/*`, `trust-state/*`, `marketing/HeroSection.tsx` | Wave GOD-3S enforcement | **Live** | "provenance-tracked", "5-tier provenance" | "verified data" (without tier qualifier) | Wave GOD-3S |
| Knowledge Trust Graph (data model + JSON) | `passport/[id]` panel, `trust-state/*` | `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` boundaries 1–28 | **Live** | "Knowledge Trust Graph data model", "graph rules" | "interactive Roam-style graph UX" (Partial) | Wave GOD-3 + #166 |
| Issuer request / router / partner route | `issuer/*`, `review/*` | PRs #167, #168 | **Live** | "issuer router", "partner route model" | "fully automated issuer onboarding" | #167, #168 |
| Receipt candidate (literal `decisionGrade:false`, `proofTier:'receipt_candidate'`) | `review/[entityId]` | `apps/web/lib/issuer-verification/receiptCandidate.ts` | **Live** | "receipt candidate", "candidate (not yet a verified receipt)" | "verified receipt", "PSV receipt" (when actually a candidate) | CLAUDE.md truth contract |
| Policy review 5-gate flow | `policy-review/[requestId]` | `apps/web/lib/issuer-verification/policyReview.ts` | **Live** | "policy review with 5 acceptance gates" | "automatic policy clearance" | code |
| PSV receipt promotion + reuse + revocation boundary | `review/*` | PR #172 | **Live** | "PSV receipt boundary", "reuse / revocation rules" | "instant credentialing", "complete credentialing" (banned per CLAUDE.md) | #172 |
| Audit-boundary metadata (event schema, no real writer) | `employer/*`, `review/*`, `passport/SharePacketModal`, `marketing/BentoGrid`, `hero/SystemConsole`, `marketing/AcceptanceNetwork` | PRs #175, #176, #177, #180; **default writer is `createDeferredServerPsvReceiptWriter` — never persists** | **Partial** | "audit-boundary metadata", "audit-boundary record", "captured as audit-boundary entry", "pilot audit-boundary metadata", "audit-ready structure" | "audit trail", "audit event recorded", "logged to audit trail", "production audit trail", "Merkle audit trail", "cryptographically anchored", "Cryptographic Audit Anchor", "tamper-proof", "irreversible proof" | #175 / #180 defer doc |
| Server persistence writer | (none — internal only) | `serverPsvReceiptWriter.ts` deferred default; defensive downgrade orchestrator | **Partial** (boundary only) | "server-side persistence boundary", "deferred persistence writer", "boundary contract" | "persisted by default", "production database write" | #180 |
| Real persistence writer (DB-backed PSV receipt write) | (must not be claimed) | None on `main`. Schema/RPC/audit-table blockers per #180 defer memo. | **Forbidden** | (none — do not claim) | "persisted", "stored in our database", "permanently recorded" | absence; #180 defer memo |
| Cryptographic signing of audit records | (must not be claimed) | None | **Forbidden** | "cryptographic signing is on the roadmap" (only inside an explicit roadmap context) | "cryptographically verifiable audit trail", "cryptographically signed compliance", "signed audit records" | absence |
| "Audit trail" as a bare phrase | n/a | No real writer ships; default writer never persists (#180) | **Forbidden** | "audit-boundary metadata", "audit-boundary record", "pilot audit-boundary entry", "audit-ready structure" | "audit trail", "production audit trail", "logged to audit trail", "audit event recorded" | banned per CLAUDE.md |
| "Cryptographic audit trail" | (must not be claimed) | None | **Forbidden** | (none) | "cryptographic audit trail", "cryptographic audit record" | absence |
| "Merkle audit trail" | (must not be claimed) | None | **Forbidden** | (none) | "Merkle audit trail", "Merkle-anchored", "anchored to Merkle root" | absence |
| Self-sovereign identity | (must not be claimed) | None | **Forbidden** | (none) | "self-sovereign", "user-owned wallet", "self-sovereign DID" | banned per CLAUDE.md / brief |
| Blockchain | (must not be claimed) | None on `main` | **Forbidden** | (none) | "blockchain verified", "blockchain-anchored", "on-chain" | absence |
| Identity proofing (IAL/AAL) | (must not be claimed) | No documented IAL/AAL policy per Completion Board | **Forbidden** | (none — see Completion Board for roadmap) | "identity-proofed", "IAL2 verified", "AAL2 enforced" | absence |
| W3C Verifiable Credentials shipped | `marketing/HomeSections` (now qualified), `apps/marketing/app/progress/page.tsx` (out of scope, see Skipped) | None on `main` issuance path | **Planned** | "VC-compatible architecture (planned)", "built toward W3C VC" | "W3C VC issued", "W3C VC support", "✓ W3C VC" badge | absence |
| SD-JWT issuance | `marketing/HomeSections` (now qualified), `sandbox/*`, `developers/*` | Sandbox-only | **Planned** | "SD-JWT planned", "designed to align with SD-JWT" | "SD-JWT issued", "✓ SD-JWT" badge | absence |
| OID4VC / OpenID4VCI | `marketing/HomeSections` (now qualified), `marketing/HeroSection` (badge removed), `developers/*` | Sandbox-only | **Planned** | "OpenID4VCI architecture planned" | "✓ OID4VCI" badge, "OID4VC issuance live" | absence |
| ES256 / cryptographic signature suite | `marketing/HeroSection` (badge removed) | None on issuance path | **Forbidden in marketing badges** | "ES256 planned" (inside roadmap context only) | "✓ ES256" badge | absence |
| HIPAA compliance | `marketing/HeroSection` (badge removed) | No HIPAA program / BAAs / audited controls per existing board | **Forbidden** | "HIPAA-aligned design intent" (only with roadmap context) | "HIPAA compliant", "HIPAA-aligned" (as bare badge), "✓ HIPAA-aligned" | banned per CLAUDE.md / PR-180 contract |
| SOC 2 | (must not be claimed) | None | **Forbidden** | (none) | "SOC 2 certified", "SOC 2 compliant" | banned per CLAUDE.md |
| NCQA verified | (must not be claimed) | None | **Forbidden** | (none) | "NCQA verified", "NCQA certified" | absence |
| Wallet (digital credential wallet) | `holder/*`, `wallet/*`, `passport/PassportWallet`, `passport/ClinicianPassport`, `clinician/WalletDashboard`, `clinician/CredentialPresentationActions`, `embeddable/ApplyWithVitalCV`, `marketing/AcceptanceNetwork` (now "credential record") | Components exist as UI scaffolding; no wallet protocol (issuance, presentation, key management) implemented | **Planned** | "credential record", "credential portfolio", "wallet UX preview" | "credential wallet", "wallet ready", "self-sovereign wallet", "import to your wallet" (without "preview" qualifier) | absence of OID4VP / DIDComm / wallet protocol |
| DID (subject / issuer / verifier identifiers shown in UI) | `clinician/CredentialCard`, `evidence/VerificationReceipt`, `verifier/AcceptancePanel`, `verifier/AuditProofViewer`, `issuer/IssuerPortal`, `ops/IssuerOnboardingPanel`, `substrate/TrustSubstratePanel` | Internal `did:vitalcv:*` identifier convention; **no external DID method (did:web, did:key, did:ion) registered or resolvable**; no DID-anchored signing | **Partial** (display label only) | "VitalCV identifier (DID-style)", "internal issuer identifier" | "decentralized identifier", "self-sovereign DID", "DID Verified" (as truth claim about external DID) | code-only display |
| Biometric signature payload binding | `verifier/AuditProofViewer.tsx:157` | None on `main` | **Forbidden** | (none) | "biometric signature payload", "bound via biometric signature" | absence |
| Government ID verification / liveness | (must not be claimed) | None | **Forbidden** | (none) | "government ID verified", "liveness checked", "identity-proofed" | absence; per Completion Board |
| Native iOS / Android app | (must not be claimed) | None | **Forbidden** | (none) | "iOS app", "Android app", "in the App Store" | absence; per Completion Board |
| Continuous monitoring of compliance | `hero/SystemConsole` (now "monitors freshness") | Freshness timers exist; "compliance monitoring" overstates this | **Partial** | "continuously monitors source freshness", "freshness windows tracked" | "continuously monitors compliance", "live compliance monitoring" | code |
| 21st Century Cures / TEFCA framing | `marketing/HomeSections` | Background context, not a product claim | **Live** (as context) | "TEFCA and Cures Act create the demand window" | "TEFCA-certified", "Cures-Act compliant" | regulatory text only |

## Blanket banned strings (any public surface)

These never appear, in any context, in any public-facing file:

`automatically verified` · `guaranteed verification` · `complete credentialing` · `instant credentialing` · `legally accepted` · `risk transferred` · `final verification without review` · `source confirmed before response` · `certified compliant` · `HIPAA compliant` · `SOC2 certified` · `audit event recorded` · `logged to audit trail` · `production audit trail` · `persisted by default` · `irreversible proof` · `global credential truth` · `tamper-proof` · `blockchain verified` · `self-sovereign` · `cryptographic handshake`

The bare word **Verified** must not appear as a status label.

## Skipped in this PR (cataloged for follow-up)

These were detected but **not patched in this PR** to respect scope and the brief's "do not touch" rules. They are listed here for follow-up waves.

| Item | Where | Why skipped | Required follow-up |
|---|---|---|---|
| `apps/marketing/app/progress/page.tsx` — "audit trail", "W3C VC" | separate marketing app | Brief and CLAUDE.md forbid touching `apps/marketing` from issuer waves | Spawn dedicated `apps/marketing` truth-align wave with marketing-app owner |
| `apps/web/app/_archive/wave119/**` — "wallet", "audit trail", "DID", "SD-JWT" copy | archived routes | Already archived; not in live conversion path | Delete archive directory or leave as-is |
| `apps/web/components/sandbox/*` — SD-JWT, audit trail, wallet copy | sandbox demo surfaces | Sandbox is dev-facing, not buyer-facing | Add `// SANDBOX` banner; defer wording fix |
| `apps/web/components/developers/SdkDocs.tsx`, `ConformanceReport.tsx` — SD-JWT / OID4VCI / DID copy | developer docs surface | Developer audience expects roadmap discussion; needs a separate "what's shipped vs planned" pass | Add a "Status: Planned" badge per row in those docs |
| Wallet routes (`/holder`, `/wallet`) and components (`WalletDashboard`, `WalletPassport`, `CredentialWallet`, `PassportWallet`, `CredentialPresentationActions`) | live routes | Removing or renaming is a structural product decision, not a copy patch — out of scope per brief's "DO NOT touch unrelated product code" | Follow-up wave: either implement wallet protocol or rename/feature-flag the routes |
| DID labels in `IssuerPortal`, `IssuerOnboardingPanel`, `CredentialCard`, `VerificationReceipt`, `AcceptancePanel`, `AuditProofViewer`, `TrustSubstratePanel` | internal portal labels | Display strings for an internal `did:vitalcv:*` data model field. Renaming requires schema-coordinated change. | Follow-up wave: rename to "Issuer ID" / "Subject ID" with a glossary entry, or formalize external DID method |
| `AuditProofViewer.tsx:157` — "Bound to clinician DID via biometric signature payload" | live verifier component | Touches biometric claim plus DID claim; needs a coordinated rewrite of the AuditProofViewer demo | Follow-up wave: rewrite the demo line or feature-flag the component until biometric is shipped |
| `clinician/BiometricPrompt.tsx` — "Hardware Enclave Verified", "Cryptographic keys unlocked via biometrics" | live wallet-adjacent component | Component is the biometric/enclave UI itself; rewriting copy without removing or feature-flagging the component would still leave a wallet+biometric simulation. Structural change, not a copy patch. | Follow-up wave: feature-flag the component off until wallet/biometric ships, or rebuild with truthful "demo only" framing |
| `apps/web/lib/features.ts` | not yet inspected for flag-gated copy | Out of scope without a clear feature-flag inventory | Follow-up wave: enumerate flags + their copy implications |

## Application policy

1. Before adding a public-facing string that mentions cryptography, audit, persistence, identity proofing, wallet, DID, VC, SD-JWT, OID4VC, NCQA, HIPAA, SOC 2, or "verified", check this matrix.
2. If the claim is not already **Live** here, either qualify per **Allowed wording** or omit.
3. New **Live** claims require a row added to this matrix in the same PR that ships the implementation.
4. CI follow-up: a banned-string scan over `apps/web/app/**`, `apps/web/components/**` (excluding `_archive/`, `sandbox/`, `developers/`) is a planned addition.
