import type { FieldProvenance } from '../profile/provenance';

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
  verificationStatus: string;
  limitationNote?: string;
  nextAction?: string;
}

export interface KnowledgeInboxClassification {
  itemType: KnowledgeInboxItemType;
  confidence: string;
  suggestedProfileSection?: string;
  suggestedGraphNode?: string;
  limitationNote?: string;
  nextAction?: string;
}
