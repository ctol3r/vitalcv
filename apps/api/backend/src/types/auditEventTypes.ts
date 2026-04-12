/**
 * Canonical audit event type union.
 *
 * Single source of truth for all AuditEvent.type values across the backend.
 * Every AuditEvent.create() call MUST use one of these values.
 *
 * Wave 33: Consolidated from fragmented unions in app.ts, verification/audit.ts,
 * monitoringEngine.ts, wedge.ts, and errorHandler.ts.
 */

// ── Verification lifecycle ───────────────────────────────────
export type VerificationEventType =
  | 'VERIFICATION_REQUESTED'
  | 'VERIFICATION_COMPLETED'
  | 'VERIFICATION_FAILED';

// ── Monitoring ───────────────────────────────────────────────
export type MonitoringEventType = 'MONITORING_STATUS_CHANGE';

// ── Artifact lifecycle ───────────────────────────────────────
export type ArtifactEventType =
  | 'ARTIFACT_VIEWED'
  | 'ARTIFACT_EXPORTED'
  | 'BUNDLE_GENERATED';

// ── Employer review lifecycle ───────────────────────────────
export type EmployerReviewEventType =
  | 'EMPLOYER_REVIEW_ACCEPTED'
  | 'EMPLOYER_REVIEW_REFRESH_REQUESTED'
  | 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW'
  | 'EMPLOYER_PACKET_SHARED'
  | 'APPLICATION_MISSING_INFO_REQUESTED'
  | 'APPLICATION_MISSING_INFO_CLOSED';

// ── Trust chain (wedge domain) ───────────────────────────────
export type TrustChainEventType =
  | 'RECOGNITION_EMITTED'
  | 'ACCEPTANCE_EMITTED'
  | 'START_EMITTED'
  // Wave 41: Start Attestation Engine
  | 'START_ATTESTED';

// ── Operational / error tracking ─────────────────────────────
export type OperationalEventType =
  | 'RATE_LIMIT_HIT'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'TRUST_STATE_CHECK';

// ── Research identity layer (Wave 12) ───────────────────────
export type ResearchEventType =
  | 'RESEARCH_PUBMED_FETCHED'
  | 'RESEARCH_ORCID_LINKED'
  | 'RESEARCH_ORCID_UNLINKED'
  | 'RESEARCH_TRIALS_FETCHED'
  | 'RESEARCH_SCORE_COMPUTED'
  | 'RESEARCH_DISCLOSURE_UPDATED';

// ── Canonical union ──────────────────────────────────────────
export type AuditEventType =
  | VerificationEventType
  | MonitoringEventType
  | ArtifactEventType
  | EmployerReviewEventType
  | TrustChainEventType
  | OperationalEventType
  | ResearchEventType;
