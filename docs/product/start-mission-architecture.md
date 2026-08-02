# VitalCV Start Mission Architecture

**Status:** Proposed implementation contract  
**Prepared against:** `main` @ `95327137e1e96ba9947d66d8f93ab505212313e6`  
**Scope:** Apply with VitalCV, employer head-start acceptance, issuer coordination, source evidence, consent, delivery receipts, and qualified-start operations.

## 1. Product decision

VitalCV will not build faxing, credential storage, AI drafting, employer review, and identity proof as disconnected products.

The canonical operating loop is:

```text
Apply intent
  -> clinician identity and profile
  -> consented evidence packet
  -> employer handoff
  -> head-start acceptance
  -> Start Mission
  -> issuer/source requests
  -> remaining requirements resolved
  -> employer records start-ready
  -> employer records started
  -> evidence remains reusable
```

OpenEvidence's relevant lesson is to place communication inside the workflow it resolves, then turn calls, messages, faxes, voicemail, and documentation into one coordinated operating surface. World ID's relevant lesson is to keep holder, issuer, relying party, credential, action, signal, and proof distinct. VitalCV adopts those architectural separations without copying OpenEvidence's patient workflow or requiring World ID, an Orb, biometrics, blockchain, or zero-knowledge proofs.

## 2. Reuse the current repository; do not create six new silos

The repository already contains most of the durable substrate:

| Required concept | Existing substrate | Decision |
|---|---|---|
| Application | `Application` | Keep canonical. |
| Consented packet | `ApplicationPacket` + consent `AuditEvent` | Keep packet immutable; add first-class `ConsentGrant`. |
| Employer activation | `StartActivation` + `ActivationRequirement` | Expose together as the `StartMission` domain aggregate. Do not create a competing mission table in phase 1. |
| Source request | `VerificationRequest` | Extend additively; do not replace. |
| Source evidence | `SourceRun`, `SourceRecord`, `ClaimRecord`, `VerificationArtifact`, `VerificationReceiptRecord`, `PsvReceipt` | Keep canonical. |
| Signed credential | `IssuedCredentialRecord` | Keep canonical. |
| Clinician-provided credential | `CandidateCredential`, `PersonProfile.selfAttested` | Keep separate from source-backed evidence. |
| Employer acceptance | `EmployerAcceptance` | Keep packet-linked head-start acceptance semantics. |
| Delivery/share | `ApplicationPacket`, bundle/share paths, `AuditReceiptRecord` | Add typed `HandoffReceipt`; do not infer delivery from an audit row alone. |
| Audit | `AuditEvent` | Every consequential write remains audit-before-success. |
| Short-lived apply context | `ParRequest` | Reuse as the one-time Apply Intent transport. |

### Non-negotiable truth boundaries

- NPI lookup is registry discovery, not proof that the current user is the clinician.
- AI output is `ai_draft`, never source-backed.
- Clinician approval makes content clinician-approved or self-attested, not primary-source-verified.
- A source response can support a claim; it does not make the employer's final credentialing, privileging, hiring, or start decision.
- `head_start_accepted` means the named employer accepts the named packet scope as reusable input under a named policy version. It does not mean cleared or start-ready.
- `start_ready` and `started` are explicit authorized employer events, never inferred from a score.

## 3. Canonical domain objects

### 3.1 StartMission

`StartMission` is the API/domain aggregate over one `Application`, its `StartActivation`, its `ActivationRequirement[]`, active `VerificationRequest[]`, recent `CommunicationEvent[]`, current packet, and explicit start events.

Do not add a second mission table in phase 1. Extend `StartActivation` additively for the small number of mission-level facts it does not yet hold.

```ts
export interface StartMission {
  id: string;                    // StartActivation.id
  applicationId: string;
  clinicianNpi: string;
  clinicianUserId: string;
  organizationId: string;
  opportunityId: string;
  acceptedPacketId: string;
  acceptedPacketHash: string;
  acceptanceId: string;
  intendedStartDate: string | null;
  urgency: 'routine' | 'priority' | 'critical';
  state:
    | 'under_review'
    | 'head_start_accepted'
    | 'requirements_in_progress'
    | 'waiting_on_clinician'
    | 'waiting_on_issuer'
    | 'manual_review'
    | 'start_ready'
    | 'started'
    | 'withdrawn'
    | 'cancelled'
    | 'closed';
  requirements: ActivationRequirementView[];
  blockerSummary: MissionBlocker[];
  nextAction: MissionNextAction | null;
  createdAt: string;
  updatedAt: string;
}
```

Additive `StartActivation` columns:

```prisma
model StartActivation {
  // existing fields remain
  applicationId       String?   @unique @map("application_id") @db.Uuid
  opportunityId       String?   @map("opportunity_id") @db.Uuid
  acceptedPacketId    String?   @map("accepted_packet_id") @db.Uuid
  acceptedPacketHash  String?   @map("accepted_packet_hash")
  intendedStartDate   DateTime? @map("intended_start_date")
  urgency             String    @default("routine")
  policyVersion       String?   @map("policy_version")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  @@index([applicationId])
  @@index([opportunityId])
  @@index([activationState, intendedStartDate])
}
```

The mission state is derived from explicit lifecycle events and requirement state. It must not be calculated from a readiness score.

### 3.2 VerificationRequest

Extend the existing `VerificationRequest`; retain `requestId` as the canonical identifier and the existing `PsvReceipt.verificationRequestId` linkage.

```prisma
model VerificationRequest {
  requestId     String                    @id @default(uuid()) @db.Uuid
  clinicianId   String
  lane          String
  source        String
  attestorId    String?
  documentHash  String?
  subject       String
  status        VerificationRequestStatus @default(PENDING)
  createdAt     DateTime                   @default(now())
  completedAt   DateTime?
  receiptId     String?
  failureReason String?

  applicationId           String?  @map("application_id") @db.Uuid
  startActivationId       String?  @map("start_activation_id") @db.Uuid
  activationRequirementId String?  @map("activation_requirement_id") @db.Uuid
  organizationId          String?  @map("organization_id") @db.Uuid
  issuerId                String?  @map("issuer_id")
  requestedClaim          String?  @map("requested_claim")
  purpose                 String?  @map("purpose")
  authorizationConsentId  String?  @map("authorization_consent_id") @db.Uuid
  preferredChannel        String?  @map("preferred_channel")
  dueAt                   DateTime? @map("due_at")
  nextFollowUpAt          DateTime? @map("next_follow_up_at")
  attemptCount            Int      @default(0) @map("attempt_count")
  assignedTo              String?  @map("assigned_to")
  idempotencyKey          String?  @unique @map("idempotency_key")
  updatedAt               DateTime @updatedAt @map("updated_at")

  @@index([applicationId, status])
  @@index([startActivationId, status])
  @@index([activationRequirementId])
  @@index([issuerId, status])
  @@index([nextFollowUpAt, status])
}
```

Canonical status vocabulary:

```ts
type VerificationRequestStatus =
  | 'DRAFT'
  | 'AWAITING_AUTHORIZATION'
  | 'READY_TO_SEND'
  | 'SENT'
  | 'DELIVERED'
  | 'AWAITING_RESPONSE'
  | 'RESPONSE_RECEIVED'
  | 'UNDER_REVIEW'
  | 'SATISFIED'
  | 'PARTIALLY_SATISFIED'
  | 'UNABLE_TO_VERIFY'
  | 'CANCELLED'
  | 'FAILED';
```

`UNABLE_TO_VERIFY` is not an adverse credential result. It means the requested source evidence was not obtained under the recorded request.

### 3.3 CommunicationEvent

A new append-only table is justified. `AlertDeliveryAttempt` concerns monitoring alerts and must not be repurposed as issuer correspondence. Communication belongs to a mission and, where applicable, a verification request.

```prisma
model CommunicationEvent {
  id                      String   @id @default(uuid()) @db.Uuid
  startActivationId       String?  @map("start_activation_id") @db.Uuid
  applicationId           String?  @map("application_id") @db.Uuid
  verificationRequestId   String?  @map("verification_request_id") @db.Uuid
  activationRequirementId String?  @map("activation_requirement_id") @db.Uuid
  organizationId          String?  @map("organization_id") @db.Uuid
  clinicianId             String?  @map("clinician_id")
  issuerId                String?  @map("issuer_id")

  direction               String   // outbound | inbound | internal
  channel                 String   // email | fax | secure_message | phone | voicemail | webhook | portal
  eventType               String   @map("event_type")
  status                  String
  senderRef               String?  @map("sender_ref")
  recipientRef            String?  @map("recipient_ref")
  providerMessageId       String?  @map("provider_message_id")
  threadKey               String?  @map("thread_key")
  subject                 String?
  redactedSummary         String?  @map("redacted_summary")
  contentHash             String?  @map("content_hash")
  encryptedContentRef     String?  @map("encrypted_content_ref")
  attachmentRefs          Json     @default("[]") @map("attachment_refs")
  consentGrantId          String?  @map("consent_grant_id") @db.Uuid

  occurredAt              DateTime @map("occurred_at")
  createdAt               DateTime @default(now()) @map("created_at")
  metadata                Json     @default("{}")

  @@unique([channel, providerMessageId])
  @@index([verificationRequestId, occurredAt])
  @@index([startActivationId, occurredAt])
  @@index([threadKey, occurredAt])
  @@index([issuerId, occurredAt])
  @@map("communication_events")
}
```

Raw message bodies and files belong in encrypted object storage; the relational ledger stores minimum-necessary summaries, hashes, and pointers. Provider webhooks append idempotent events and never overwrite the original outbound record.

### 3.4 Credential

`Credential` is a canonical API type, not a new generic database table. A new table would duplicate existing evidence stores and erase provenance differences.

```ts
export type Credential =
  | SourceBackedCredential
  | IssuerSignedCredential
  | ClinicianProvidedCredential
  | AiDraftCredential;

interface CredentialBase {
  id: string;
  subjectNpi: string;
  credentialType: string;
  issuerId: string | null;
  issuedAt: string | null;
  observedAt: string | null;
  expiresAt: string | null;
  status: 'active' | 'expired' | 'revoked' | 'suspended' | 'needs_review' | 'unknown';
  limitations: string[];
}

export interface SourceBackedCredential extends CredentialBase {
  provenance: 'source_backed';
  artifactId: string;
  claimRecordIds: string[];
  receiptIds: string[];
  sourceId: string;
  sourceUrl: string | null;
  trustTier: string | null;
  confidenceScore: number | null;
}

export interface IssuerSignedCredential extends CredentialBase {
  provenance: 'issuer_signed';
  issuedCredentialRecordId: string;
  credentialId: string;
  issuerDid: string;
  holderDid: string;
  format: string;
  kid: string;
  statusReference: string | null;
}

export interface ClinicianProvidedCredential extends CredentialBase {
  provenance: 'self_attested' | 'clinician_approved';
  candidateCredentialId: string | null;
  profileFieldId: string | null;
  approvedAt: string;
}

export interface AiDraftCredential extends CredentialBase {
  provenance: 'ai_draft';
  draftId: string;
  modelRef: string;
  generatedAt: string;
  approvedAt: null;
}
```

Persistence mapping:

- `source_backed` -> `VerificationArtifact` + `ClaimRecord` + `VerificationReceiptRecord`/`PsvReceipt`.
- `issuer_signed` -> `IssuedCredentialRecord`.
- `self_attested`/`clinician_approved` -> `CandidateCredential`, `PersonProfile.selfAttested`, or approved profile-composer records.
- `ai_draft` -> the NPI profile composer draft store; never emitted into an employer packet until the clinician explicitly approves it.

The projection belongs in `apps/api/backend/src/services/credentials/credentialProjectionService.ts` (with a shared DTO package only if dependency direction permits).

### 3.5 ConsentGrant

Consent becomes a reusable, first-class object rather than existing only as packet fields and an untyped audit row.

```prisma
model ConsentGrant {
  id                    String    @id @default(uuid()) @db.Uuid
  clinicianUserId       String    @map("clinician_user_id")
  clinicianNpi          String    @map("clinician_npi")
  organizationId        String    @map("organization_id") @db.Uuid
  recipient             String
  purpose               String
  action                String
  scope                 Json
  packetId              String?   @map("packet_id") @db.Uuid
  packetHash            String?   @map("packet_hash")
  applicationId         String?   @map("application_id") @db.Uuid
  startActivationId     String?   @map("start_activation_id") @db.Uuid
  verificationRequestId String?   @map("verification_request_id") @db.Uuid

  authenticationMethod  String    @map("authentication_method")
  authenticationRef     String?   @map("authentication_ref")
  grantedAt             DateTime  @map("granted_at")
  validUntil            DateTime? @map("valid_until")
  revokedAt             DateTime? @map("revoked_at")
  revokedReason         String?   @map("revoked_reason")
  supersededById        String?   @map("superseded_by_id") @db.Uuid

  grantHash             String    @unique @map("grant_hash")
  auditEventId          String    @unique @map("audit_event_id") @db.Uuid
  createdAt             DateTime  @default(now()) @map("created_at")

  @@index([clinicianUserId, grantedAt])
  @@index([organizationId, grantedAt])
  @@index([applicationId])
  @@index([startActivationId])
  @@index([verificationRequestId])
  @@map("consent_grants")
}
```

Rules:

- Scope is field/claim-level, not blanket account consent.
- Purpose, recipient, packet hash, action, validity, and authorization method are covered by `grantHash`.
- Revocation never deletes history; downstream reads fail closed.
- Existing `ApplicationPacket.consentReceiptId` stays for replay compatibility. Add nullable `consentGrantId` for new packets; never rewrite legacy packet hashes.
- Issuer-contact authority is explicit in scope and tied to a request/issuer.

### 3.6 HandoffReceipt

A handoff receipt proves what VitalCV attempted to deliver, to whom, for what purpose, under which consent, and what the transport reported. It does not prove employer review or acceptance.

```prisma
model HandoffReceipt {
  id                      String   @id @default(uuid()) @db.Uuid
  handoffId               String   @map("handoff_id") @db.Uuid
  attemptNumber           Int      @map("attempt_number")
  applicationId           String?  @map("application_id") @db.Uuid
  startActivationId       String?  @map("start_activation_id") @db.Uuid
  verificationRequestId   String?  @map("verification_request_id") @db.Uuid
  communicationEventId    String?  @map("communication_event_id") @db.Uuid
  consentGrantId          String   @map("consent_grant_id") @db.Uuid
  packetId                String?  @map("packet_id") @db.Uuid
  packetHash              String?  @map("packet_hash")
  payloadHash             String   @map("payload_hash")
  recipientOrganizationId String?  @map("recipient_organization_id") @db.Uuid
  recipient               String
  purpose                 String
  channel                 String
  transportProvider       String?  @map("transport_provider")
  providerMessageId       String?  @map("provider_message_id")
  status                  String   // delivered | failed | rejected | logged_only | acknowledged
  limitation              String?
  deliveredAt             DateTime? @map("delivered_at")
  acknowledgedAt          DateTime? @map("acknowledged_at")
  issuedAt                DateTime  @default(now()) @map("issued_at")
  receiptHash             String    @unique @map("receipt_hash")
  auditEventId            String    @unique @map("audit_event_id") @db.Uuid
  metadata                Json      @default("{}")

  @@unique([handoffId, attemptNumber])
  @@index([applicationId, issuedAt])
  @@index([startActivationId, issuedAt])
  @@index([recipientOrganizationId, issuedAt])
  @@index([status, issuedAt])
  @@map("handoff_receipts")
}
```

Every retry creates another immutable receipt. Employer acknowledgement is an explicit receipt/event, not a silent mutation of a prior failed attempt.

## 4. Apply Intent: reuse `ParRequest`

World ID's action/signal pattern maps to a short-lived VitalCV Apply Intent. Reuse `ParRequest` rather than adding an unauthenticated session table.

```ts
interface ApplyIntent {
  version: '1';
  action: 'apply_with_vitalcv';
  opportunityId: string;
  opportunityVersion: string;
  organizationId: string;
  organizationName: string;
  purpose: string;
  requestedSections: string[];
  requestedCredentialTypes: string[];
  callbackUrl: string | null;
  returnUrl: string;
  state: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}
```

The employer/embed server creates it. The clinician receives only the opaque `requestUri` through a link, QR code, or embedded button. The server validates intent ownership, expiry, nonce, callback allowlist, and one-time use before submission.

## 5. Hot Apply with VitalCV flow

**Definition:** authenticated clinician, claimed NPI, existing profile, and usable evidence.

```text
1. Employer ATS/embed creates Apply Intent (ParRequest).
2. Clinician opens /apply/{requestUri}; VitalCV restores exact employer, role,
   purpose, opportunity version, and requested evidence.
3. Server verifies Clerk session and resolves PersonProfile/NPI.
4. Credential projection loads current source-backed, issuer-signed, and
   clinician-approved records. Unknown/gated states remain visible.
5. Clinician reviews field-level disclosure; employer cannot silently add scope.
6. Step-up confirmation runs through the existing passkey/biometric abstraction.
7. In one transaction:
   a. create ConsentGrant + AuditEvent;
   b. create/reuse Application;
   c. seal immutable ApplicationPacket referencing ConsentGrant;
   d. mark Apply Intent used;
   e. create HandoffReceipt for employer delivery.
8. Employer receives packet/hash/limitations through portal, webhook, ATS callback,
   or secure link.
9. Employer may record head-start acceptance. Only then is StartMission opened and
   remaining ActivationRequirements instantiated.
```

## 6. Cold Apply with VitalCV flow

**Definition:** no VitalCV account, no claimed profile, or no approved profile narrative.

```text
1. Employer creates the same Apply Intent. Context survives the entire flow.
2. User signs in or creates an account; returnTo points back to requestUri.
3. User enters NPI. NPPES discovery creates the registry-derived identity spine.
4. VitalCV labels the profile unclaimed until account-to-clinician binding reaches
   the required assurance level.
5. AI profile composer drafts CV/profile sections from permissible source facts and
   clinician-provided context. Every generated section is ai_draft.
6. Clinician approves, edits, rejects, or hides each draft. Approval produces
   clinician-approved/self-attested content, never source-backed evidence.
7. Missing employer-requested evidence remains visible as a limitation. The user
   can apply only when employer policy permits.
8. Clinician reviews disclosure and completes step-up confirmation.
9. The same atomic ConsentGrant -> ApplicationPacket -> HandoffReceipt transaction
   runs. No second cold packet format exists.
10. Employer head-start acceptance opens the same StartMission used by the hot flow.
```

The cold flow must never lose the original employer/role transaction inside generic onboarding.

## 7. Start Mission and issuer relay

```text
Employer accepts named packet scope
  -> EmployerAcceptance linked to packet hash
  -> StartActivation exposed as StartMission
  -> ActivationRequirements instantiated from employer/opportunity policy
  -> accepted evidence marks matching requirements met
  -> missing source evidence creates VerificationRequest
  -> clinician grants issuer-contact consent where required
  -> Vital Agent prepares request and proposed channel
  -> authorized human approves consequential outbound representation
  -> CommunicationEvent appended for every attempt/status/response
  -> inbound response enters source ingestion and receipt pipeline
  -> Credential projection updates from canonical artifacts/claims/receipts
  -> requirement is met, remains under review, or records unable-to-verify
  -> employer sees blocker, owner, evidence, limitation, and next action
  -> employer explicitly records start_ready and started
```

Phase 1 transport is email and fax. Secure messaging, phone, and voicemail follow only after the request/mission ledger is proven.

```ts
interface CommunicationAdapter {
  channel: 'email' | 'fax' | 'secure_message' | 'phone' | 'voicemail';
  send(command: SendCommunicationCommand): Promise<ProviderSendResult>;
  normalizeWebhook(payload: unknown): Promise<CommunicationEventInput[]>;
}
```

Adapters live under `apps/api/backend/src/services/communications/adapters/`. Core services own consent, idempotency, audit, hashes, and state; providers own transport only.

## 8. API surface

All routes use verified Clerk identity. Employer scope is resolved from membership server-side, preserving uniform 404 behavior for unknown and foreign resources.

```text
POST   /api/apply/intents
GET    /api/apply/intents/:requestUri
POST   /api/apply/intents/:requestUri/submit
GET    /api/applications/:applicationId/packet
POST   /api/applications/:applicationId/head-start-accept

GET    /api/start-missions/:applicationId
POST   /api/start-missions/:applicationId/requirements/instantiate
PATCH  /api/start-missions/:applicationId/requirements/:requirementId
POST   /api/start-missions/:applicationId/start-ready
POST   /api/start-missions/:applicationId/start
POST   /api/start-missions/:applicationId/cancel

POST   /api/start-missions/:applicationId/verification-requests
GET    /api/start-missions/:applicationId/verification-requests
POST   /api/verification-requests/:requestId/authorize
POST   /api/verification-requests/:requestId/send
POST   /api/verification-requests/:requestId/follow-up
POST   /api/communications/webhooks/:provider

POST   /api/consent-grants/:id/revoke
GET    /api/handoffs/:handoffId/receipts
POST   /api/handoffs/:handoffId/acknowledge
```

No endpoint may trust a caller-supplied `organizationId` as authorization scope.

## 9. Vital Agent contract

Vital Agent is an orchestrator over durable mission objects, not a generic chatbot.

It may autonomously summarize status, identify dependencies, recommend the next request/channel, draft correspondence, classify inbound correspondence as a proposal, schedule policy-approved follow-ups, prepare employer updates, and surface deadlines.

It may not consent, disclose outside a grant, invent unvalidated issuer contacts, claim clearance, make adverse decisions, mark requirements met solely from model output, record start-ready/started, or hide failures and limitations.

```ts
interface AgentActionProposal {
  id: string;
  missionId: string;
  actionType: string;
  rationale: string;
  affectedObjectIds: string[];
  requiredConsentGrantId: string | null;
  requiresHumanApproval: boolean;
  expiresAt: string;
  status: 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed';
}
```

## 10. Phased implementation plan

### Phase 0 — Contract lock and migration design

- Accept this document and update the activation ADR from Proposed to Accepted.
- Define shared enums/types without write paths.
- Produce additive migration receipt and rollback plan.

### Phase 1 — Persistence and domain projections

- Extend `StartActivation` and `VerificationRequest`.
- Add `ConsentGrant`, `CommunicationEvent`, and `HandoffReceipt`.
- Add nullable `ApplicationPacket.consentGrantId`; preserve legacy hashes.
- Implement `credentialProjectionService` and `startMissionReadService`.
- Add audit constants and idempotency keys.

**Gate:** disposable-Postgres migration replay, no destructive changes, legacy packet replay byte-identical, cross-tenant tests fail closed.

### Phase 2 — Hot Apply Intent and atomic handoff

- Reuse `ParRequest` for signed, expiring Apply Intents.
- Build `/apply/[requestUri]` with exact employer/role context.
- Move opportunity applications onto the canonical `ApplicationPacket` path.
- Write ConsentGrant and HandoffReceipt in the application transaction.
- Reuse `applicationService.ts`, `applicationPacketService.ts`, and packet replay.
- Add employer portal/webhook receipt views.

**Primary files:** `applicationService.ts`, `applicationPacketService.ts`, `routes/applications.ts`, `routes/widget.ts`, `apps/web/app/apply/[requestUri]/`, `components/apply/ApplyWithVitalCV.tsx`, `packages/embed-sdk/`.

### Phase 3 — Cold NPI profile composer continuity

- Preserve Apply Intent through sign-up/onboarding.
- NPI -> NPPES-derived PersonProfile spine.
- Separate AI draft storage and approval lifecycle.
- Approved sections enter self-attested/candidate records with clinician provenance.
- Return directly to the original disclosure screen.

**Gate:** NPI discovery never becomes identity-confirmed; AI drafts never become source-backed; no invented facts.

### Phase 4 — Employer head-start acceptance and Start Mission UI

- One audited packet-linked head-start accept action.
- Open StartMission through the existing activation flow.
- Instantiate remaining requirements using `ActivationRequirement` lifecycle.
- Clinician and employer views share the same records.
- Show blocker, owner, due date, source, limitation, and next action.

**Gate:** accept does not set `APPROVED`, `start_ready`, or `started`; service-enforced start predicate remains explicit.

### Phase 5 — Issuer Relay: email and fax

- VerificationRequest UI/service.
- Consent-scoped email and fax adapters.
- Provider webhooks -> append-only CommunicationEvents.
- AI drafting and response classification with human approval boundaries.
- Responses -> existing artifacts/claims/receipts.
- Handoff receipts and employer status summaries.

**Gate:** no send without consent; webhook replay idempotent; delivery is not mislabeled verification; raw content minimized and encrypted outside the relational ledger.

### Phase 6 — Vital Agent orchestration

- Mission plan/proposal service.
- Approval queue for consequential actions.
- Policy-driven follow-ups.
- Employer summaries grounded only in durable mission objects.
- Full receipt trail.

### Phase 7 — Additional channels and Maintenance Passport

Add secure messaging, voice, and voicemail after email/fax proves the mission model. Integrate licenses, certifications, and CE/MOC as credentials and requirements—not as a disconnected course marketplace. Accredited issuance/reporting requires real partners.

## 11. Test matrix

### Data and service

- canonical hash stability;
- audit-before-success;
- idempotent retry;
- consent revocation fail-closed;
- packet replay after current state changes;
- communication webhook dedupe;
- no `ai_draft` promotion to source-backed;
- no start-ready with open required requirements.

### Authorization

- verified session required;
- clinician accesses only own records;
- employer membership derived server-side;
- foreign and unknown responses indistinguishable;
- headers cannot choose tenant scope;
- provider webhook signature verification and replay protection.

### Browser

- hot apply desktop/mobile/keyboard/reduced-motion/no-JS reading order;
- cold apply preserves request context through sign-up and NPI composer;
- exact field-level consent before submit;
- revoked consent disables packet/issuer actions;
- employer sees receipt and limitation, not false completion;
- mission surfaces show the actionable blocker rather than a generic dashboard.

## 12. Success measures

Instrument event-derived measures rather than unproven speed claims:

- packet created -> employer first viewed;
- first viewed -> head-start accepted;
- acceptance -> first missing requirement requested;
- request sent -> issuer response received;
- response received -> requirement dispositioned;
- acceptance -> start-ready;
- start-ready -> started;
- packet fields reused without re-entry;
- issuer touches per satisfied requirement;
- clinician duplicate-intake time avoided;
- employer days at risk before intended start.

The primary pilot outcome remains whether a source-attributed, clinician-controlled packet plus managed issuer relay reduces avoidable days before a qualified start.