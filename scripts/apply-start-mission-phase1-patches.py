from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one match in {path}, found {count}")
    file.write_text(text.replace(old, new, 1))


schema_path = "apps/api/backend/prisma/schema.prisma"

replace_once(
    schema_path,
    '''model VerificationRequest {
  requestId     String                    @id @default(uuid()) @db.Uuid
  clinicianId   String
  lane          String
  source        String
  attestorId    String?
  documentHash  String?
  subject       String
  status        VerificationRequestStatus @default(PENDING)
  createdAt     DateTime                  @default(now())
  completedAt   DateTime?
  receiptId     String?
  failureReason String?

  @@index([clinicianId])
  @@index([status])
  @@index([createdAt])
}
''',
    '''model VerificationRequest {
  requestId     String                    @id @default(uuid()) @db.Uuid
  clinicianId   String
  lane          String
  source        String
  attestorId    String?
  documentHash  String?
  subject       String
  status        VerificationRequestStatus @default(PENDING)
  createdAt     DateTime                  @default(now())
  completedAt   DateTime?
  receiptId     String?
  failureReason String?

  // Start Mission linkage. Nullable preserves every legacy manual PSV request.
  applicationId           String?  @map("application_id") @db.Uuid
  startActivationId       String?  @map("start_activation_id") @db.Uuid
  activationRequirementId String?  @map("activation_requirement_id") @db.Uuid
  organizationId          String?  @map("organization_id") @db.Uuid
  issuerId                String?  @map("issuer_id")
  requestedClaim          String?  @map("requested_claim")
  purpose                 String?
  authorizationConsentId  String?  @map("authorization_consent_id") @db.Uuid
  preferredChannel        String?  @map("preferred_channel")
  dueAt                   DateTime? @map("due_at")
  nextFollowUpAt          DateTime? @map("next_follow_up_at")
  attemptCount            Int      @default(0) @map("attempt_count")
  assignedTo              String?  @map("assigned_to")
  idempotencyKey          String?  @unique @map("idempotency_key")
  updatedAt               DateTime @default(now()) @updatedAt @map("updated_at")

  @@index([clinicianId])
  @@index([status])
  @@index([createdAt])
  @@index([applicationId, status])
  @@index([startActivationId, status])
  @@index([activationRequirementId])
  @@index([issuerId, status])
  @@index([nextFollowUpAt, status])
}
''',
)

replace_once(
    schema_path,
    '''  consentAt            DateTime  @map("consent_at")
  consentReceiptId     String    @map("consent_receipt_id")
  /// PR J5b — the opportunity version (updatedAt at seal time) the application
''',
    '''  consentAt            DateTime  @map("consent_at")
  consentReceiptId     String    @map("consent_receipt_id")
  /// First-class consent binding for packets sealed after Start Mission Phase 1.
  /// NULL means the legacy packet predates ConsentGrant and MUST be omitted from
  /// canonical replay bytes, exactly like a legacy opportunityVersion.
  consentGrantId       String?   @map("consent_grant_id") @db.Uuid
  /// PR J5b — the opportunity version (updatedAt at seal time) the application
''',
)

replace_once(
    schema_path,
    '''model StartActivation {
  id              String    @id @default(uuid()) @db.Uuid
  clinicianNpi    String    @map("clinician_npi")
  orgId           String    @map("org_id")
  acceptanceId    String?   @map("acceptance_id")
  role            String?
  activationState String    @default("NOT_STARTABLE") @map("activation_state")
  createdAt       DateTime  @default(now()) @map("created_at")
  activatedAt     DateTime? @map("activated_at")
  metadata        Json?

  @@index([clinicianNpi])
  @@index([orgId])
  @@index([acceptanceId])
  @@index([activationState])
  @@map("start_activations")
}
''',
    '''model StartActivation {
  id                 String    @id @default(uuid()) @db.Uuid
  clinicianNpi       String    @map("clinician_npi")
  orgId              String    @map("org_id")
  acceptanceId       String?   @map("acceptance_id")
  role               String?
  activationState    String    @default("NOT_STARTABLE") @map("activation_state")
  createdAt          DateTime  @default(now()) @map("created_at")
  activatedAt        DateTime? @map("activated_at")
  metadata           Json?

  // StartMission is a domain aggregate over this sidecar, not a competing table.
  applicationId      String?   @unique @map("application_id") @db.Uuid
  opportunityId      String?   @map("opportunity_id") @db.Uuid
  acceptedPacketId   String?   @map("accepted_packet_id") @db.Uuid
  acceptedPacketHash String?   @map("accepted_packet_hash")
  intendedStartDate  DateTime? @map("intended_start_date")
  urgency            String    @default("routine")
  policyVersion      String?   @map("policy_version")
  updatedAt          DateTime  @default(now()) @updatedAt @map("updated_at")

  @@index([clinicianNpi])
  @@index([orgId])
  @@index([acceptanceId])
  @@index([activationState])
  @@index([opportunityId])
  @@index([activationState, intendedStartDate])
  @@map("start_activations")
}

/// A field/claim-scoped authorization. Revocation is a state, never a deletion.
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
  metadata              Json      @default("{}")
  createdAt             DateTime  @default(now()) @map("created_at")

  @@index([clinicianUserId, grantedAt])
  @@index([organizationId, grantedAt])
  @@index([applicationId])
  @@index([startActivationId])
  @@index([verificationRequestId])
  @@map("consent_grants")
}

/// Append-only correspondence ledger. Raw content remains in encrypted storage;
/// this table keeps minimum-necessary summaries, hashes, provider ids and scope.
model CommunicationEvent {
  id                      String   @id @default(uuid()) @db.Uuid
  startActivationId       String?  @map("start_activation_id") @db.Uuid
  applicationId           String?  @map("application_id") @db.Uuid
  verificationRequestId   String?  @map("verification_request_id") @db.Uuid
  activationRequirementId String?  @map("activation_requirement_id") @db.Uuid
  organizationId          String?  @map("organization_id") @db.Uuid
  clinicianId             String?  @map("clinician_id")
  issuerId                String?  @map("issuer_id")
  direction               String
  channel                 String
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
  auditEventId            String   @unique @map("audit_event_id") @db.Uuid
  metadata                Json     @default("{}")
  createdAt               DateTime @default(now()) @map("created_at")

  @@unique([channel, providerMessageId], map: "communication_events_channel_provider_message_uq")
  @@index([verificationRequestId, occurredAt])
  @@index([startActivationId, occurredAt])
  @@index([threadKey, occurredAt])
  @@index([issuerId, occurredAt])
  @@map("communication_events")
}

/// Immutable transport receipt. Delivery is not employer review or acceptance.
model HandoffReceipt {
  id                      String    @id @default(uuid()) @db.Uuid
  handoffId               String    @map("handoff_id") @db.Uuid
  attemptNumber           Int       @map("attempt_number")
  applicationId           String?   @map("application_id") @db.Uuid
  startActivationId       String?   @map("start_activation_id") @db.Uuid
  verificationRequestId   String?   @map("verification_request_id") @db.Uuid
  communicationEventId    String?   @map("communication_event_id") @db.Uuid
  consentGrantId          String    @map("consent_grant_id") @db.Uuid
  packetId                String?   @map("packet_id") @db.Uuid
  packetHash              String?   @map("packet_hash")
  payloadHash             String    @map("payload_hash")
  recipientOrganizationId String?   @map("recipient_organization_id") @db.Uuid
  recipient               String
  purpose                 String
  channel                 String
  transportProvider       String?   @map("transport_provider")
  providerMessageId       String?   @map("provider_message_id")
  status                  String
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
''',
)

replace_once(
    schema_path,
    '''enum VerificationRequestStatus {
  PENDING
  COMPLETE
  FAILED
}
''',
    '''enum VerificationRequestStatus {
  // Legacy manual PSV compatibility values — never rewrite historic rows.
  PENDING
  COMPLETE
  FAILED

  // Start Mission request lifecycle (additive).
  DRAFT
  AWAITING_AUTHORIZATION
  READY_TO_SEND
  SENT
  DELIVERED
  AWAITING_RESPONSE
  RESPONSE_RECEIVED
  UNDER_REVIEW
  SATISFIED
  PARTIALLY_SATISFIED
  UNABLE_TO_VERIFY
  CANCELLED
}
''',
)

packet_service = "apps/api/backend/src/services/opportunities/applicationPacketService.ts"
replace_once(
    packet_service,
    '''  consentAt: string;
  consentReceiptId: string;
  /**
   * The opportunity version the application was sealed against (its updatedAt at
''',
    '''  consentAt: string;
  consentReceiptId: string;
  /**
   * First-class grant binding. Omitted for legacy packets so their canonical
   * bytes and stored hashes remain exactly unchanged.
   */
  consentGrantId?: string;
  /**
   * The opportunity version the application was sealed against (its updatedAt at
''',
)

packet_read = "apps/api/backend/src/services/opportunities/applicationPacketReadService.ts"
replace_once(
    packet_read,
    '''    consentAt: string;
    consentReceiptId: string;
    selectedSections: string[];
''',
    '''    consentAt: string;
    consentReceiptId: string;
    consentGrantId: string | null;
    selectedSections: string[];
''',
)
replace_once(
    packet_read,
    '''  consentAt: Date;
  consentReceiptId: string;
  /** null for legacy packets sealed before this column existed. */
  opportunityVersion: string | null;
''',
    '''  consentAt: Date;
  consentReceiptId: string;
  /** null for legacy packets sealed before first-class grants existed. */
  consentGrantId: string | null;
  /** null for legacy packets sealed before this column existed. */
  opportunityVersion: string | null;
''',
)
replace_once(
    packet_read,
    '''    consentAt: row.consentAt.toISOString(),
    consentReceiptId: row.consentReceiptId,
    // CRITICAL for legacy replay: a null column (packet sealed before this
''',
    '''    consentAt: row.consentAt.toISOString(),
    consentReceiptId: row.consentReceiptId,
    // A null grant column predates ConsentGrant and must be omitted from the
    // canonical bytes. New packets include the id and bind it into the seal.
    consentGrantId: row.consentGrantId ?? undefined,
    // CRITICAL for legacy replay: a null column (packet sealed before this
''',
)
replace_once(
    packet_read,
    '''      consentAt: packet.consentAt,
      consentReceiptId: packet.consentReceiptId,
      selectedSections: packet.selectedSections,
''',
    '''      consentAt: packet.consentAt,
      consentReceiptId: packet.consentReceiptId,
      consentGrantId: packet.consentGrantId ?? null,
      selectedSections: packet.selectedSections,
''',
)

print("Phase 1 schema and packet patches applied.")
