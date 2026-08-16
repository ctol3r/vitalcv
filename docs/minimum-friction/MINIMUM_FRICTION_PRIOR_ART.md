# Minimum Friction — Prior Art & Standards Research

**Program:** Minimum Friction (MF-WAVE-00, research/architecture only)
**Baseline:** `origin/main` @ `df0ff184c2da9fbc8cfaf73f26e1928188113e61` (2026-08-16)
**Status:** Research deliverable. Primary sources only. **No patent claims are made anywhere in
this program.** The goal of §2 is to *disprove* novelty, not to assert it.

---

## 1. Standards research — primary sources, with borrow / do-not-claim / premature

For each standard: the relevant principle, what VitalCV should **borrow**, what it must **not
claim**, and what would be **premature**. Sources are the official/primary URLs (as provided in the
founder thesis and confirmable at the issuing body). This wave cites; it does not implement.

### NIST SP 800-63-4 family (Digital Identity Guidelines)
Primary: `https://csrc.nist.gov/pubs/sp/800/63/4/final` · A-4 (proofing)
`https://csrc.nist.gov/pubs/sp/800/63/A/4/final` · B-4 (authentication)
`https://csrc.nist.gov/pubs/sp/800/63/B/4/final` · C-4 (federation).

- **Principle:** Revision 4 cleanly separates *identity proofing* (IAL), *authentication* (AAL),
  and *federation* (FAL); adds syncable authenticators/passkeys, wallet/attribute considerations,
  and risk-appropriate assurance.
- **Borrow:** the *idea* of assurance that rises with consequence, and the separation of "who are
  you" (proofing) from "is it you again" (authentication). This maps to the VCV-A0..A5 ladder
  (SECURITY §3) — proofing-like rungs (A2 claimed, A3 corroborated, A5 external proofing) kept
  distinct from authentication rungs (A1 session, A4 passkey/step-up).
- **Do NOT claim:** any **IAL/AAL/FAL conformance**. VitalCV's ladder is *VitalCV-specific and
  internally labelled*; conformance requires testing VitalCV has not done.
- **Premature:** external identity proofing (A5) and syncable-authenticator federation. Build A4
  (passkey/step-up) first; A5 only when a real transaction demands it.

### NIST Privacy Framework
Primary: `https://www.nist.gov/privacy-framework`.

- **Principle:** privacy engineering objectives — *predictability, manageability,
  disassociability*, alongside confidentiality/integrity/availability.
- **Borrow:** *manageability* and *disassociability* as design targets. Purpose-bound sharing and
  selective disclosure (Disclosure Admission Gate) directly increase user manageability; the
  minimum-disclosure objective (OPTIMIZATION §6) directly serves disassociability.
- **Do NOT claim:** a completed Privacy Framework profile or maturity tier.
- **Premature:** a full Framework Core mapping. Useful later as an org-level control map, not a v0
  product artifact.

### NIST AI RMF + Generative AI Profile (NIST-AI-600-1)
Primary: `https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence`.

- **Principle:** govern/map/measure/manage AI risk; GAI-specific risks include *confabulation* and
  information integrity.
- **Borrow:** the framing that generative output is a *risk to information integrity* — which is
  precisely the AI Candidate Quarantine (SECURITY §2): AI may propose, never create, professional
  truth. Confabulation is the named risk the `INFERRED → USER_ENTERED/CONFLICT` boundary manages.
- **Do NOT claim:** AI RMF conformance or a completed profile.
- **Premature:** measurement instrumentation for model confidence calibration. v0 keeps AI output
  quarantined regardless of confidence; calibration is a later refinement.

### W3C Verifiable Credentials Data Model 2.0
Primary: `https://www.w3.org/TR/vc-data-model-2.0/` (W3C Recommendation, May 2025).

- **Principle:** interoperable, cryptographically verifiable credentials with privacy-respecting
  presentation and data minimization.
- **Borrow:** the *data-minimization and selective-presentation* lesson. VitalCV already signs
  receipts (`did:web:vitalcv.com` issuer) and has an unwired OID4VP layer.
- **Do NOT claim:** VC 2.0 conformance, or that VitalCV "issues W3C Verifiable Credentials" as a
  product feature.
- **Premature:** converting the professional state to VCs now. The IP note
  (`docs/strategy/fto-axuall-12079891.md`) is decisive here: **do not put the clinician in the loop
  as a credential-presenting *holder*** — evaluate employer requirements server-side against
  VitalCV-held source reads instead. VC/OID4VP presentation is a *future rail*, and one with an FTO
  question attached, not a v0 requirement.

### OpenID4VP 1.0 / OpenID4VCI 1.0
Primary: `https://openid.net/specs/openid-4-verifiable-presentations-1_0.html` ·
`https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-final.html`.

- **Principle:** standard protocols for presenting / issuing verifiable credentials.
- **Borrow:** nothing to implement now; keep as the interoperability target *if* a holder-present
  model is ever adopted.
- **Do NOT claim:** OID4VP/VCI support as a shipped capability. The repo's baseline test
  (`apps/web/__tests__/presentation-exchange-baseline.test.ts`) deliberately pins that **no product
  surface invokes** the OID4VP layer — moving that baseline is an FTO decision, not a green-CI fix.
- **Premature:** any presentation-exchange product surface. This is the single most important
  "premature" line in the standards set, because building it wrong walks into the Axuall '891 claim.

### RFC 9396 — OAuth 2.0 Rich Authorization Requests (RAR)
Primary: `https://www.rfc-editor.org/rfc/rfc9396.html`.

- **Principle:** express fine-grained, structured authorization detail (`authorization_details`
  objects with `type`, and per-type fields) instead of coarse scopes.
- **Borrow:** the **shape** — a typed, per-recipient, per-purpose, field-scoped authorization
  object — as prior art for the purpose-bound consent artifact (SECURITY §5, ARCHITECTURE consent
  audit). It is a clean model for "recipient X, purpose Y, exactly these fields, until Z."
- **Do NOT claim:** that VitalCV "implements RFC 9396" or is OAuth-RAR-compliant. Borrow the idea,
  not the machinery.
- **Premature:** adopting OAuth RAR endpoints/token machinery. VitalCV's consent lives in
  `ConsentReceipt`/`BundleShareEvent`, not in an OAuth authorization server; RAR informs the *data
  shape*, nothing more.

### OWASP ASVS 5.0
Primary: `https://owasp.org/www-project-application-security-verification-standard/`.

- **Principle:** current stable application security verification standard (5.0.0), superseding the
  4.0.x line VitalCV's scorecards use.
- **Borrow:** re-baseline the existing self-assessments (`docs/security/asvs-scorecard.md` at L1 and
  `ASVS-scorecard-2026-07.md` at L2, both **4.0.3-era**) against 5.0 rather than freezing them.
- **Do NOT claim:** ASVS "certification" or a passing L2 verification — the scorecards are explicit
  self-assessments, not third-party audits.
- **Premature:** a full 5.0 re-verification this wave. Record it as a security-backlog item; MF does
  not touch it.

### HHS "minimum necessary" guidance
Primary: `https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/minimum-necessary-requirement/`.

- **Principle:** disclose only the minimum PHI necessary for the purpose.
- **Borrow:** the **engineering principle** — collect/disclose the least for the purpose. This is
  literally the Minimum Friction Question/Disclosure Admission Gates.
- **Do NOT claim:** that VitalCV "is HIPAA compliant" or that every HIPAA rule applies (banned
  string; and legal applicability is a separate assessment). Use "minimum necessary" as a design
  principle, never as a compliance assertion.
- **Premature:** a HIPAA applicability determination. Out of scope for MF; a legal/technical call.

### HHS Healthcare Cybersecurity Performance Goals (HPH CPGs)
Primary: `https://hhscyber.hhs.gov/cybersecurity-performance-goals.html`.

- **Principle:** sector-specific engineering priorities — phishing-resistant MFA, encryption,
  vulnerability management, access revocation, asset inventory, logging, incident planning,
  configuration management.
- **Borrow:** the priority list as a control checklist. Several map directly to MF work:
  phishing-resistant MFA ↔ A4 passkeys; access revocation ↔ share revocation + revoked-binding
  states; logging ↔ `deriveHandlingDecision` on logs (SECURITY §4).
- **Do NOT claim:** CPG attainment or a healthcare-security certification.
- **Premature:** a formal CPG gap assessment. Cite as engineering priorities, not a compliance
  program.

---

## 2. Prior-art matrix — novelty falsification

Each research direction classified: **ALREADY COMMON** · **KNOWN BUT DIFFERENT DOMAIN** ·
**PARTIAL PRIOR ART** · **POSSIBLY DIFFERENTIATED COMBINATION** · **UNKNOWN**. The intent is to
*disprove* novelty. **No claim of patentability is made or implied.**

| Direction | Classification | Why |
|---|---|---|
| Progressive profiling | **ALREADY COMMON** | Marketing/growth and identity platforms have collected profile data incrementally for years. VitalCV's twist (start from public NPPES state, not zero) is a *seeding* choice, not a novel mechanism. |
| Adaptive questionnaires | **ALREADY COMMON** | Branching/skip-logic forms are a solved, commodity pattern (survey tools, tax software, clinical intake). |
| Value-of-information (VoI) planning | **KNOWN BUT DIFFERENT DOMAIN** | Decision-theoretic VoI is well established (diagnostics, active sensing). Applying it to "which question most reduces required clinician work" is a domain transfer, not a new method. |
| Active learning | **KNOWN BUT DIFFERENT DOMAIN** | Query-strategy/active-learning selects the most informative label to request; here the analogue is "most informative clinician confirmation." Same idea, professional-state domain. |
| Set cover | **ALREADY COMMON (as a formulation)** | "One answer that satisfies multiple requirements" is minimum set cover / hitting set — a textbook NP-hard problem with standard approximations. Using it here is a modeling choice. |
| Constraint satisfaction / planning | **ALREADY COMMON** | CSP and classical planning are mature. The PTC bounded optimizer is deterministic BFS over an action-state space — a standard formulation. |
| Query planning / optimization | **KNOWN BUT DIFFERENT DOMAIN** | "Which source calls to make, in what order, to answer a requirement" rhymes with database query planning; the transfer is conceptual. |
| Incremental / self-adjusting computation | **KNOWN BUT DIFFERENT DOMAIN** | Incremental recomputation on dependency change (anticipatory maintenance) is well studied (build systems, self-adjusting computation, incremental view maintenance). VitalCV applies it to evidence→requirement dependencies. |
| Personal data stores (PDS) | **PARTIAL PRIOR ART** | Solid/MyData-style user-controlled data stores exist. VitalCV's persistent, source-attributed *professional* state overlaps the PDS concept but adds institutional-policy compilation, which PDSs do not. |
| Selective disclosure | **ALREADY COMMON** | SD-JWT, BBS+, and VC selective disclosure are established. VitalCV's server-side minimum-evidence-set is a *different implementation* of the same privacy goal. |
| Credential wallets | **KNOWN BUT DIFFERENT DOMAIN / ALREADY COMMON** | Mobile credential wallets (mDL, EUDI) are mainstream. VitalCV explicitly does **not** build a holder wallet (FTO + strategy) — so this is prior art it is steering *around*, not toward. |
| Credentialing automation | **PARTIAL PRIOR ART** | CVOs, CAQH ProView, and credentialing SaaS automate parts of provider credentialing. VitalCV's reuse thesis overlaps CAQH's incumbency directly (per memory: CAQH is the real incumbent on reuse; CredentialingAlliance on the payer side). **Never claim "first."** |
| Risk-adaptive / step-up authentication | **ALREADY COMMON** | Adaptive/continuous authentication and step-up are standard in IAM. The A0–A5 ladder is a domain-specific instance, not a new authentication method. |
| Consent management | **ALREADY COMMON** | Consent receipts (Kantara), CMPs, and healthcare consent systems exist. VitalCV's purpose-bound receipt overlaps them; RFC 9396 is the fine-grained-authorization prior art. |
| Professional identity networks | **PARTIAL PRIOR ART** | LinkedIn (general), and clinician-specific networks/registries exist. VitalCV's differentiation is the *evidence/provenance + policy-compilation + reuse* stack, not the network idea. |

### The combination to *test, not claim*

Every individual primitive above is prior art. The only thing that is **POSSIBLY DIFFERENTIATED**
is the *combination*, and even that is stated as a hypothesis to falsify, not a claim:

> persistent, source-attributed professional evidence state **+** institutional-policy compilation
> (TrustSpec/compiler) **+** dependency-aware minimum-*work* planning **+** minimum-*clinician-
> interaction* planning **+** purpose-bound minimum *disclosure* **+** AI candidate quarantine **+**
> cross-employer reuse.

**Classification of the combination: POSSIBLY DIFFERENTIATED COMBINATION — UNKNOWN until a real
prior-art search.** Two incumbents already occupy adjacent ground and forbid any "first" claim:
CAQH (clinician-side reuse) and Axuall (US 12,079,891, holder-presentation credential exchange —
which VitalCV deliberately designs around per `docs/strategy/fto-axuall-12079891.md`). A proper
freedom-to-operate / prior-art search is **counsel's job before any pilot contract**, not this
wave's, and not a basis for a patentability or novelty claim.

---

## 3. What this document explicitly does not do

- Does **not** claim any standard is conformed to, certified against, or passed.
- Does **not** claim HIPAA, SOC2, ASVS, NIST, or VC conformance.
- Does **not** claim novelty or patentability of any primitive or the combination.
- Does **not** recommend implementing OID4VP/VCI, OAuth RAR, or a holder wallet in MF v0.
- Records standards as *borrow the principle / do not claim conformance / defer the machinery*.
