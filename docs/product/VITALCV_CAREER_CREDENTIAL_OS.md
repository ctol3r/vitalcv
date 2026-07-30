# VitalCV Career & Credential Operating System

**Status:** Founder-directed product contract  
**Date:** 2026-07-29  
**Branch:** `feat/npi-profile-composer`

## Product mandate

VitalCV is not merely a credential wallet, job board, CVO workflow, or AI assistant. It is the clinician-owned operating system that carries career evidence from the first NPI lookup through employer acceptance and start.

The product must make two moments feel radically different:

1. A clinician needs to move, renew, apply, or start quickly.
2. A recruitment or credentialing team is under pressure to place a clinician into a department that needs coverage now.

In both moments, VitalCV should feel like the light: the place that already knows what is available, names what is missing, coordinates the next action, and keeps every party informed without overstating what has been verified.

## Non-negotiable truth boundary

VitalCV may accelerate and organize credentialing, but it must not claim to replace an employer's credentialing, privileging, hiring, or regulatory decision.

Every visible fact must carry one of these origins:

- `SOURCE_BACKED`: returned by a named source with observation time and limitation.
- `SELF_ATTESTED`: entered or explicitly approved by the clinician.
- `AI_DRAFT`: generated from available facts but not stored or shared until clinician approval.
- `ISSUER_RESPONSE`: supplied by the issuing authority or its delegated channel.
- `EMPLOYER_DECISION`: recorded acceptance, request, exception, or final decision by the employer.
- `UNKNOWN`: not available; never silently inferred.

AI must never convert an inference into a source-backed claim.

---

# Capability system

## 1. NPI-to-profile composer

A clinician starts with only an NPI.

VitalCV must:

- read the current NPPES record;
- create a source-attributed identity and specialty spine;
- pull every already-available source lane permitted for the clinician and product environment;
- compose an editable CV/profile draft;
- separate source-backed facts from AI-written narrative and clinician-entered facts;
- show missing sections rather than inventing education, employment, certifications, publications, or affiliations;
- let the clinician approve, edit, reject, or hide every drafted section;
- preserve source, observation time, transformation recipe, limitation, and approval event;
- regenerate only the affected section when evidence changes.

### First implementation slice

`POST /api/profile/npi/compose`

Returns a draft; it does not publish or share anything.

```ts
interface NpiProfileDraft {
  draftId: string;
  npi: string;
  generatedAt: string;
  sourceFacts: Array<{
    field: string;
    value: unknown;
    sourceId: string;
    observedAt: string | null;
    limitation: string;
  }>;
  suggestedNarrative: {
    headline: string | null;
    professionalSummary: string | null;
  };
  missingSections: string[];
  warnings: string[];
  provenance: 'AI_DRAFT';
}
```

Approval is a separate mutation. Approved AI text becomes `SELF_ATTESTED`, with an audit event linking back to `draftId`.

## 2. Clinician vault and renewal command center

Functional parity with leading nurse credential-passport products is the baseline.

VitalCV must support:

- active licenses across professions and states;
- board certifications and professional certifications;
- CE, CME, pharmacology and state-mandated category tracking;
- immunizations, titers, physicals and occupational-health requirements;
- work history, supervisor contacts, dates and hours;
- education, training, transcripts and diplomas;
- BLS, ACLS, PALS, DEA, controlled-substance registrations and collaborative agreements where applicable;
- encrypted document vault with preview, search, tags, version history and expiring share links;
- unified renewal calendar;
- receipts, fees and renewal-cost tracking;
- configurable reminders at multiple horizons;
- mobile photo/PDF upload;
- AI extraction with field-level confidence and human confirmation;
- direct renewal/application links;
- one-click clinician-controlled employer report.

The vault is not proof by itself. Uploaded documents remain self-provided until corroborated by an appropriate source or reviewer.

## 3. Multi-state licensure intelligence

VitalCV must maintain a source-dated, reviewable rules layer for every supported profession and jurisdiction.

Capabilities:

- state and territory requirement pages;
- initial, endorsement, renewal, temporary and compact pathways;
- itemized fees and expected external costs;
- CE/CME and mandated-course rules;
- controlled-substance and prescriptive-authority requirements;
- scope/practice-authority context;
- 2–4 jurisdiction comparison;
- eligibility checker;
- exact gap analysis;
- readiness by jurisdiction and license type;
- move planner with cost, expected steps and scope implications;
- application checklist generated from the current rule version;
- source URL, observed date, effective date and reviewer status for each rule.

No legal or regulatory rule may be generated from model memory. AI may explain stored rules; it may not create them.

## 4. Smart document intelligence

Uploads should become useful without becoming falsely trusted.

Pipeline:

1. Virus/malware scan and content-type validation.
2. OCR or native text extraction.
3. Document classification.
4. Structured field extraction.
5. Confidence and contradiction checks.
6. Clinician review.
7. Optional source corroboration or verifier review.
8. Versioned storage and expiry scheduling.

Supported families include licenses, certifications, CE/CME certificates, immunizations, diplomas, transcripts, Nursys reports, malpractice coverage, DEA/CSR documents, identification and employer-specific forms.

## 5. My Applications and licensing missions

Every application—job, license, renewal, payer enrollment, privileges or employer onboarding—becomes a mission with an owner, evidence requirements and next actions.

Capabilities:

- checklist generated from the target requirement set;
- due dates, dependencies and current blockers;
- reusable evidence matching;
- forms and portal links;
- fees and receipts;
- clinician tasks, issuer tasks, VitalCV concierge tasks and employer tasks;
- status history and communication timeline;
- document/request reuse across missions;
- escalation rules;
- explicit distinction between submitted, acknowledged, in review, decision made and closed.

## 6. Employer Start Mission

The employer experience should feel like receiving a well-organized CVO/PSV head start, not another applicant document dump.

Employer package:

- clinician-consented evidence packet;
- source and observation time for every lane;
- PSV receipts where available;
- unresolved gaps, conflicts and access limitations;
- employer-specific requirement comparison;
- suggested review order;
- issuer requests already in progress;
- exception queue;
- communication record;
- downloadable human-readable report;
- machine-readable package/API;
- employer acceptance action with scope, timestamp and decision owner;
- start-risk timeline and next-best action.

VitalCV organizes and performs the reusable work. The employer retains its final credentialing, privileging, compliance and hiring decision.

## 7. Issuer Exchange

Issuer communication is a first-class product, not email hidden behind the employer dashboard.

Capabilities:

- issuer directory and preferred communication channel;
- structured request templates by evidence type;
- consent and authority attachment;
- complete clinician identifiers and exact requested response;
- secure response/upload link;
- inbound email ingestion with threading;
- portal/manual-call task tracking;
- delivery, open, acknowledgment and response timestamps;
- SLA and follow-up cadence;
- bounced/failed channel recovery;
- human concierge ownership;
- response classification and evidence reconciliation;
- polite closure notice when the request is complete or withdrawn;
- issuer correction/dispute workflow;
- reusable issuer receipt when permitted.

### Communication standard

Every request must answer:

- Who is asking?
- On whose authority?
- Which clinician and record?
- Exactly what is requested?
- Why is it needed?
- What is the secure response path?
- What is the deadline?
- Who can answer questions?
- How will the issuer know the matter is closed?

## 8. Vital Agent

VitalCV needs one coherent agent, not scattered chatbots.

Working name: **Vital Agent**. MATCHA remains the opportunity-intelligence personality inside the agent.

The agent can:

- build and maintain the clinician profile;
- explain evidence and limitations;
- identify missing information;
- prepare but not silently send issuer requests;
- coordinate licensing/application missions;
- compare opportunities against the clinician's preferences and evidence;
- prepare selective-disclosure packets;
- monitor expirations, rule changes and mission blockers;
- brief credentialing and recruitment teams;
- propose the next action with reason and expected effect;
- execute only within explicit authority and confirmation policies.

Every action needs an audit trace: goal, plan, tools, inputs, outputs, approval and result.

## 9. Opportunity marketplace

The public opportunity board should reach HiringCafe-grade discovery while retaining VitalCV's evidence advantage.

Capabilities:

- broad, fast search;
- structured filters and transparent sorting;
- deduplication and stale-listing detection;
- salary/pay normalization;
- specialty, profession, license, location, schedule, visa and employment-type filters;
- source and update time;
- employer identity and requirement completeness;
- save, compare, alert and apply;
- personalized MATCHA ranking;
- readiness comparison against stated requirements;
- one application packet that can be reused without silently sharing new information;
- ATS and employer-site `Apply with VitalCV` integration.

## 10. Health-system operating layer

VitalCV should borrow the useful operating principles of modern health-system data platforms without becoming an unfocused analytics warehouse.

Capabilities:

- unified clinician identity and evidence graph;
- requirement graph by employer, facility, role and jurisdiction;
- operational command center;
- bottleneck and queue visibility;
- source/issuer health;
- staffing-start risk;
- auditable workflow automation;
- role-based access and least privilege;
- interoperability APIs and event streams;
- explainable recommendations;
- simulation of what evidence or action removes the next blocker.

## 11. Evidence answer engine

VitalCV should make credential and career evidence understandable in the way high-quality clinical evidence products make medical literature understandable.

The answer engine must:

- answer from named sources and the user's authorized records;
- distinguish facts, rules, inferences and unknowns;
- quote or link the supporting item;
- expose observation/effective dates;
- explain conflicts;
- provide a concise answer and an inspectable evidence trail;
- refuse unsupported certainty.

---

# Shared platform primitives

These capabilities must use one set of primitives rather than separate product silos:

- `PersonProfile` — clinician-controlled career layer.
- `EvidenceArtifact` — document or source response.
- `SourceObservation` — what a named source answered at a time.
- `Requirement` — a rule or employer requirement with source/version.
- `Mission` — application, renewal, license, onboarding or start objective.
- `Task` — next action with owner and dependency.
- `ConsentGrant` — what the clinician authorized, for whom and for how long.
- `EvidencePacket` — immutable consented disclosure snapshot.
- `CommunicationThread` — issuer/employer exchange.
- `Decision` — employer, issuer, reviewer or clinician action.
- `Receipt` — replayable proof of a source read, transmission, acceptance or start.
- `AgentRun` — trace of planned/executed AI work.

# Delivery sequence

## Wave A — NPI profile foundation

- Compose an AI draft from NPI-backed facts.
- Add field-level provenance and missing-section disclosure.
- Require clinician approval before persistence.
- Create an audit event linking approval to the draft.
- Render the result in the live clinician profile.

## Wave B — Vault and Smart Import

- Encrypted document storage and metadata.
- Mobile/PDF import.
- Extraction review UI.
- Expiry calendar and alerts.
- License, certification, CE/CME and immunization objects.

## Wave C — Mission engine

- General `Mission`, `Task`, `RequirementMatch` and timeline model.
- Licensing and renewal missions first.
- Employer Start Mission next.

## Wave D — Issuer Exchange and concierge

- Structured issuer request and secure response link.
- Email/portal/manual task channels.
- Follow-up scheduler, SLA and escalation.
- Human work queue and complete communication history.

## Wave E — State intelligence

- Versioned requirement corpus.
- Cost tables, comparison, readiness and gap engine.
- Move planner and application checklist.

## Wave F — Vital Agent

- Agent plan/approval/execute loop over the shared mission engine.
- Clinician and employer briefings.
- MATCHA opportunity actions.

## Wave G — Marketplace and integrations

- Expand public search quality and coverage.
- ATS `Apply with VitalCV` SDK/button.
- Employer APIs, webhooks and evidence-package import.

# Launch metrics

Do not optimize for feature count. Measure whether the system removes repeated work and protects start dates.

Primary metrics:

- NPI entered → useful profile draft produced.
- Draft fields approved, edited or rejected.
- Existing evidence reused per mission.
- Time from employer request → reviewable packet.
- Issuer request acknowledgment and response time.
- Blockers resolved per mission.
- Employer review touches avoided.
- Application/credential submission → employer acceptance.
- Employer acceptance → start attestation.
- Renewal/license deadlines completed without lapse.

# Immediate rule

No new isolated dashboard, agent, vault, licensing tool or marketplace surface may be added unless it uses—or explicitly extends—the shared primitives above. VitalCV becomes a complete product by making one transaction coherent, not by accumulating disconnected features.