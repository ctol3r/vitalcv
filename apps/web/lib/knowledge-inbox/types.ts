import type { FieldProvenance } from '../profile/provenance';

/**
 * GOD-3 Knowledge Inbox truth contract (LIVE-100x cleanup).
 *
 * Two non-negotiables encoded in this type module:
 *   1. Classifier output never means verified. Every classification
 *      carries provenance, verificationStatus, proofTier, and an
 *      explicit decisionGrade flag that must remain false.
 *   2. Accepting a classification only adds profile context — it
 *      cannot upgrade the proof tier or imply employer-ready proof.
 */

export type KnowledgeInboxItemType =
  | 'identity'
  | 'contact'
  | 'location'
  | 'education'
  | 'training'
  | 'license'
  | 'boardCertification'
  | 'workHistory'
  | 'affiliation'
  | 'research'
  | 'publication'
  | 'document'
  | 'unknown';

export type KnowledgeInboxStatus =
  | 'captured'
  | 'classified'
  | 'needs_review'
  | 'suggested_to_profile'
  | 'accepted_to_profile'
  | 'rejected'
  | 'needs_source_evidence'
  | 'verified_by_source';

/**
 * Proof tier that a classification or accepted suggestion can be in.
 *
 *   claim_candidate            — text was classified into a category;
 *                                no source evidence has been attached.
 *   needs_source_evidence      — explicit gate: a state-board or
 *                                specialty-board check is required
 *                                before the claim can move forward.
 *   profile_context_only       — accepted into the clinician's
 *                                profile context. NOT employer-ready
 *                                proof; reviewers still see the limit.
 *   source_backed              — only set by a downstream source check
 *                                with a real receipt. The classifier
 *                                never returns this value, and the
 *                                acceptInboxSuggestion helper never
 *                                sets it.
 */
export type KnowledgeInboxProofTier =
  | 'claim_candidate'
  | 'needs_source_evidence'
  | 'profile_context_only'
  | 'source_backed';

/**
 * Verification posture of a classified item.
 *
 *   not_source_verified  — text claim only, no source check ran.
 *   needs_source_evidence — text claim + an explicit "needs source"
 *                          gate (license, board cert, etc.).
 *   source_verified      — only set by a real downstream source check.
 */
export type KnowledgeInboxVerificationStatus =
  | 'not_source_verified'
  | 'needs_source_evidence'
  | 'source_verified';

export interface KnowledgeInboxItem {
  itemId: string;
  clinicianId?: string;
  subjectId?: string;
  title: string;
  rawText?: string;
  summary?: string;
  itemType: KnowledgeInboxItemType;
  status: KnowledgeInboxStatus;
  provenance: FieldProvenance;
  confidence: string;
  sourceLabel?: string;
  createdAt: string;
  updatedAt: string;
  suggestedProfileSection?: string;
  suggestedGraphNode?: string;
  suggestedEdges?: string[];
  /** See KnowledgeInboxVerificationStatus — never narrowed to plain string. */
  verificationStatus: KnowledgeInboxVerificationStatus;
  /** See KnowledgeInboxProofTier. */
  proofTier: KnowledgeInboxProofTier;
  /** Always false unless source evidence has attached. */
  decisionGrade: boolean;
  limitationNote?: string;
  nextAction?: string;
}

export interface KnowledgeInboxClassification {
  itemType: KnowledgeInboxItemType;
  confidence: string;
  /** Required: every classification declares its provenance up front. */
  provenance: FieldProvenance;
  /** Required: never source_verified from classification alone. */
  verificationStatus: Exclude<KnowledgeInboxVerificationStatus, 'source_verified'>;
  /** Required: claim_candidate or needs_source_evidence — never source_backed. */
  proofTier: Exclude<KnowledgeInboxProofTier, 'source_backed'>;
  /** Always false at classification time. */
  decisionGrade: false;
  suggestedProfileSection?: string;
  suggestedGraphNode?: string;
  limitationNote?: string;
  nextAction?: string;
}

/**
 * Output of acceptInboxSuggestion. Keeps decisionGrade false and
 * keeps proofTier capped at profile_context_only. The accept helper
 * cannot create source evidence, cannot create a PSV receipt, and
 * cannot mark anything verified.
 */
export interface AcceptedKnowledgeInboxSuggestion {
  itemType: KnowledgeInboxItemType;
  suggestedProfileSection?: string;
  provenance: FieldProvenance;
  proofTier: 'profile_context_only';
  decisionGrade: false;
  verificationStatus: 'not_source_verified';
  limitationNote?: string;
}
