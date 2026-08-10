# VitalCV Conversation Memory — 2026-07-31

**Status:** Durable continuity record  
**Conversation window:** 2026-07-30 through 2026-07-31  
**Owner:** Chris Toler / VitalCV  
**Purpose:** Preserve the decisions, implemented work, open branches, production boundaries, and continuation sequence developed in the conversation so another session or collaborator can resume without reconstructing the history.

---

## 1. How to use this document

This is a continuity index, not a replacement for the canonical architecture documents or pull-request discussions.

Use it to answer five questions:

1. What product are we building?
2. What decisions are settled?
3. What code and documentation have already been created?
4. What is merged, open, stacked, blocked, or only proposed?
5. What should happen next?

Where a topic has a canonical specification, this document points to that file instead of duplicating every schema and test contract.

Repository state and production state are deliberately separate. A merge into `main` is not proof that `vitalcv.com` is serving that commit.

---

## 2. Product thesis

VitalCV is a clinician-first career-evidence system.

The durable product sentence is:

> **VitalCV discovers a clinician through NPI, helps the clinician assemble a living professional record, coordinates the people and sources required for a start, delivers only the authorized evidence, and keeps the record ready for the next opportunity.**

The product loop is:

```text
NPI discovery
  → living clinician record
  → clinician-approved packet
  → Apply with VitalCV
  → employer head-start review
  → Start Mission
  → remaining source and issuer work
  → employer records start-ready
  → clinician starts
  → evidence remains reusable
```

The main acquisition and product spine remains:

1. Start with your NPI
2. Source evidence
3. The packet you choose
4. Hospital review

Core copy:

- **A record that moves.**
- **Your career evidence, ready before your next job.**
- Employer framing: **Start from evidence, not intake.**
- Trust principle: **Trust has a memory.**

VitalCV is not a generic job board, document vault, telecom product, blockchain product, or replacement for employer credentialing, privileging, hiring, or start decisions.

---

## 3. Settled truth contract

These states must remain distinct:

```text
registry-discovered
clinician-claimed
account-controlled
identity-confirmed
presence-confirmed
source-reported
source-confirmed
issuer-signed
clinician-approved
employer-accepted-as-head-start
start-ready
started
```

Binding rules:

- NPI is a deterministic discovery key, not proof that an account belongs to the clinician.
- An NPPES license number is `reported to CMS`, not proof of active status, expiration, discipline, or good standing.
- AI output is a draft until the clinician explicitly approves it.
- Clinician approval does not convert a field into source confirmation.
- A successful delivery receipt does not prove employer review, acceptance, credentialing, privileging, or clearance.
- A readiness score cannot create `start_ready` or `started`.
- Network, authentication, access, or source failures never become a clear result.
- Name-only research or sanctions matches remain unresolved or review-required.
- Restricted evidence such as NPDB results remains eligible-entity, purpose, and transaction scoped.
- Existing packet hashes and replay behavior must remain byte-compatible unless a new field is explicitly bound into new canonical bytes.
- Consequential mutations must write durable audit evidence before returning success.
- Production claims require exact deployed-SHA proof, not merely a successful repository merge or HTTP 200.

---

## 4. Design and creative direction

### 4.1 Visual system

VitalCV uses:

- Cloud Dancer paper;
- warm ink;
- hairline rules;
- Fraunces for editorial display typography;
- Geist for interface typography;
- mono for source and receipt details;
- indigo for interaction and editorial emphasis;
- green only for genuinely source-confirmed states;
- amber for incomplete, unresolved, or attention-required states.

Evidence and employer-decision surfaces stay solid and readable. Glass is selective editorial chrome, not a material applied to facts.

### 4.2 Palantir-inspired glass eyebrow

Founder direction is to retain a restrained, genuinely translucent glass eyebrow:

- subtle transparent tint;
- backdrop blur;
- fine luminous edge;
- slight inner reflection;
- 10px plate radius, not a pill;
- no pointer-following behavior;
- reduced-transparency fallback.

The decorative cursor lens is retired. The native browser/OS cursor remains.

PR #981 restored the eyebrow after an earlier design interpretation removed it. PR #985 is the current refinement to make it genuinely transparent rather than a pale opaque badge.

### 4.3 Wallet hierarchy

The CV Wallet should communicate one mental model:

1. What public and connected sources report
2. What has been separately verified
3. What the clinician added or approved
4. What can be shared or used in an application

Do not revive separate competing products named profile, passport, trust dashboard, detailed credential view, and wallet. The wallet is the canonical clinician record surface.

### 4.4 Matuschak / Evergreen Evidence principle

The philosophical model is **Evergreen Evidence**:

- credentials and career facts are atomic evidence blocks;
- the record accretes over time instead of resetting for each job;
- a short human-readable handle acts as a title/API for a complex proof;
- opening the handle reveals source, observation time, validity, limitation, artifact, and receipt history;
- verification history is visible rather than compressed into a green check;
- the record compounds in value across applications and career moves.

Use Matuschak's data philosophy, not his horizontal sliding-pane interface.

Future evidence handle example:

```text
California medical license · Reported to CMS
State-board check · Access required
OIG exclusion check · Checked 2026-07-30 · No exact NPI match
```

Each handle expands into the underlying working record.

---

## 5. Strategic lessons incorporated

### OpenEvidence

Borrow the pattern:

> Trusted identity → recurring workflow → reusable evidence.

For VitalCV, communications belong inside the start workflow. The analogue is a **Credentialing Relay**, not a patient dialer:

- email and fax first;
- secure messaging, phone, voicemail later;
- every interaction tied to a requirement or verification request;
- AI drafts, classifies, summarizes, and schedules follow-up;
- humans approve consequential representations;
- every send, receipt, response, failure, and escalation leaves a durable event.

OpenEvidence's education direction also informed the **Maintenance Passport** concept: licenses, certifications, CE/CME, expiration, renewal requirements, and reusable maintenance evidence.

### World ID

Borrow the trust architecture, not necessarily World ID, biometrics, an Orb, blockchain, or zero-knowledge proofs.

Mapping:

| World-style role | VitalCV role |
|---|---|
| Holder | Clinician |
| Authenticator | Clinician-controlled VitalCV account |
| Credential | License, certification, education, employment or other evidence |
| Issuer | Board, school, employer, certifier, CVO, authority |
| Relying party | Employer, ATS, health system, payer |
| Action | Apply, share, authorize, renew, onboard |
| Signal | Opportunity, employer, packet hash, consent, application ID |
| Proof | Requirement satisfied with stated limitation |

Apply flows must preserve the original employer, opportunity, requested evidence, purpose, state, nonce, callback/return path, consent, packet version, and application identifiers across devices and account creation.

### Competitor/source benchmarks

The target is to combine:

- Doximity's CV breadth;
- Zocdoc's operational provider detail;
- hireEZ's discovery and enrichment breadth;
- NPINO's CMS dataset aggregation;
- CertifyOS's ROI clarity and product visualization;
- OpenEvidence's institutional trust framing;
- Carefam's frictionless implementation timeline;
- Truvera's simple issue/store/share and integration framing;
- Palantir's enterprise polish and impact studies;
- HiringCafe's utilitarian speed and density;
- Matuschak's accreting atomic knowledge model.

VitalCV's differentiation is field-level provenance and reusable employer handoff—not merely having more profile fields.

---

## 6. Start Mission architecture

Canonical specification:

`docs/product/start-mission-architecture.md`

Accepted through PR #976 and merged as `cc7561b6114dfe6048e10df8d992c78113f81fbf`.

The architecture avoids six new silos.

### Canonical objects

- `StartMission`: aggregate over application, packet, acceptance, activation, requirements, verification requests, communication events, and start events.
- `VerificationRequest`: existing model extended additively.
- `CommunicationEvent`: append-only correspondence ledger.
- `Credential`: provenance-preserving projection over existing source-backed, issuer-signed, clinician-provided, and approved-profile records.
- `ConsentGrant`: explicit recipient, purpose, action, scope, validity, revocation, authentication, packet/application/mission binding.
- `HandoffReceipt`: immutable proof of a delivery attempt or acknowledgement; never proof of acceptance.

### Apply Intent

Reuse `ParRequest` as the short-lived transport for:

- ATS buttons;
- employer portals;
- embeds;
- QR codes;
- secure links;
- desktop-to-mobile continuity.

### Hot Apply

Returning clinician:

```text
Apply Intent
  → exact employer/role restored
  → evidence preview
  → field-level disclosure
  → explicit authorization
  → ConsentGrant + Application + sealed packet + HandoffReceipt
  → employer receipt
  → head-start acceptance
  → Start Mission
```

### Cold Apply

New clinician:

```text
Apply Intent preserved
  → account creation
  → NPI record bootstrap
  → account binding
  → AI draft profile/CV
  → clinician review
  → honest gaps
  → same consent/packet/handoff transaction
  → same Start Mission path
```

Cold Apply must not create a lightweight incompatible application format.

---

## 7. Start Mission implementation state

### PR #977 — Phase 1

**Status:** Open, mergeable, not merged  
**Branch:** `feat/start-mission-phase1`  
**Head:** `451e611165368f76027d36bff69fa3cdc883a52b`

Implemented:

- additive `StartActivation` fields;
- additive `VerificationRequest` fields and lifecycle compatibility;
- `ConsentGrant`;
- append-only `CommunicationEvent`;
- immutable `HandoffReceipt`;
- nullable `ApplicationPacket.consentGrantId`;
- additive migration;
- `credentialProjectionService`;
- `startMissionReadService`;
- audit-first domain writers;
- legacy packet-hash compatibility and new consent-binding tests;
- authorization, provenance, replay, and migration tests.

The final tested head passed the repository gate matrix when reviewed in this conversation.

Do not merge or claim deployed until the production migration/deployment boundary is deliberately resolved.

### PR #978 — Phase 2

**Status:** Draft, open, stacked on #977  
**Branch:** `feat/apply-intent-phase2`  
**Head:** `54164c2e05716aec5259827f68fb09101091c08d`

Implemented:

- one-time `ParRequest` Apply Intents;
- unified `/apply/[requestUri]` dispatcher preserving legacy bundle UUIDs;
- public exact employer/role context;
- authenticated evidence preview;
- explicit section-level consent composer;
- atomic ConsentGrant → ApplicationPacket → HandoffReceipt transaction;
- packet/grant mutual binding;
- tenant-scoped employer receipt API and UI;
- allowlisted callback with separate delivery attempt receipt;
- package and public embed continuity;
- real PostgreSQL replay, idempotency, one-time-use, and cross-tenant tests.

Truth boundaries:

- an intent is not an application;
- a handoff is not employer acceptance;
- callback failure cannot rewrite a committed application;
- no caller-supplied organization header establishes authorization;
- legacy Apply routes remain compatible;
- the existing WebAuthn stub is not represented as passkey or biometric proof.

Do not merge #978 before #977 is merged and deployed/migrated.

---

## 8. Clinician wallet and extraction work

### PR #980

**Status:** Merged  
**Merge commit:** `996c54b26dd06f11b1e538c7937cc4105ef2b4b4`

Changes:

- retired the decorative cursor;
- moved `/holder` to the authenticated complete-record loader;
- converted the wallet to paper/ink surfaces;
- simplified wallet information architecture;
- surfaced every distinct NPPES taxonomy state/license pair;
- deduplicated repeated license rows;
- labeled them `Reported to CMS`;
- kept state-board verification as a separate state;
- exposed identity, specialties, locations, identifiers, endpoints, other names, filing dates, Medicare information when present, and explicit gaps under **All source fields**;
- removed duplicate trust/recognition panels;
- kept uploaded credentials, evidence addition, and sharing as distinct actions;
- added regression coverage preventing license rows from disappearing or being mislabeled as active/verified.

Important finding:

> VitalCV was already extracting state and license values from NPPES, but the wallet consumed a narrower trust-state path and stranded the richer data in a separate record loader.

That defect is fixed in repository code. It does not solve complete competitor-level enrichment by itself.

### Extraction direction

The requirement is:

> Preserve and expose every available connected-source field, then enrich beyond NPPES through additional governed sources.

NPI is the starting key, not the ceiling.

---

## 9. Clinician Enrichment Graph

Canonical specification:

`docs/product/clinician-enrichment-graph.md`

Accepted through PR #982 and merged as `ec1a04db215c81cf461e2da00222feb5627945f0`.

Execution epic:

Issue #983 — **Implement the Clinician Enrichment Graph**

### Main architecture decision

Do not create a parallel graph database or enrichment platform.

Reuse the existing append-only identity pipeline:

```text
NPI / clinician intent
  → EnrichmentRun
  → SourceRun[]
  → SourceRecord + VerificationArtifact
  → NormalizedClaim + VerificationReceipt
  → entity resolution / unresolved match review
  → enrichment edges
  → profile projection snapshot
  → CV Wallet / packet / employer review
```

`identityIngestionPipeline.ts` remains the sole canonical external-source ingestion spine.

### Required new claim vocabulary

The current vocabulary is too narrow for a complete career record. The accepted architecture includes explicit fields for:

- professional name, headline, summary, photo, pronouns, languages, public contact points;
- `LICENSE_REPORTED`, authority-confirmed license, compact privilege, discipline;
- board and professional certifications and maintenance;
- education, degrees, medical school, internship, residency, fellowship and CE/CME;
- employment, academic appointments, groups, facilities, hospitals, departments, leadership and privileges;
- telehealth, clinical interests, skills, visit reasons, procedures, volume, populations, insurance and availability;
- publications, presentations, trials, grants, topics, awards, memberships, committees and authored content;
- restricted credentialing fields such as malpractice, adverse actions, references, work gaps, background and health requirements.

### Source stages

1. NPPES identity bootstrap
2. Exact-NPI CMS enrichment
3. Professional authorities
4. Education, training and institutional sources
5. Research identity
6. Clinician portfolio and documents
7. Restricted employer/issuer workflows

### Highest-value implementation slice

- E0: runtime truth and adapter consolidation
- E1: CMS breadth
- E2: one canonical enriched wallet projection

E1 should prioritize:

- CMS Doctors & Clinicians National Downloadable File;
- complete Doctors & Clinicians parsing, not first-row-only;
- CMS facility affiliations;
- CMS utilization/procedure context;
- Order and Referring;
- Medicare Opt-Out;
- all PAC IDs, enrollment IDs, groups, locations, medical school and graduation year.

---

## 10. E0 implementation currently in progress

**Branch:** `feat/e0-source-runtime-truth`  
**Base at creation:** `main` after PR #982  
**Latest recorded branch commit:** `022f0d774872279de3baa26427dceaabd6a61558`  
**PR:** Not opened yet at the time of this memory record  
**Validation:** Not yet completed; treat as work in progress.

### Implemented commits

#### `93b86f0702cbc61f6892400805ec607428ffc79f`

`feat(identity): designate canonical source adapters`

Adds:

`apps/api/backend/src/services/identity/canonicalSourceAdapters.ts`

It designates the only permitted production entry point for each currently implemented source as:

```text
identityIngestionPipeline.handlers.<SOURCE_ID>
```

It also lists required environment variables and deprecated alternate module fragments for NPPES, OIG, PECOS, Open Payments, SAM.gov, Doctors & Clinicians, Nursys, State Board, OpenAlex, ClinicalTrials and PubMed.

#### `9af9d1d774193708cc089bfea5c1de5a9c864a9e`

`feat(identity): add source runtime truth service`

Adds:

`apps/api/backend/src/services/identity/sourceRuntimeState.ts`

Source runtime states:

```text
live
gated
access_required
failed
stale
not_checked
unavailable
partial
```

A source is live only when it has:

- a canonical implemented adapter;
- enabled runtime configuration;
- required credentials/access;
- catalog live availability;
- a successful persisted run;
- a persisted artifact;
- an observation inside the source freshness window.

The service explicitly prevents runtime health from becoming a clinical or credentialing verdict. `clear` may only be shown when the runtime is live and an explicit persisted outcome is clear.

#### `d1929ab84e7aae599382e48891062d2e4bc0aff7`

`feat(api): expose source runtime truth endpoints`

Adds:

- `GET /api/system/source-runtime`
- `GET /api/system/source-runtime/:sourceId`

The routes are no-store and fail with a 503 contract that says no source should be inferred live or clear when runtime state cannot be computed.

#### `022f0d774872279de3baa26427dceaabd6a61558`

`feat(api): register source runtime truth routes`

Registers the endpoints through the existing system-health route module.

### E0 work still required

- Add `LICENSE_REPORTED` while preserving legacy claim IDs and replay.
- Expand the accepted claim vocabulary without rewriting historical claims.
- Decide how NPPES parsing emits reported-license evidence without promoting it to authority-confirmed `LICENSE`.
- Add a CI/import-boundary gate that blocks routes and UI from directly importing deprecated alternate adapters.
- Add registry/pipeline alignment tests.
- Add contract tests for `gated`, `access_required`, `failed`, `stale`, `unavailable`, `not_checked`, `not_listed`, and explicit `clear` behavior.
- Add route tests for no-store, 404 unknown source, and 503 fail-closed behavior.
- Run Prisma generation, backend TypeScript compilation, full PostgreSQL tests, deploy preflight, and all repository governance gates.
- Open the E0 pull request and link it to issue #983.

---

## 11. Deployment and production boundary

### PR #975

Merged exact-SHA Railway convergence workflow.

It pins the production Railway project, service, environment, and domain; requests deployment of the exact GitHub SHA; waits for `/api/version`; runs smoke and browser audits; captures artifacts; and writes a durable convergence status.

### PR #979

Merged support for either:

- `RAILWAY_API_TOKEN` using `Authorization: Bearer`, or
- `RAILWAY_TOKEN` using `Project-Access-Token`.

The subsequent workflow run proved both secrets were absent.

### Operator action still required

Add one Railway token as a GitHub Actions repository secret. Never paste the token into chat.

Then rerun the exact-SHA convergence workflow and require:

1. Railway project/service/environment/domain audit succeeds.
2. Exact `main` SHA is deployed.
3. `https://vitalcv.com/api/version` returns that exact SHA.
4. Production smoke passes.
5. Browser audit and screenshots are inspected.
6. Only then describe repository changes as live.

### Last verified production state in this conversation

The last explicit public check in this conversation returned the old SHA:

`d446b082103dd808038ea7be1e909dd275ace120`

This is a historical checkpoint, not a guarantee of current state. Recheck before every release claim.

### Consequence for open work

- PR #977 remains unmerged to avoid an unverifiable production migration.
- PR #978 remains stacked and draft.
- Merged design and wallet work is repository-canonical but must not be described as live without exact-SHA proof.

---

## 12. Pull-request and work ledger

| Work | Status | Durable reference |
|---|---|---|
| Four-step NPI-first homepage | Merged | PR #973 / `50137295...` |
| Exact-SHA Railway convergence workflow | Merged | PR #975 / `95327137...` |
| Start Mission architecture | Merged | PR #976 / `cc7561b6...` |
| Start Mission Phase 1 | Open, mergeable | PR #977 / `451e6111...` |
| Apply Intent Phase 2 | Draft, stacked on #977 | PR #978 / `54164c2e...` |
| Railway project-token fallback | Merged | PR #979 / `bacbcb24...` |
| CV Wallet clarity and NPPES licenses | Merged | PR #980 / `996c54b2...` |
| Restore glass eyebrow, retain native cursor | Merged | PR #981 / `9a704407...` |
| Clinician Enrichment Graph architecture | Merged | PR #982 / `ec1a04db...` |
| Enrichment implementation epic | Open | Issue #983 |
| E0 source runtime truth | In-progress branch, no PR yet | `feat/e0-source-runtime-truth` / `022f0d77...` |
| Genuinely transparent Palantir eyebrow | Open, mergeable | PR #985 / `5a4101f4...` |

PR #972 was closed and superseded by #980.

---

## 13. Marketing and employer-conversion direction

Do not invent ROI or customer proof.

Near-term employer surfaces should add:

- a clear pilot timeline: Setup → Invite → Receive Evidence;
- integration framing: secure link, webhook, API, ATS embed; no rip-and-replace;
- a visual handoff from clinician-approved evidence to employer review;
- source authority presentation with honest availability states;
- measured pilot outcomes once real data exists;
- a future impact study using actual placement/start data.

Until pilot data exists, label metrics as hypotheses, targets, or industry context—not VitalCV results.

The first pilot should measure:

- packet creation and delivery;
- missing-evidence rate;
- time from accepted packet to completed remaining requirements;
- manual intake avoided;
- days at risk before intended start;
- employer acceptance of the packet as a head start;
- clinician reuse of existing evidence.

---

## 14. Product components now aligned

The unified platform components are:

1. **Clinician Identity Graph** — discover and bind the clinician.
2. **Evidence Wallet** — accreting source, issuer and clinician-approved evidence.
3. **Apply with VitalCV** — transaction-scoped disclosure and handoff.
4. **Start Mission** — operational root after employer head-start acceptance.
5. **Credentialing Relay** — source/issuer communication and follow-up.
6. **Maintenance Passport** — renewals, licenses, certifications and CE/CME.
7. **Proof and Handoff Protocol** — consent, packet hashes, receipts and acknowledgement.
8. **Vital Agent** — plans and coordinates work while leaving human approval and receipts.
9. **MATCHA** — future opportunity discovery using the clinician's evidence and preferences.

These must feel like one continuous system rather than separate mini-products.

---

## 15. Explicit non-goals and rejected patterns

Do not:

- build a generic patient dialer;
- become a telecom carrier before proving Credentialing Relay;
- call NPI lookup identity verification;
- collapse source-reported, source-confirmed, clinician-approved and employer-accepted states;
- force World ID, an Orb, biometrics, blockchain or ZK proofs;
- put PHI or credentials on a public blockchain;
- promise CE/MOC credit without accredited partnerships;
- claim VitalCV completed credentialing or made the employer's decision;
- create a generic credential table that destroys provenance;
- create a second enrichment database beside the append-only identity pipeline;
- import legacy source adapters directly from routes or UI;
- call a catalog entry or stub a live integration;
- present a source failure, missing credential, timeout or unavailable authority as clear;
- infer current employment from a CMS facility affiliation;
- infer active hospital privileges from a public directory;
- auto-link a research author from name alone;
- default a ClinicalTrials name match to principal investigator;
- use theoretical ROI as a customer result;
- reintroduce dark evidence surfaces, the pointer-following cursor, or glass on evidence rows.

---

## 16. Next execution sequence

### Immediate

1. Finish E0 on `feat/e0-source-runtime-truth`.
2. Open an E0 PR linked to issue #983.
3. Run the complete backend, migration, web, browser, accessibility, source-liveness, claims, route, header-trust, workflow and dependency gates.
4. Review and merge PR #985 only after its full visual and accessibility matrix is green.
5. Resolve the Railway secret boundary.

### Deployment sequence

1. Add `RAILWAY_API_TOKEN` or `RAILWAY_TOKEN` in GitHub Actions secrets.
2. Rerun exact-SHA convergence for current `main`.
3. Verify public `/api/version` and release artifacts.
4. Merge and deploy #977 deliberately; verify migration and SHA.
5. Retarget/rebase #978 after #977 lands; rerun all gates; deploy Phase 2.

### Enrichment sequence

1. E0 — source truth and canonical adapter boundaries.
2. E1 — CMS NDF, complete Doctors & Clinicians rows, facility affiliations, utilization, Order/Referring, Opt-Out.
3. E2 — enrichment orchestration and one deterministic profile projection used by the wallet.
4. E3 — contracted professional authorities.
5. E4 — education, employment and research identity.
6. E5 — operational marketplace detail.
7. E6 — restricted credentialing workflows.

---

## 17. Suggested continuation prompts

### Resume E0

> Continue `feat/e0-source-runtime-truth` from commit `022f0d774872279de3baa26427dceaabd6a61558`. Add `LICENSE_REPORTED` without changing legacy claim IDs, expand the claim vocabulary additively, implement the deprecated-adapter import guard, and add contract tests proving gated, access-required, unavailable, failed, stale, not-checked and not-listed states can never be presented as live or clear. Run the complete repository gate matrix and open the E0 PR linked to issue #983.

### Resolve production

> The Railway token has been added. Rerun the exact-SHA convergence workflow for current `main`, inspect the Railway audit and deployment artifacts, require `/api/version` to equal the exact main SHA, and visually audit the homepage, transparent glass eyebrow, native cursor and CV Wallet before declaring production converged.

### Resume Start Mission

> After production convergence, review PR #977 against current main, rebase without losing the Railway workflow repair, rerun migration and full CI, merge deliberately, verify the production migration and exact deployed SHA, then retarget PR #978 onto main and repeat the full gate matrix.

### Begin CMS breadth

> Implement E1 of issue #983 using the canonical identity ingestion pipeline: complete all Doctors & Clinicians rows, add CMS NDF, facility affiliations, utilization/procedure context, Order and Referring, and Medicare Opt-Out. Preserve all source rows and identifiers, emit field-level claims and receipts, add multi-group/multi-facility fixtures, and expose the resulting fields through the deterministic enriched record projection without calling contextual data verified employment or privileges.

---

## 18. Canonical files and references

- `docs/product/start-mission-architecture.md`
- `docs/product/clinician-enrichment-graph.md`
- `docs/design/VITALCV_CREATIVE_DIRECTION.md`
- `apps/api/backend/src/services/identity/identityIngestionPipeline.ts`
- `apps/api/backend/src/services/identity/sourceCatalog.ts`
- `apps/api/backend/src/services/identity/evidenceModel.ts`
- `packages/career-graph/src/types.ts`
- Issue #983
- PRs #973, #975, #976, #977, #978, #979, #980, #981, #982 and #985

Work-in-progress E0 files on `feat/e0-source-runtime-truth`:

- `apps/api/backend/src/services/identity/canonicalSourceAdapters.ts`
- `apps/api/backend/src/services/identity/sourceRuntimeState.ts`
- `apps/api/backend/src/routes/sourceRuntime.ts`
- `apps/api/backend/src/routes/systemHealth.ts`

---

## 19. Continuity contract

Future sessions should begin by checking:

1. current `main` SHA;
2. exact production `/api/version`;
3. PR states for #977, #978 and #985;
4. issue #983;
5. branch `feat/e0-source-runtime-truth`;
6. whether a Railway token has been added;
7. whether this document has a newer successor.

When repository state conflicts with this document, the repository and fresh production evidence win. Update this file or create a dated successor rather than silently carrying stale assumptions forward.
