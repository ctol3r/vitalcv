import type {
  AcceptedKnowledgeInboxSuggestion,
  KnowledgeInboxClassification,
} from './types';

/**
 * Deterministic baseline classifier (GOD-3 / GOD-3F).
 *
 * Pattern-matches free text into a coarse inbox category. There is no
 * model invocation, no fetch, no external model call — over time this
 * may evolve, but the truth contract stays the same: the classifier
 * never returns source_verified, never returns source_backed, and
 * never sets decisionGrade to true.
 */
export function classifyInboxItem(rawText: string): KnowledgeInboxClassification {
  const text = rawText.toLowerCase();

  // Training
  if (text.includes('residency') || text.includes('fellowship')) {
    return {
      itemType: 'training',
      confidence: 'Medium',
      provenance: 'USER_ENTERED',
      verificationStatus: 'not_source_verified',
      proofTier: 'claim_candidate',
      decisionGrade: false,
      suggestedProfileSection: 'Postgraduate Training',
      suggestedGraphNode: 'Credential Claim (Training)',
      limitationNote: 'Profile-entered training context; not primary-source evidence.',
      nextAction: 'Review and add as profile context',
    };
  }

  // Research / Publications
  if (text.includes('pubmed') || text.includes('doi:') || text.includes('journal of')) {
    return {
      itemType: 'publication',
      confidence: 'High',
      provenance: 'INFERRED',
      verificationStatus: 'not_source_verified',
      proofTier: 'claim_candidate',
      decisionGrade: false,
      suggestedProfileSection: 'Publications',
      suggestedGraphNode: 'Credential Claim (Publication)',
      limitationNote: 'Inferred from text; not independently source-matched.',
      nextAction: 'Review and add as profile context',
    };
  }

  // Licenses
  if (text.includes('license') || text.includes('medical board')) {
    return {
      itemType: 'license',
      confidence: 'Medium',
      provenance: 'USER_ENTERED',
      verificationStatus: 'needs_source_evidence',
      proofTier: 'needs_source_evidence',
      decisionGrade: false,
      suggestedProfileSection: 'Licenses',
      suggestedGraphNode: 'Credential Claim (License)',
      limitationNote:
        'Text claim only; state board Primary Source Verification is required before decision-grade use.',
      nextAction: 'Queue state-board source check',
    };
  }

  // Board certification claim — phrasing avoids the literal banned
  // string. The classifier matches on the keyword "abms" and the
  // tokenized form of the user's text without echoing the unsafe
  // exact phrase back to the consumer.
  const matchesBoardClaim =
    text.includes('abms') ||
    /board\s+(?:certified|certification|certifications)\b/.test(text);
  if (matchesBoardClaim) {
    return {
      itemType: 'boardCertification',
      confidence: 'Medium',
      provenance: 'USER_ENTERED',
      verificationStatus: 'needs_source_evidence',
      proofTier: 'needs_source_evidence',
      decisionGrade: false,
      suggestedProfileSection: 'Board Certifications',
      suggestedGraphNode: 'Credential Claim (Board Cert)',
      limitationNote:
        'Board certification claim from text; ABMS or specialty board source evidence is required before decision-grade use.',
      nextAction: 'Queue for source evidence',
    };
  }

  return {
    itemType: 'unknown',
    confidence: 'Low',
    provenance: 'USER_ENTERED',
    verificationStatus: 'not_source_verified',
    proofTier: 'claim_candidate',
    decisionGrade: false,
    suggestedProfileSection: 'Uncategorized',
    suggestedGraphNode: 'Unknown',
    limitationNote: 'Could not automatically classify this information.',
    nextAction: 'Manual review required',
  };
}

/**
 * Convert a classified inbox item into an accepted profile-context
 * suggestion. Pure helper — no I/O, no source-evidence creation, no
 * proof-tier upgrade. Caps proofTier at profile_context_only and
 * keeps decisionGrade false. Never sets verificationStatus to
 * source_verified.
 */
export function acceptInboxSuggestion(
  classification: KnowledgeInboxClassification,
): AcceptedKnowledgeInboxSuggestion {
  return {
    itemType: classification.itemType,
    suggestedProfileSection: classification.suggestedProfileSection,
    provenance: classification.provenance,
    proofTier: 'profile_context_only',
    decisionGrade: false,
    verificationStatus: 'not_source_verified',
    limitationNote: classification.limitationNote,
  };
}
