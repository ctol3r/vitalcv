import type { KnowledgeInboxClassification } from './types';

/**
 * Deterministic baseline classifier.
 * Over time, this shifts to a true ML/LLM classifier. For now,
 * this enforces the strict provenance boundaries so we don't
 * hallucinate "verified" facts out of free text.
 */
export function classifyInboxItem(rawText: string): KnowledgeInboxClassification {
  const text = rawText.toLowerCase();

  // Training
  if (text.includes('residency') || text.includes('fellowship')) {
    return {
      itemType: 'training',
      confidence: 'Medium',
      suggestedProfileSection: 'Postgraduate Training',
      suggestedGraphNode: 'Credential Claim (Training)',
      limitationNote: 'Self-reported training history; not PSV verified.',
      nextAction: 'Review and accept to profile',
    };
  }

  // Research / Publications
  if (text.includes('pubmed') || text.includes('doi:') || text.includes('journal of')) {
    return {
      itemType: 'publication',
      confidence: 'High',
      suggestedProfileSection: 'Publications',
      suggestedGraphNode: 'Credential Claim (Publication)',
      limitationNote: 'Inferred from text; not independently verified.',
      nextAction: 'Review and accept to profile',
    };
  }

  // Licenses
  if (text.includes('license') || text.includes('medical board')) {
    return {
      itemType: 'license',
      confidence: 'Medium',
      suggestedProfileSection: 'Licenses',
      suggestedGraphNode: 'Credential Claim (License)',
      limitationNote: 'Requires state board Primary Source Verification to reach decision-grade.',
      nextAction: 'Queue for PSV verification',
    };
  }

  // Board Certifications
  if (text.includes('board certified') || text.includes('abms')) {
    return {
      itemType: 'boardCertification',
      confidence: 'Medium',
      suggestedProfileSection: 'Board Certifications',
      suggestedGraphNode: 'Credential Claim (Board Cert)',
      limitationNote: 'User-entered claim; requires ABMS/Specialty board source evidence to become VERIFIED.',
      nextAction: 'Queue for source evidence',
    };
  }

  return {
    itemType: 'unknown',
    confidence: 'Low',
    suggestedProfileSection: 'Uncategorized',
    suggestedGraphNode: 'Unknown',
    limitationNote: 'Could not automatically classify this information.',
    nextAction: 'Manual review required',
  };
}
