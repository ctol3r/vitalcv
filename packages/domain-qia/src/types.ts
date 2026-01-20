/**
 * Domain types for Qualified Identity Assertions (QIA).
 *
 * Pure TypeScript only. No cryptography or persistence.
 */

export type CredentialRef = string;
export type EvidenceRef = string;

export interface SignatureEnvelope {
  readonly algorithm: string;
  readonly key_id: string;
  readonly signature: string;
  readonly signed_at?: Date;
}

export interface SubjectRef {
  readonly subject_id: string;
  readonly subject_type?: string;
}

export interface AuthorityRef {
  readonly authority_id: string;
  readonly authority_kind?: string;
}

export interface QiaTemporalBounds {
  readonly issued_at: Date;
  readonly not_before?: Date;
  readonly expires_at: Date;
}

export interface FreshnessProof {
  readonly proven_at: Date;
  readonly max_age_seconds: number;
  readonly evidence_refs?: readonly EvidenceRef[];
}

export type TrustGradientBand = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TrustGradientComponents {
  readonly confidence: number;
  readonly freshness: number;
  readonly dispute_history: number;
  readonly corroboration_density: number;
}

export interface TrustGradient {
  readonly score: number;
  readonly band: TrustGradientBand;
  readonly components: TrustGradientComponents;
}

export interface TrustGradientInput {
  readonly confidence: number;
  readonly freshness_age_seconds: number;
  readonly freshness_max_age_seconds: number;
  readonly dispute_count: number;
  readonly corroboration_density: number;
}

export enum QiaEventType {
  ISSUE = 'ISSUE',
  REFRESH = 'REFRESH',
  REVOKE = 'REVOKE',
  DISPUTE = 'DISPUTE',
}

export interface QiaEvent {
  readonly event_id: string;
  readonly qia_id: string;
  readonly event_type: QiaEventType;
  readonly occurred_at: Date;
  readonly effective_at?: Date;
  readonly reason?: string;
  readonly evidence_refs?: readonly EvidenceRef[];
}

export enum DecisionEventType {
  CREATE = 'CREATE',
  REPLAY = 'REPLAY',
  OVERRIDE = 'OVERRIDE',
  REVOKE = 'REVOKE',
}

export interface DecisionEvent {
  readonly event_id: string;
  readonly capsule_id: string;
  readonly event_type: DecisionEventType;
  readonly occurred_at: Date;
  readonly supersedes_event_id?: string;
  readonly reason?: string;
}

export class DomainQiaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainQiaError';
  }
}

export class QiaInvariantError extends DomainQiaError {
  constructor(message: string) {
    super(message);
    this.name = 'QiaInvariantError';
  }
}

export class AmbiguousQiaStateError extends DomainQiaError {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousQiaStateError';
  }
}

export class TrustGradientError extends DomainQiaError {
  constructor(message: string) {
    super(message);
    this.name = 'TrustGradientError';
  }
}
