# VitalCV "God-Mode" Research Report — Ship-Now Transformation Base

> Research foundation for a god-mode wave of Claude Code task bundles.
> Compiled 2026-07-04 from three grounded streams: (1) live repo audit, (2) competitive gap/leapfrog analysis, (3) standards/regulatory/moat scan.
> Lens: balanced (competitive + moat + GTM). Horizon: **ship-now (weeks)**, executable against the current tree.
> **The actual task-wave bundles are the next step** — this report defines the targets they aim at.

---

## 0. Headline

The market moved *toward* VitalCV in 2025–26. W3C VC 2.0, OID4VCI/VP/HAIP 1.0 Finals, NIST 800-63-4 accepting verifiable credentials as IAL2 evidence, and NCQA + Joint Commission now **mandating** continuous, traceable, source-backed verification — all describe exactly what VitalCV was built to be. Meanwhile the repo is in better shape than the doctrine docs claim: **the NPI→passport→employer-review wedge is wired end-to-end and audit-first**, live copy is clean of banned strings, and the mobile wallet is no longer empty. The transformation opportunity is therefore not a rebuild — it's **hardening the wedge, landing the front door, and packaging the moat as sellable proof points**.

---

## 1. Grounded repo reality (re-baseline before planning)

**Already resolved on disk (contradicting older blocker docs — do NOT bundle these):**
- Marketing→web seam: `apps/marketing/app/clinician/page.tsx` now redirects into the live `/passport` flow (old P0 fixed).
- Hero/HomeSections banned-string copy: **zero hits** for `hire instantly`, `zero-trust ledger`, `blockchain-anchored`, `HIPAA compliant`, `SOC 2 certified` etc. across live `apps/web` + `apps/marketing`. Demo metrics labeled "illustrative."
- `apps/mobile`: **built** (Expo: `LocalCredentialStore`, `OfflinePresentationEngine`, `OID4VPHandler`, `NotificationService` + tests).
- Passport is **backend-proxied, not fixtures** (`apps/web/app/api/passport/[npi]/route.ts`).
- Employer accept is **real + audit-first**: `POST /api/employer-review/:entityId/accept` writes `AuditEvent` in a transaction, guards duplicates, fails closed on BLOCKED.

**Genuinely open, ship-now gaps (the real backlog):**
- **Self-serve clinician signup gate: specified but unbuilt.** `apps/web/app/signup/page.tsx` renders an honest foundation stub (`accountCreationProductionReady: false`, `identityProofingComplete: false`). The brief at `docs/research/clinician-signup-verification-brief.md` describes the target.
- **Security/pilot hardening:** prod auth/Google OAuth (unverified), no e2e signup test, no audited CSP/security headers, no Zod env validation, no OWASP ASVS scorecard, verifier RBAC not enforced (`rbacEnforced: false`).
- **Source breadth:** only NPPES, OIG/LEIE, PECOS, Open Payments, academic sources live. STATE_BOARD/FSMB/Nursys/SAM.gov gated; `sourceRegistry.ts` throws "Real Nursys adapter not implemented" when flagged on.
- **Empty apps:** `router`, `docs`, `sample-api`, `status-api`, `lib` (0–2 files). Several packages are dist-only (`audit-receipts`, `claims`, `vitalindex`, `rate-limiter`, `runtime-mode`, `idempotency`, `conflict-resolution`) — verify before depending on them.

**Safe-to-build foundations:** the wedge API (`employerActions.ts`, `ingestStream.ts`, `passport.ts`), `sourceCatalog.ts` + adapter model, the signup foundation stub, issuer-api/verifier-api scaffolding.

> ⚠️ **Two unknowns to verify first:** (a) whether the PR-merge-dependent blockers actually landed (can't tell from the working tree), and (b) prod auth/OAuth status. Re-baseline the blocker list against the current tree before executing any wave.

---

## 2. Competitive position (where to catch up vs. leapfrog)

**VitalCV's uncontested territory (leapfrog — no competitor occupies it):**
1. **Reusable, clinician-owned source-backed evidence** — everyone else re-verifies per customer; VitalCV's wallet+passport makes one verification portable. This *is* the category.
2. **Claim-level receipts + provenance** (source→timestamp→checksum→parser version), selectively disclosable.
3. **Trust gradients / coverage honesty** (checked/gated/stale/unknown, revoked fails closed) vs. competitors' binary verified/not.
4. **Composite explainable trust score (CRS)** — nobody ships an explainable 0–100 readiness score.
5. **Cross-employer portability + clinician ownership** — turns credentialing from per-hire cost into a network asset.

**Must catch up (table stakes rivals already have):**
1. **Source breadth** — Verifiable/Medallion/symplr verify NPDB, DEA, SAM, FSMB, Nursys. (Doctrine forbids *claiming* NPDB/DEA — land adapters honestly, gate the copy.)
2. **Certifications** — SOC 2 Type II (OpenEvidence, Verifiable), HITRUST (symplr), NCQA accreditation (Medallion). VitalCV is "aligned," not certified → blocks procurement.
3. **Epic / EHR embedding** — the shared distribution moat (OpenEvidence, Abridge, symplr).
4. **Frictionless signup funnel** — OpenEvidence's NPI gate built 757k clinicians; VitalCV's pipeline exists but the front-door UX is thin.
5. **Downstream integration** — integrate *into* payer-enrollment/privileging (Medallion/symplr depth) rather than appear to skip it.

**Biggest strategic risk:** OpenEvidence/ChatGPT already hold the verified-clinician front door at scale (boolean gate). If either bolts credential *evidence* onto it, they leapfrog VitalCV's wedge. **Speed on the wallet-as-artifact front door is the priority.**

---

## 3. Standards & regulatory tailwinds (adopt now)

- **NCQA (Jul 2025):** API-based PSV now production-legitimate (with human review); PSV window 180→120/90 days; **continuous monthly monitoring now required** (license expiry + OIG/SAM/board exclusions). VitalCV's readiness+freshness engine *is* rolling verification. → Package as an "NCQA-aligned continuous-verification substrate"; per-claim "monitored monthly" badge. **[M, ship-now]**
- **Joint Commission (2025):** every verification must be traceable (date + source contacted), survey-ready. VitalCV's claim-level receipts answer this natively. → "JC survey-ready evidence export." **[S, ship-now]**
- **CMS/NPPES:** V1 bulk files sunset **03/03/2026** → V2 only; API is v2.1. ⚠️ **That deadline has passed (today is 2026-07-04) — verify ingestion is on NPPES v2.1 + V2 bulk immediately, or NPI enrichment is silently degrading.** **[S, verify now]**
- **W3C VC Data Model 2.0:** Recommendation since 15 May 2025 + Bitstring Status List for revocation → adopt for the revocation registry (revocation-first doctrine). **[M]**
- **OID4VCI/VP 1.0 + HAIP 1.0 Final (Dec 2025):** pin wallet-sdk/verifier-api to the Final profiles; `packages/haip-config` already exists. **[M]**
- **NIST SP 800-63-4 (final Jul 2025):** explicitly recognizes VCs/mDLs as IAL2 evidence; passkeys = AAL2 baseline. → map VitalCV L2↔IAL2, L3↔IAL3; add passkey + DPoP for AAL2. Becomes an enterprise/federal proof point. **[M]**

---

## 4. Prioritized opportunity themes (these seed the task waves)

Ordered by leverage for "best platform, shippable in weeks." Each is a candidate god-mode wave.

| # | Theme | Why now | Type | Size |
|---|---|---|---|---|
| **A** | **Land the self-serve clinician signup gate** (NPI→attestation→wallet, evidence not a boolean) | Owns the OpenEvidence-style front door; foundation stub + brief already exist | GTM + wedge | M |
| **B** | **Pilot security hardening** (prod auth/OAuth, CSP + security headers, Zod env validation, verifier RBAC, e2e signup test, OWASP scorecard) | The real Tier-2 pilot blockers; gates any real buyer | Trust/infra | M |
| **C** | **NPPES v2 cutover + source-breadth adapters** (verify v2.1/V2; land STATE_BOARD/FSMB honestly; SAM.gov) | Cutover deadline passed; breadth is table stakes | Catch-up | S–M |
| **D** | **Continuous-monitoring + freshness packaging** (flip Wave 245 async engine on; per-claim freshness/decay badge; "monitored monthly") | NCQA now *requires* it; VitalCV nearly has it | Moat + compliance | M–L |
| **E** | **Revocation registry via Bitstring Status List + VC 2.0 alignment** | Revocation-first doctrine; standards-final | Moat/standards | M |
| **F** | **Compliance proof-pack surfaces** (JC survey-ready export; NIST IAL2 mapping doc + passkey/DPoP AAL2; audit-trail packet polish) | Turns architecture into sellable artifacts; unblocks procurement | GTM/compliance | S–M |
| **G** | **Trust-gradient + CRS visibility polish** (make coverage honesty + explainable score the passport's visible signature) | The leapfrog differentiator, under-surfaced today | Moat/UX | M |
| **H** | **Divergence detection + claim-level receipt surfacing** (7-rule cross-source divergence; provenance on every claim) | Uniquely VitalCV; the "truth layer" wedge | Moat | M |
| **I** | **Repo hygiene** (empty apps: delete or scaffold `router`/`docs`/`status-api`; verify dist-only packages; re-baseline blocker docs) | Reduces drift; makes waves safe to execute | Infra | S |
| **J** (longer-horizon) | **FHIR-triggered re-verification** (R5/R6 Subscriptions on Practitioner changes → auto re-verify) | Highest-moat EHR wedge; nobody's productized it | Moat/EHR | L |

**Recommended ship-now sequence:** I (hygiene/re-baseline) → C (NPPES verify) as fast pre-work → then A (signup gate) + B (security) as the two flagship waves → D/E/F/G/H as moat/compliance waves → J queued for the next horizon.

---

## 5. Guardrails for every wave (from doctrine)

- Preserve the canonical path (Recognition→Acceptance→Start); audit-first on every mutation; revoked fails closed.
- Zero PHI on-chain; HAIP posture intact; no `prisma migrate` without approval (SQL plan to `docs/migrations/` only).
- Never claim uncertified (SOC 2 / NCQA / HIPAA-certified) or unintegrated sources (NPDB/DEA/ABMS); banned-string discipline; no bare "Verified" status label.
- Cowork builds the plan; **Claude Code executes**; Codex verifies before merge. Diff against `origin/main`.

---

## 6. Sources
Competitive: Medallion, symplr/VerityStream CredentialStream, Verifiable, AMA VeriCre, OpenEvidence, ChatGPT for Clinicians, Abridge (see `competitive` stream links in this folder's companion notes).
Standards: [W3C VC 2.0 Recommendation](https://www.w3.org/news/2025/the-verifiable-credentials-2-0-family-of-specifications-is-now-a-w3c-recommendation/) · [HAIP 1.0 Final](https://openid.net/openid4vc-high-assurance-interoperability-profile-haip-1-0-final-specification-approved/) · [NIST SP 800-63-4 final](https://csrc.nist.gov/pubs/sp/800/63/4/final) · [NCQA continuous monitoring](https://insights.wchsb.com/2026/01/27/credentialing-enters-the-continuous-monitoring-era/) · [Joint Commission PSV FAQ](https://www.jointcommission.org/en-us/knowledge-library/support-center/standards-interpretation/standards-faqs/000001440) · [NPPES files/API](https://download.cms.gov/nppes/NPI_Files.html) · [FHIR Subscriptions R6](https://build.fhir.org/subscription.html)
Prior briefs: `docs/research/clinician-signup-verification-brief.md`, `docs/research/vitalcv-research-pdf-index.md`.
