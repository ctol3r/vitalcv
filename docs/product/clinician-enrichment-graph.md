# Clinician Enrichment Graph

**Status:** Proposed build contract  
**Date:** 2026-07-31  
**Owner:** VitalCV Product + Identity Platform  
**Scope:** NPI-triggered clinician record enrichment, identity resolution, field-level provenance, profile projection, wallet presentation, and source-coverage reporting

---

## 1. Decision

VitalCV will implement one **Clinician Enrichment Graph** that begins with an NPI and produces a substantially richer clinician record without weakening the product's truth contract.

The graph is not a new database beside the existing identity system. It is a coordinated use of the repository's existing append-only source pipeline:

```text
NPI / clinician intent
        ↓
EnrichmentRun
        ↓
SourceRun[]
        ↓
SourceRecord + VerificationArtifact
        ↓
NormalizedClaim + VerificationReceipt
        ↓
Entity resolution / MatchCandidate review
        ↓
ClinicianEnrichmentEdge[]
        ↓
ProfileProjectionSnapshot
        ↓
CV Wallet / Apply packet / employer review
```

The existing `identityIngestionPipeline.ts` remains the only canonical external-source ingestion spine. Existing source-specific adapters that do not feed that pipeline are candidates for consolidation, not parallel production paths.

The graph produces four distinct kinds of truth:

1. **Evidence claims** — source observations such as license status, Medicare enrollment, or education reported by CMS.
2. **Relationship edges** — clinician-to-group, facility, employer, school, publication, trial, or professional-organization links.
3. **Profile projections** — user-facing fields selected from claims and edges with explicit provenance and conflict state.
4. **Reusable credentials** — issuer-signed or source-backed records that can be included in a consented packet.

These must never collapse into one generic “verified profile.”

---

## 2. Product objective

A clinician should be able to enter or claim an NPI and receive a record that is useful immediately and becomes progressively more complete:

```text
NPI
  → identity and specialties
  → all CMS-published license numbers and locations
  → Medicare enrollment, PAC IDs, groups and facilities
  → state-board / Nursys license status
  → board and professional certifications
  → education and postgraduate training
  → current and historical employment / appointments
  → publications, research, grants and trials
  → skills, clinical interests, languages and procedures
  → clinician-confirmed contact, preferences and CV history
  → employer-authorized credentialing evidence
```

The target is not “scrape every website.” The target is:

> **Discover broadly, resolve identity conservatively, preserve every source observation, and let the clinician and authorized issuers turn discovered facts into a reusable career record.**

---

## 3. Competitive benchmark

The competitors demonstrate four different forms of data breadth. VitalCV should combine the useful parts without copying their trust assumptions.

| Capability | Doximity | Zocdoc | hireEZ | NPINO | VitalCV target |
|---|---|---|---|---|---|
| NPI-first stub/profile | Yes | NPI-addressable provider objects | NPI/open-web sourcing inputs | Yes | Yes, canonical bootstrap |
| Name, credential, specialty, location | Yes | Yes | Yes | Yes | Source-backed |
| Photo, title, summary | Clinician maintained | Marketplace profile | Open-web / ATS enrichment | Limited | Clinician approved |
| Education | Profile/CV field | Vetted profile field | Search/enrichment | CMS medical school + graduation | CMS + ORCID/CV + issuer confirmation |
| Residency/fellowship | Profile/CV field | Profile vetting context | Search/enrichment | Usually absent | FCVS/program/clinician evidence |
| State licenses | Profile field | Active/good-standing vetting | Search filters | NPPES-reported number | Reported number + separate authority status |
| Board certification | Profile field | Confirmed when listed | Search filters | Limited | ABMS/AOA/profession authority + CMS flag |
| Group affiliations | Profile/employment | Affiliated locations | Current-employer enrichment | CMS PAC/group rows | CMS NDF + D&C exact-NPI edges |
| Facility/hospital affiliations | Profile/admitting | Affiliated locations | Open-web enrichment | CMS facility affiliations | CMS facility file + institutional attestation |
| Insurance accepted | Public-profile field | Core marketplace dimension | Recruiting context only | Medicare assignment | Partner/clinician/practice data, labeled |
| Visit reasons / procedures | Clinical interests | Core marketplace dimension | Specialty/skill filters | Limited | CMS utilization + clinician/practice confirmation |
| Languages | Profile field | API/profile field | Open-web profile | Limited | Clinician/organization confirmed |
| Publications / presentations | Yes | Limited | Open-web enrichment | No | PubMed/OpenAlex/ORCID with identity resolution |
| Clinical trials | Yes | Limited | Open-web enrichment | No | ClinicalTrials.gov with actual role parsing |
| Awards / memberships / committees | Yes | Limited | Open-web enrichment | No | Clinician-approved, issuer corroborated where possible |
| Contact information | Network/member controlled | Practice/location data | Core recruiting enrichment | Public business contacts | Consent-sensitive public/professional contact layer |
| Exclusion / sanctions | Not primary product | Federal exclusion vetting | Search context | No | OIG/LEIE + authorized sources |
| Credentialing handoff | No | Marketplace vetting | Recruiting workflow | No | Core product: consent + evidence packet + Start Mission |

### 3.1 What the benchmark actually means

- **Doximity** demonstrates CV breadth and clinician control. Much of the richer profile is maintained or approved by the clinician; the platform does not imply that every profile field is primary-source verified.
- **Zocdoc** demonstrates operational provider detail: languages, specialties, visit reasons, locations, insurance and booking context, plus a marketplace vetting process.
- **hireEZ** demonstrates discovery breadth across the open web and recruiting databases, especially licenses, certifications, specialties, employment, contactability and candidate rediscovery.
- **NPINO** demonstrates how much richer a public NPI page becomes when NPPES is joined to CMS Doctors & Clinicians / PECOS group and facility datasets.

VitalCV's advantage is not merely having more fields. It is making every field answer:

```text
Who said this?
When was it observed?
How was this clinician matched to the source record?
Is it source-reported, corroborated, authority-confirmed, clinician-approved or inferred?
Can it be used in an employer decision?
What limitation must travel with it?
```

---

## 4. Current repository audit

### 4.1 Existing canonical components to reuse

| Existing component | Role in the enrichment graph | Decision |
|---|---|---|
| `sourceCatalog.ts` | Source registry, tier, cadence, claim capabilities, environment flag | Keep; make runtime-state reporting stricter |
| `identityIngestionPipeline.ts` | FETCH → STORE → PARSE → NORMALIZE → DELTA → INDEX | Keep as sole ingest spine |
| `VerificationArtifact` | Append-only raw capture and derived snapshot container | Reuse |
| `SourceRun`, `SourceRecord`, jobs | Operational lineage and retries | Reuse |
| `ClaimRecord` / `NormalizedClaim` | Field-level source claims | Reuse and expand vocabulary |
| `VerificationReceiptRecord` | Auditable explanation and source result | Reuse |
| `materializeClaimsToVcvCredentials` | Converts eligible claims to reusable evidence | Reuse |
| `core/graph/enrichment.ts` | Non-decision-grade relationship-edge contract | Extend, do not replace |
| `clinicianEnrichmentGraph.ts` | Claim-to-edge projection | Extend and move behind one orchestration service |
| `packages/career-graph` | Product lifecycle graph projected from canonical records | Keep separate from discovery/enrichment edges |
| `apps/web/lib/clinician-record` | Provenance-aware record shown by web surfaces | Evolve into the canonical enriched projection |

### 4.2 Source truth states

Documentation, catalog presence, adapter presence and live production coverage are not equivalent. Every source must expose all of these states:

```ts
export type SourceRuntimeState = {
  sourceId: string;
  registered: boolean;       // sourceCatalog entry exists
  adapterImplemented: boolean;
  enabled: boolean;          // env / tenant configuration
  credentialsPresent: boolean | null;
  lastRunStatus: 'never' | 'success' | 'partial' | 'failed' | 'gated';
  lastSuccessfulAt: string | null;
  lastArtifactId: string | null;
  freshnessStatus: 'current' | 'stale' | 'unknown';
  decisionGradeEligible: boolean;
  limitation: string | null;
};
```

A source may be called **live** only when:

```text
registered
AND adapterImplemented
AND enabled
AND required credentials are present
AND a successful production SourceRun exists
AND its latest artifact is inside the freshness window
```

Static documentation must never be sufficient to claim live coverage.

### 4.3 Current source inventory

| Source | Current repository state | Fields/capability | Required correction |
|---|---|---|---|
| NPPES API | Implemented and core | identity, names, taxonomies, reported state/license numbers, addresses, other names, endpoints, identifiers | Make one canonical adapter; model reported license separately from authority-confirmed license |
| NPPES bulk V2 | Cataloged | universe-scale identity and reference files | Wire bulk ingestion and weekly increments |
| PECOS Public Provider Enrollment | Implemented | enrollment and order/referral posture; limited group context | Verify production flag/run; preserve “not listed” versus “not checked” |
| CMS Doctors & Clinicians API | Implemented, parser incomplete | enrollment, assignment, medical school, graduation year, specialties, PAC/group data | Parse all rows and all published fields; do not take only first row |
| CMS National Downloadable File | Cataloged, not in implemented-source list | medical school, graduation year, individual PAC/enrollment IDs, group PAC, addresses, specialties, telehealth/assignment fields | Highest-priority new exact-NPI source |
| CMS Facility Affiliation file | Not canonicalized | facility name/type and CCN linked to NPI | Add exact-NPI source and facility edges |
| CMS Utilization / procedure volume | Missing | procedure-of-interest volume | Add non-decision-grade practice-experience claims |
| CMS Quality/QPP public data | Missing from profile projection | public performance/context | Add only where clinically and statistically appropriate; never treat as credential |
| OIG LEIE | Implemented bulk/cache path | active federal exclusions | Keep; exact identifier match may gate, fuzzy matches require review |
| Open Payments | Implemented | general/research payment and ownership context | Keep non-decision-grade; distinguish payment categories |
| CMS Opt-Out | Cataloged, not implemented | affirmative Medicare opt-out | Wire and reconcile against enrollment claims |
| CMS Order and Referring | Cataloged, not implemented | order/referral eligibility | Wire as separate enrollment posture |
| SAM.gov | Adapter path exists but gated | federal government exclusions | Never treat unavailable check as clear; name hits require review |
| OFAC | Cataloged/partial | sanctions | Keep potential matches non-decision-grade until strong identity proof |
| State boards | Multiple adapters; canonical pipeline currently only selects a CA physician launch lane | license status, dates, discipline | Establish authority contract per jurisdiction; query every reported/claimed jurisdiction, not only practice state |
| FSMB PDC / DocInfo | Adapter concepts and credential-key path; not general live coverage | national physician/PA licensure, education, board actions, certifications depending product | Contract/licensed integration; consolidate duplicate adapters |
| Nursys | Adapter and parser exist; gated without credentials | nursing licenses, compact privileges, discipline, NCSBN ID | Institutional enrollment / e-Notify path; never call the stub live |
| ABMS / CertiFacts | Claim model supports board certification; no production source | physician specialty certification and continuing certification | Partnership / PSV product integration |
| AOA board certification | Missing canonical source | osteopathic board certifications | Add authority source |
| NCCPA | Missing canonical source | PA certification | Add authority source |
| Nursing/APRN certifiers | Missing canonical sources | ANCC, AANPCB, PNCB, NBCRNA and others | Profession-aware certification registry |
| DEA | Stub/PSV concepts; no public general lookup source | controlled-substance registration and actions | Clinician-authorized document/issuer workflow or licensed authority integration; do not scrape or infer |
| NPDB | Partial concepts/routes; restricted access | malpractice payments and adverse actions | Employer/eligible-entity authorized-agent workflow only; responses are transaction-scoped and confidential |
| CAQH | Not a public-source adapter | clinician-maintained credentialing application data | OAuth/authorized organization or clinician export; never scrape |
| OpenAlex | Implemented name search | author metrics and institutional context | Return candidate set; no automatic top-result identity assignment |
| PubMed | Implemented name/initial search | publications and author affiliations | Add affiliation, ORCID/AUID, specialty and date corroboration |
| ClinicalTrials.gov | Implemented name search | study and investigator/site roles | Parse actual source role; never default a name match to principal investigator |
| ORCID | Separate orchestrator and catalog-reserved state | authenticated researcher ID, education, employment, works, funding | Merge into canonical ingestion and make authenticated link the preferred research bridge |
| NIH RePORTER | Catalog-reserved | grants, PI roles, institutions | Add after ORCID/identity resolver |
| Hospital directories | Cataloged, not live | title, department, faculty/employment | Domain-specific Silver source, with terms/robots governance and change monitoring |
| Resume/CV upload | Product concepts exist, not canonical enrichment source | education, training, employment, awards, memberships, skills | Add clinician-provided parser with approval state, never source-backed by parsing alone |
| Public professional web/contact enrichment | No canonical governed source | employer, title, public email/phone, profiles | BRONZE, consent-sensitive, licensed/provider-specific connectors only |

### 4.4 Fragmentation to remove

The repository contains several generations of NPPES, PECOS, OIG, Nursys, FSMB/state-board and research adapters. Phase 0 must designate one production authority for each source:

```text
Canonical entry point:
  identityIngestionPipeline.handlers[sourceId]

Allowed supporting modules:
  source-specific fetcher
  source-specific parser
  source governance contract
  fixture/contract tests

Disallowed production pattern:
  route or UI imports an alternate adapter directly
  alternate adapter writes a different record shape
  source result bypasses VerificationArtifact / ClaimRecord / receipt persistence
```

Legacy adapters may remain temporarily for migration tests, but must be annotated `@deprecated` and cannot be registered as production source handlers.

---

## 5. Missing field vocabulary

The existing `ClaimType` union is oriented toward trust checks. It cannot cleanly represent the complete professional record competitors show. The following semantic types are required.

### 5.1 Identity and presentation

```ts
'NPI_IDENTITY'
'PERSONAL_IDENTITY'
'PROFESSIONAL_NAME'
'PROFILE_PHOTO'
'PROFESSIONAL_HEADLINE'
'PROFESSIONAL_SUMMARY'
'PRONOUNS'
'LANGUAGE'
'PUBLIC_CONTACT_POINT'
'PROFESSIONAL_PROFILE_URL'
```

`PROFILE_PHOTO`, `PROFESSIONAL_HEADLINE`, `PROFESSIONAL_SUMMARY`, `PRONOUNS` and personal contact fields are normally clinician-approved, not authority-confirmed.

### 5.2 Licensure and certification

```ts
'LICENSE_REPORTED'          // number/state reported in NPPES or another non-authority source
'LICENSE'                   // authority-confirmed status
'LICENSE_PRIVILEGE'         // compact/multistate practice privilege
'LICENSE_DISCIPLINE'
'CONTROLLED_SUBSTANCE_REGISTRATION'
'BOARD_CERTIFICATION'
'PROFESSIONAL_CERTIFICATION'
'CERTIFICATION_MAINTENANCE'
```

The NPPES taxonomy license number must no longer masquerade as an authority-verified `LICENSE`. It is `LICENSE_REPORTED`, with a limitation that NPI issuance does not validate licensure.

### 5.3 Education and training

```ts
'EDUCATION'
'DEGREE'
'MEDICAL_SCHOOL'
'POSTGRADUATE_TRAINING'
'TRAINING_COMPLETION'
'RESIDENCY'
'FELLOWSHIP'
'INTERNSHIP'
'CME_CE_CREDIT'
```

Do not overload `INSTITUTION_AFFILIATION` to represent medical school, residency, current employment and hospital privileges. Each relationship has different meaning and verification rules.

### 5.4 Employment and affiliations

```ts
'EMPLOYMENT'
'ACADEMIC_APPOINTMENT'
'GROUP_AFFILIATION'
'FACILITY_AFFILIATION'
'HOSPITAL_AFFILIATION'
'HOSPITAL_PRIVILEGE'
'DEPARTMENT_AFFILIATION'
'LEADERSHIP_ROLE'
```

A CMS facility affiliation is not proof of current employment or active clinical privileges. Each field carries its own relationship type and limitation.

### 5.5 Practice capabilities and marketplace detail

```ts
'PRACTICE_LOCATION'
'MAILING_ADDRESS'
'ENDPOINT'
'TELEHEALTH_CAPABILITY'
'CLINICAL_INTEREST'
'SKILL'
'VISIT_REASON'
'PROCEDURE_CAPABILITY'
'PROCEDURE_VOLUME'
'PATIENT_POPULATION'
'INSURANCE_ACCEPTANCE'
'AVAILABILITY'
```

Insurance acceptance and appointment availability are rapidly changing operational data. They must be scoped to a provider-location, payer/plan and observation time.

### 5.6 Research and professional reputation

```ts
'PUBLICATION'
'PRESENTATION'
'CITATION_METRIC'
'CLINICAL_TRIAL'
'RESEARCH_GRANT'
'RESEARCH_TOPIC'
'AWARD'
'PROFESSIONAL_MEMBERSHIP'
'COMMITTEE_ROLE'
'AUTHORED_CONTENT'
'MEDIA_MENTION'
```

Awards, memberships, authored content and media mentions are profile enrichment. They are not decision-grade unless a relevant issuer directly confirms them.

### 5.7 Credentialing-only records

```ts
'MALPRACTICE_COVERAGE'
'MALPRACTICE_HISTORY'
'ADVERSE_ACTION'
'CLINICAL_PRIVILEGE_HISTORY'
'WORK_HISTORY_GAP'
'PROFESSIONAL_REFERENCE'
'PEER_REFERENCE'
'BACKGROUND_CHECK'
'HEALTH_REQUIREMENT'
```

These must not be treated as public enrichment. They enter through clinician uploads, employer/CVO workflows, issuer requests, NPDB-authorized queries or attestations.

---

## 6. Canonical field contract

Every user-facing value must be rendered from a `ProfileFieldProjection`, not directly from a source payload.

```ts
export type FieldConfirmation =
  | 'authority_confirmed'
  | 'source_confirmed'
  | 'corroborated'
  | 'source_reported'
  | 'clinician_confirmed'
  | 'organization_confirmed'
  | 'inferred'
  | 'unresolved';

export type FieldDecisionUse =
  | 'decision_grade'
  | 'head_start_only'
  | 'context_only'
  | 'not_permitted';

export interface ProfileFieldProjection<T = unknown> {
  fieldId: string;
  subjectNpi: string;
  fieldKey: string;
  value: T;

  confirmation: FieldConfirmation;
  decisionUse: FieldDecisionUse;

  primaryClaimId: string | null;
  supportingClaimIds: string[];
  conflictingClaimIds: string[];
  enrichmentEdgeIds: string[];

  sourceIds: string[];
  sourceUrls: string[];
  observedAt: string | null;
  retrievedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  freshnessStatus: 'current' | 'stale' | 'unknown';

  linkageMethod: string;
  matchConfidence: number;
  reviewRequired: boolean;
  limitation: string | null;

  clinicianDisposition:
    | 'not_reviewed'
    | 'approved'
    | 'edited'
    | 'rejected'
    | 'hidden';
  visibility: 'private' | 'wallet' | 'public' | 'employer_packet';

  projectionVersion: string;
}
```

### 6.1 Projection precedence

A higher-trust source does not automatically overwrite all other sources. The projection service evaluates:

1. identity match quality;
2. source authority for the particular field;
3. observation time and validity period;
4. contradictions;
5. clinician or organization confirmation;
6. field-specific precedence policy.

Example:

```text
NPPES reports CA license A12345
State board reports CA license A12345 ACTIVE through 2027
Clinician CV reports CA license A12345

Projection:
  value: CA / A12345
  confirmation: authority_confirmed
  supporting claims: NPPES + state board + clinician CV
  decisionUse: decision_grade (subject to freshness policy)
```

Conflict example:

```text
NPPES reports CA license A12345
State board returns A12354 for same name

Projection:
  confirmation: unresolved
  reviewRequired: true
  no employer-facing “active license” statement
```

### 6.2 Negative evidence

Absence from a source must be modeled explicitly:

```ts
export type CoverageState =
  | 'found'
  | 'not_listed'
  | 'not_applicable'
  | 'not_checked'
  | 'source_unavailable'
  | 'access_required'
  | 'unresolved_match'
  | 'stale';
```

`not_listed` is not automatically a negative finding. For example, absence from a Medicare dataset may mean the clinician does not participate in Medicare.

---

## 7. Relationship graph contract

Scalar/profile facts live in `ProfileFieldProjection`. Relationships live in `ClinicianEnrichmentEdge`.

### 7.1 Extend graph node types

Add:

```ts
'education_institution'
'training_program'
'employer'
'department'
'certification_issuer'
'licensing_authority'
'professional_organization'
'insurance_plan'
'procedure'
'award_issuer'
'public_profile'
```

### 7.2 Extend edge types

Add:

```ts
'ATTENDED_INSTITUTION'
'EARNED_DEGREE_FROM'
'COMPLETED_RESIDENCY_AT'
'COMPLETED_FELLOWSHIP_AT'
'EMPLOYED_BY'
'HELD_ACADEMIC_APPOINTMENT_AT'
'MEMBER_OF_DEPARTMENT'
'HOLDS_LICENSE_FROM'
'HOLDS_CERTIFICATION_FROM'
'HAS_PRACTICE_PRIVILEGE_IN'
'ACCEPTS_INSURANCE_PLAN_AT_LOCATION'
'PERFORMS_PROCEDURE'
'MEMBER_OF_PROFESSIONAL_ORGANIZATION'
'RECEIVED_AWARD_FROM'
'MAINTAINS_PUBLIC_PROFILE'
```

All discovery/enrichment edges remain `decisionGrade: false`. A decision-grade credential or authority claim remains in the trust-core claim/receipt pipeline. An edge may point to that evidence; it does not replace it.

### 7.3 Do not merge the two graph packages

- `packages/career-graph` describes product/lifecycle relationships that canonical records already hold: wallet, evidence, application, consent, employer review and start.
- `core/graph/enrichment.ts` describes discovered professional relationships and context.

They may be composed in a read API, but they have different truth semantics and should remain separate modules.

---

## 8. Minimal persistence changes

The existing append-only models should hold most data. Add only the missing orchestration and review roots.

### 8.1 `EnrichmentRun`

```prisma
model EnrichmentRun {
  id                    String   @id @default(uuid())
  subjectNpi            String
  clinicianId           String?
  initiatedByUserId     String?
  trigger               String   // NPI_CLAIM, USER_REFRESH, APPLICATION, EMPLOYER_REQUEST, SCHEDULED
  requestedAxes         Json
  status                String   // QUEUED, RUNNING, WAITING_REVIEW, PARTIAL, COMPLETE, FAILED, CANCELLED
  identitySnapshotHash  String?
  profileSnapshotId     String?
  coverageSnapshotId    String?
  startedAt             DateTime?
  completedAt           DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  sourceRuns            SourceRun[]

  @@index([subjectNpi, createdAt])
}
```

Add nullable `enrichmentRunId` to existing `SourceRun`.

### 8.2 `EntityMatchCandidate`

```prisma
model EntityMatchCandidate {
  id                    String   @id @default(uuid())
  enrichmentRunId       String
  subjectNpi            String
  sourceId              String
  externalEntityType    String
  externalEntityId      String
  externalLabel         String
  linkageMethod         String
  matchedKeys           Json
  conflictingKeys       Json
  confidenceScore       Float
  scoreMargin            Float?
  status                String   // PROPOSED, AUTO_ACCEPTED, REVIEW_REQUIRED, ACCEPTED, REJECTED, SUPERSEDED
  rawArtifactId         String
  proposedClaimIds      Json
  proposedEdgeIds       Json
  reviewReason          String?
  reviewedByUserId      String?
  reviewedAt            DateTime?
  createdAt             DateTime @default(now())

  @@unique([enrichmentRunId, sourceId, externalEntityId])
  @@index([subjectNpi, status])
}
```

Reuse the repository's existing identity-resolution decision persistence for the final decision where possible. Do not add a competing decision table merely because the service has a new name.

### 8.3 Profile and coverage snapshots

Do **not** add a mutable profile table in the first implementation.

Store append-only snapshots as `VerificationArtifact` records:

```text
source = PROFILE_PROJECTION
artifactType = PROFILE_PROJECTION_SNAPSHOT
rawPayload = {
  schemaVersion,
  subjectNpi,
  enrichmentRunId,
  fields: ProfileFieldProjection[],
  domainCoverage,
  conflicts,
  generatedAt
}
```

Store coverage separately when useful:

```text
source = SOURCE_COVERAGE
artifactType = SOURCE_COVERAGE_SNAPSHOT
rawPayload = SourceRuntimeState[] + field coverage states
```

A normalized/materialized table can be added later if measured query performance requires it. The append-only artifact is the initial source of truth.

### 8.4 Enrichment-edge persistence

Version 1 may seal `ClinicianEnrichmentEdge[]` into an `ENRICHMENT_GRAPH` artifact tied to the run. Add a dedicated edge table only when cross-clinician graph queries become a real product requirement. Do not prematurely create a second graph database.

---

## 9. NPI-triggered orchestration

### 9.1 Stage 0 — identity bootstrap

Run synchronously enough to render the first record:

1. validate NPI checksum;
2. fetch NPPES API exact match;
3. seal raw artifact;
4. derive identity, names, all taxonomy rows, all reported state/license pairs, addresses, endpoints, identifiers and filing dates;
5. create the first profile snapshot;
6. return immediately with explicit pending source axes.

The first page should never wait for every source.

### 9.2 Stage 1 — exact-key public government enrichment

Run in parallel after NPPES:

```text
PECOS Public Provider Enrollment
CMS Doctors & Clinicians NDF/API
CMS Facility Affiliation
CMS Utilization / procedure volume
CMS Order and Referring
CMS Opt-Out
Open Payments
OIG LEIE
```

These sources provide the fastest path to matching NPINO-level breadth with authoritative source lineage.

### 9.3 Stage 2 — profession and jurisdiction authorities

Select source lanes from profession and all reported/claimed jurisdictions:

```text
Physician / PA:
  state boards / FSMB PDC
  ABMS / AOA / NCCPA as applicable

RN / APRN / LPN:
  Nursys / NCSBN ID / compact privileges
  ANCC / AANPCB / PNCB / other certifier as applicable

Other professions:
  profession-specific state authority
  profession-specific certification authority
```

Do not infer that the primary practice state is the only license state. Use every distinct reported, claimed and previously confirmed jurisdiction.

### 9.4 Stage 3 — education, training and institutional record

Use this precedence:

1. exact-NPI CMS school/graduation fields;
2. authenticated ORCID education/employment where present;
3. FSMB/FCVS or other authorized credential portfolio;
4. institution/program attestation;
5. clinician-provided CV/resume/document;
6. institutional directory discovery;
7. open-web inference.

ACGME public program data can validate that a program exists and its accreditation posture. It does not by itself prove a specific clinician completed that program. Completion requires an issuer record, FCVS/credential portfolio, employer-accepted PSV or clinician-provided evidence pending verification.

### 9.5 Stage 4 — research identity

Preferred identity ladder:

```text
Authenticated ORCID iD
  → ORCID works, education, employment and funding
  → PubMed author identifiers / affiliations
  → OpenAlex author candidate set
  → ClinicalTrials.gov investigator/contact/site records
  → NIH RePORTER PI/project records
```

The current research code must change in three ways:

1. OpenAlex must return candidates, not silently select the first result.
2. PubMed must use full name, author identifiers, affiliations, specialty and time overlap—not only surname plus first initial.
3. ClinicalTrials.gov must parse the role actually present in the study record. A name match must never default to `PRINCIPAL_INVESTIGATOR`.

### 9.6 Stage 5 — clinician portfolio and public professional web

Clinician-controlled sources:

```text
CV/resume upload
Linked or imported ORCID
professional website
institutional biography
clinician-entered fields
document uploads
employer/issuer attestations
```

Public-web or commercial-contact discovery is BRONZE and must meet all of these conditions:

- source terms and robots policy allow the use;
- no scraping of Doximity, LinkedIn, Zocdoc or other protected competitor profiles;
- no consumer/private contact inference;
- source URL and observation time are retained;
- field is labeled discovered/inferred;
- clinician can reject, hide or correct it;
- contact use follows consent, applicable privacy law and recruiting communication rules.

### 9.7 Stage 6 — clinician review and promotion

The composer presents:

```text
Ready from sources
Needs your confirmation
Conflicting records
Needs an issuer
Not available from connected sources
```

AI may normalize, summarize and propose sections. AI output remains `ai_draft` until the clinician approves it. Approval changes the state to `clinician_confirmed`; it does not make the field authority-confirmed.

---

## 10. Identity resolution contract

### 10.1 Linkage hierarchy

| Linkage | Default result |
|---|---|
| Exact NPI in source | Auto-accept, subject to source integrity |
| Authenticated external ID such as ORCID or NCSBN ID | Auto-accept bridge |
| NPI + name / PAC / license corroboration | High-confidence |
| Full name + institution + specialty + overlapping dates | Candidate; threshold and margin required |
| Name + geography only | Review required |
| Name only | Never auto-accept |

### 10.2 Candidate threshold

An automatic non-NPI link requires:

```text
confidence >= 0.92
AND score margin over second candidate >= 0.15
AND no identity-key conflict
AND at least two independent corroborating dimensions
```

Thresholds are configuration values with a version. They are not hard-coded differently in each adapter.

### 10.3 Conflicts

Hard conflicts include:

- different NPI where source provides one;
- incompatible credential/profession;
- impossible timeline;
- mutually exclusive geography without time support;
- different authenticated ORCID/NCSBN identity;
- license number or birth/identity key mismatch where lawfully available.

A hard conflict sends the match to review regardless of model score.

---

## 11. Canonical services

### 11.1 `clinicianEnrichmentOrchestrator`

Responsibilities:

- create `EnrichmentRun`;
- determine source plan from profession, jurisdiction, tenant and purpose;
- launch/reuse `SourceRun`s;
- enforce concurrency, timeout and retry policy;
- record partial completion honestly;
- call identity resolver;
- generate edge, profile and coverage snapshots;
- emit audit event before success.

It must replace the separate “full research profile” orchestration as the top-level coordinator. Research adapters remain reusable workers.

### 11.2 `sourceRuntimeStateService`

Computes current truth from catalog + adapter registration + environment/config + production source runs. It is the only service allowed to label a source live, gated, stale or unavailable.

### 11.3 `entityResolutionService`

Produces `EntityMatchCandidate`s and applies shared matching policies. Source adapters return source records; they do not decide identity on their own.

### 11.4 `profileProjectionService`

Consumes claims, receipts, match decisions and enrichment edges. Produces deterministic `ProfileFieldProjection[]`, conflicts, gaps and domain coverage.

### 11.5 `enrichedClinicianRecordService`

Returns the latest authorized projection and its snapshot hash. It does not refetch sources or recompute mutable evidence during a read.

### 11.6 `coverageService`

Reports source and field-domain coverage without inventing one global “completeness” score.

Recommended domain reporting:

```text
Identity
Licensure
Certification
Education
Training
Employment
Affiliations
Practice capabilities
Research
Professional portfolio
Credentialing evidence
```

Each domain shows counts and explicit gaps, not a deceptive percentage alone.

---

## 12. API contracts

### 12.1 Start enrichment

```http
POST /api/clinicians/:npi/enrichment-runs
```

```json
{
  "trigger": "NPI_CLAIM",
  "axes": [
    "government",
    "licensure",
    "certification",
    "education",
    "institutional",
    "research"
  ],
  "purpose": "CV_WALLET"
}
```

Response:

```json
{
  "runId": "uuid",
  "status": "RUNNING",
  "firstSnapshotId": "artifact-id",
  "pendingAxes": ["licensure", "research"]
}
```

### 12.2 Read run

```http
GET /api/clinicians/:npi/enrichment-runs/:runId
```

Returns source-level state, not raw credentials or secrets.

### 12.3 Read enriched record

```http
GET /api/clinicians/:npi/enriched-record
```

Authorization modes:

- public directory projection;
- authenticated clinician owner projection;
- consented employer projection;
- internal reviewer projection.

Each mode filters fields by visibility; none recomputes truth.

### 12.4 Read coverage

```http
GET /api/clinicians/:npi/enrichment-coverage
```

Returns `SourceRuntimeState[]`, field-domain states, conflicts and next actions.

### 12.5 Resolve candidate

```http
POST /api/clinicians/:npi/match-decisions
```

```json
{
  "candidateId": "uuid",
  "decision": "ACCEPTED",
  "reason": "Authenticated ORCID linked by clinician"
}
```

### 12.6 Clinician disposition

```http
POST /api/clinicians/:npi/profile-field-dispositions
```

Allows approve, edit, reject, hide and request verification. An edit creates a clinician-confirmed claim; it never rewrites the source claim.

---

## 13. Wallet and composer information architecture

The CV Wallet should render one record, not a collection of source widgets.

### 13.1 Default hierarchy

1. **Identity** — name, credential, NPI, headline and photo.
2. **Licenses and certifications** — reported numbers and authority status shown separately.
3. **Education and training** — school, degree, residency and fellowship with source labels.
4. **Work and affiliations** — group, employer, department, facility and hospital relationships.
5. **Practice** — locations, languages, telehealth, interests, procedures and insurance when available.
6. **Research and professional work** — publications, trials, grants, awards and memberships.
7. **Documents and reusable evidence** — uploaded and issued credentials.
8. **Gaps and next actions** — what needs clinician input, issuer response or source access.
9. **Share/apply** — field-level selection and consent.

### 13.2 Field labels

Examples:

```text
Reported to CMS
Confirmed by California Medical Board
Clinician confirmed
Organization confirmed
Corroborated by 2 sources
Inferred from public professional sources — review needed
Source unavailable
Requires employer-authorized query
```

Never use a generic green check for all of these states.

### 13.3 Refresh behavior

The wallet reads the latest sealed snapshot instantly. A refresh starts an enrichment run and shows source-level progress. Existing values remain visible with their prior observation date until superseded or marked stale.

---

## 14. Source implementation priorities

### Phase E0 — truth and consolidation

**Goal:** make the repository honest before adding more data.

- designate canonical adapter per existing source;
- mark alternatives deprecated and block direct route use;
- implement `SourceRuntimeState`;
- correct stale data-source documentation;
- add `LICENSE_REPORTED`;
- add missing field/relationship vocabulary;
- add contract tests that a catalog entry or stub cannot be labeled live.

### Phase E1 — CMS breadth: beat NPINO

**Goal:** deliver the largest visible improvement with public exact-NPI data.

- implement CMS NDF ingestion with all rows;
- implement Facility Affiliation source;
- implement Utilization / procedure-volume source;
- wire CMS Order/Referring and Opt-Out;
- repair D&C parser to retain PAC IDs, enrollment IDs, group rows, assignment, specialty, school and graduation year;
- project fields into the wallet;
- expose source coverage and observation dates.

Acceptance: an NPI with CMS data shows medical school, graduation year, Medicare posture, individual PAC/enrollment IDs, all group affiliations, all facility affiliations and supported procedure-volume rows.

### Phase E2 — orchestration and projection

- add `EnrichmentRun` and SourceRun linkage;
- implement `clinicianEnrichmentOrchestrator`;
- implement deterministic profile and coverage snapshots;
- implement `enrichedClinicianRecordService` and APIs;
- refactor web `ClinicianRecord` to consume the projection;
- show incremental run progress.

### Phase E3 — professional authority

- pursue FSMB PDC integration or state-board authority contracts;
- enroll institutional Nursys/e-Notify path;
- add ABMS CertiFacts / board-certification integration;
- add AOA, NCCPA and profession-specific certification adapters;
- query every relevant jurisdiction;
- add monitoring/delta events for expiration, discipline and certification changes.

### Phase E4 — education, employment and research identity

- authenticate/link ORCID;
- migrate research orchestration under the central enrichment run;
- implement candidate-set identity resolver for OpenAlex/PubMed/ClinicalTrials;
- add NIH RePORTER;
- add clinician CV/resume parser and section approval;
- add institutional directory connectors under source governance;
- model education, training and employment separately.

### Phase E5 — operational marketplace detail

- languages, visit reasons, procedures, telehealth and patient populations;
- provider-location-specific insurance acceptance through practice/payer/partner feeds;
- public professional contact points and profile URLs under consent/privacy rules;
- employer and ATS enrichment adapters.

These fields improve matching and discovery but must remain separate from credentialing decisions.

### Phase E6 — authorized credentialing sources

- NPDB authorized-agent integration per eligible employer and purpose;
- DEA / controlled-substance verification through authorized or licensed source;
- CAQH or equivalent clinician-authorized profile import;
- education/training issuer requests;
- hospital privilege and work-history attestations;
- connect resulting evidence to Start Mission and packets.

---

## 15. Implementation ticket bundle

### E0.1 Source truth service

- `sourceRuntimeStateService.ts`
- runtime endpoint and tests
- source status UI vocabulary

### E0.2 Adapter consolidation

- source-by-source canonical owner map
- direct-import lint rule or architecture test
- deprecation annotations

### E0.3 Claim vocabulary migration

- extend `ClaimType` and `ClaimValue` unions
- parser compatibility tests
- no legacy claim ID changes

### E1.1 CMS NDF adapter

- bulk downloader and versioned manifest
- NPI index
- row parser
- full-row fixtures
- delta detection

### E1.2 CMS facility adapter

- NPI → CCN/facility claims and edges
- facility deduplication
- source dates and limitations

### E1.3 CMS utilization adapter

- procedure code/label/volume observation
- suppression handling
- context-only display

### E1.4 D&C parser repair

- all rows, not first row
- group/PAC/enrollment/location/school/assignment fields
- regression fixture against a multi-group clinician

### E2.1 EnrichmentRun persistence

- Prisma migration
- SourceRun link
- audit events and idempotency

### E2.2 Entity resolution

- `EntityMatchCandidate`
- shared scorer and threshold version
- reviewer API
- hard-conflict tests

### E2.3 Profile projection

- field precedence policies
- conflict/gap model
- sealed snapshot
- deterministic replay tests

### E2.4 Wallet migration

- one enriched record loader
- domain sections
- source/confirmation labels
- refresh progress

### E3.1 Authority integrations

- FSMB/state board
- Nursys
- ABMS/AOA/NCCPA/profession certifiers
- access-required state when not contracted

### E4.1 Research resolver

- ORCID authenticated bridge
- OpenAlex candidates
- PubMed author/affiliation resolution
- ClinicalTrials actual role parsing
- NIH RePORTER

### E4.2 CV composer

- document parser
- draft/approved/rejected states
- claim creation without source promotion
- provenance and limitation tests

---

## 16. Test gates

### 16.1 Source contracts

Every adapter fixture must prove:

- all source fields intended by the contract are retained;
- raw response checksum is stable;
- parser version is recorded;
- empty, unavailable and access-required outcomes are distinct;
- no source returns a false clear result after network/auth failure.

### 16.2 Identity resolution

Fixtures must include:

- common-name homonyms;
- same-name clinicians in different specialties;
- institution changes over time;
- ORCID mismatch;
- conflicting license number;
- multiple OpenAlex authors;
- multiple PubMed author candidates;
- ClinicalTrials contact role that is not PI.

### 16.3 Projection truth

- NPPES-reported license never renders “active” by itself;
- clinician approval never upgrades to source-confirmed;
- an unavailable authority does not render clear;
- conflicts remain visible;
- legacy claims replay to the same IDs;
- a profile snapshot hash changes when its selected claim set changes;
- employer projection contains only consented fields.

### 16.4 Competitive coverage fixtures

Add representative fixtures:

1. physician with school, groups, facilities, utilization, board certification and publications;
2. NP with multiple state licenses and Nursys access required;
3. PA with CMS group/facility data and NCCPA pending;
4. research physician with authenticated ORCID and homonymous PubMed candidates;
5. clinician with no Medicare record but valid NPPES identity.

The tests should assert domain coverage and labels, not a single completeness score.

### 16.5 Security and privacy

- tenant and clinician ownership resolved server-side;
- no raw restricted NPDB or contact payload in logs;
- no source credentials returned to clients;
- field visibility enforced at projection time;
- audit event committed before successful mutation response;
- deletion/hiding does not rewrite source artifacts;
- public directory never exposes private wallet data.

---

## 17. Legal and source-governance boundaries

### Public / automation-safe when implemented correctly

- NPPES and CMS Provider Data Catalog datasets;
- OIG LEIE downloadable data;
- Open Payments;
- PubMed/NCBI;
- ClinicalTrials.gov;
- OpenAlex under its terms;
- public institutional pages where terms/robots permit.

### Contract or authorized access

- FSMB PDC / certain DocInfo products;
- Nursys institutional products and e-Notify;
- ABMS CertiFacts and other certification authorities;
- CAQH data;
- commercial contact enrichment;
- payer/provider-directory feeds.

### Transaction-scoped / restricted

- NPDB results: only eligible registered entities, authorized agents and permitted purposes; do not reuse one employer's response for another employer;
- DEA/controlled-substance information where no public verification service is available;
- hospital privilege, peer review, malpractice and background records;
- personal contact and private employment data.

### Prohibited shortcuts

- scraping Doximity, LinkedIn, Zocdoc or other protected competitor profiles;
- presenting a competitor profile as a primary source;
- inferring license status from an NPI license number;
- using name-only research matches as confirmed identity;
- claiming an adapter is live because code or a catalog entry exists;
- storing restricted query responses in a globally reusable clinician profile.

---

## 18. Success measures

### Product

- median useful fields immediately after NPI bootstrap;
- percentage of eligible clinicians with CMS school, group and facility data displayed;
- median time to first profile snapshot;
- clinician approval/rejection rate by discovered field category;
- employer use of enriched fields in Apply packets;
- reduction in manual intake fields.

### Data quality

- source run success and freshness by source;
- identity-link precision on reviewed candidates;
- unresolved/conflict rate;
- false authority-clear rate: target zero;
- percentage of visible fields with artifact, claim and receipt lineage;
- parser field-retention coverage.

### Business

- percentage of employer-required fields available before clinician intake;
- days removed from application-to-complete-evidence;
- issuer contacts avoided because evidence was already reusable;
- start missions opened with a richer accepted packet.

---

## 19. Release sequence

The fastest visible sequence is:

```text
E0 truth/consolidation
  → E1 CMS breadth
  → E2 projection + wallet
  → E3 license/certification authorities
  → E4 education/research/CV
  → E5 operational marketplace detail
  → E6 restricted credentialing integrations
```

Do not begin with a generic web crawler. The public CMS datasets already provide the clearest route to a dramatically richer, highly defensible NPI-created record.

---

## 20. Acceptance criteria for the first enriched-record release

Given a valid NPI with available CMS data, VitalCV must:

1. create an enrichment run and NPPES snapshot;
2. display every NPPES taxonomy, reported state/license pair, address, endpoint and identifier;
3. display CMS medical school and graduation year when published;
4. display individual PAC and enrollment IDs when published;
5. display all distinct group affiliations and locations;
6. display all distinct facility affiliations and CCNs;
7. display Medicare enrollment, assignment, order/referral and opt-out posture distinctly;
8. display supported procedure-volume observations as contextual data;
9. display every field with source, observation time, confirmation state and limitation;
10. show license numbers immediately while keeping authority status separate;
11. show unavailable/gated professional authorities honestly;
12. create no name-only research link without candidate resolution;
13. seal a deterministic profile snapshot;
14. allow the clinician to approve, edit, reject or hide non-authority fields;
15. allow Apply with VitalCV to select only consented snapshot fields.

---

## 21. External reference set

- Doximity profile basics: https://support.doximity.com/hc/en-us/articles/360049326753-My-Doximity-Profile-Adding-the-Basics
- Doximity NPI-based registration: https://support.doximity.com/hc/en-us/articles/360047630573-How-to-Register-on-Doximity
- Zocdoc provider vetting: https://www.zocdoc.com/patient-help/en/articles/8843903-how-does-zocdoc-vet-the-doctors-i-see-on-the-site
- Zocdoc provider API guide: https://api-docs.zocdoc.com/guides/patient/book-appointments
- hireEZ healthcare sourcing: https://hireez.com/solutions/healthcare/
- CMS NPPES files: https://download.cms.gov/nppes/NPI_Files.html
- CMS Doctors & Clinicians datasets: https://data.cms.gov/provider-data/topics/doctors-clinicians
- CMS Doctors & Clinicians data dictionary: https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/physician/DOC_Data_Dictionary.pdf
- OIG LEIE downloads: https://oig.hhs.gov/exclusions/leie-database-supplement-downloads/
- FSMB PDC data files: https://www.fsmb.org/PDC/pdc-data-files/
- ABMS certification verification: https://www.abms.org/board-certification/verify-certification/
- Nursys license verification: https://ncsbn.org/nursing-regulation/licensure/license-verification.page
- NPDB query eligibility: https://www.npdb.hrsa.gov/resources/tables/whoCanQueryReport.jsp
- ORCID API documentation: https://info.orcid.org/documentation/integration-and-api-faq/
- PubMed help and E-utilities: https://pubmed.ncbi.nlm.nih.gov/help/

---

## 22. Final product statement

> VitalCV starts with an NPI, assembles the broadest defensible clinician career record from public, contracted, clinician-controlled and issuer-authorized sources, preserves the origin and limitation of every field, and lets the clinician reuse only the evidence they choose across applications and starts.
