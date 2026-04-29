/**
 * FOUNDATION-SWEEP-5 — publication / research foundation.
 *
 * Truth invariants:
 *   1. PubMed candidates are NOT verified by default. Every candidate
 *      lands as `candidate_unmatched` — author / NPI / person
 *      disambiguation is a separate, later wave.
 *   2. Manual entries are `user_entered`, with `verified: false`.
 *   3. Source-backed publication evidence is FUTURE-STATE unless real
 *     source metadata exists. The typed `verified: false` invariant
 *     prevents a foundation row from claiming verification.
 *   4. ORCID / Crossref / OpenAlex are listed as candidate sources —
 *      they would each ship via their own wave; none are wired today.
 */

export type PublicationSourceKind =
  | 'PubMed'
  | 'ORCID'
  | 'Crossref'
  | 'OpenAlex'
  | 'manual_entry';

export type PublicationCandidateStatus =
  | 'candidate_unmatched'
  | 'candidate_matched_pending_review'
  | 'source_backed_pending_verification'
  | 'user_entered'
  | 'unknown';

export interface PublicationCandidate {
  /** Stable id assigned by this foundation; not a database PK. */
  id: string;
  source: PublicationSourceKind;
  title: string;
  /** Year if known; otherwise null. */
  year: number | null;
  /** Source-specific identifier (PubMed ID, DOI, ORCID work ID, etc.). */
  externalId: string | null;
  status: PublicationCandidateStatus;
  /** Always false from this foundation. Verification is a separate wave. */
  verified: false;
  /** Required: source/person disambiguation step pending. */
  requiresDisambiguation: boolean;
}

export interface ResearchProfileFoundation {
  /** Are PubMed candidates verified by default? Always false. */
  pubmedCandidatesVerifiedByDefault: false;
  /** Is publication source-backed verification implemented? Always false. */
  sourceBackedVerificationImplemented: false;
  /** Catalog of supported source kinds — none of which ship live. */
  supportedSources: PublicationSourceKind[];
  /** UI disclaimers rendered verbatim. */
  disclaimers: string[];
}

export interface ResearchProfileReadiness {
  /** Number of candidates in the foundation surface. */
  candidateCount: number;
  /** Number of candidates that already have an attempted match. */
  matchedPendingReviewCount: number;
  /** Number of user-entered (manual) entries. */
  userEnteredCount: number;
  /** Always false in this foundation. */
  verifiedCount: 0;
  /** Plain-language summary suitable for the route header. */
  summary: string;
}

const SUPPORTED_SOURCES: PublicationSourceKind[] = [
  'PubMed',
  'ORCID',
  'Crossref',
  'OpenAlex',
  'manual_entry',
];

const DISCLAIMERS = [
  'PubMed entries are publication candidates until source-backed matching is attached.',
  'Author / NPI / person disambiguation is required before any "yours" claim can be made.',
  'Manual research entries are user-entered until a source-backed check upgrades them.',
  'Source-backed publication verification is a separate, later wave.',
];

export function buildResearchProfileFoundation(): ResearchProfileFoundation {
  return {
    pubmedCandidatesVerifiedByDefault: false,
    sourceBackedVerificationImplemented: false,
    supportedSources: [...SUPPORTED_SOURCES],
    disclaimers: [...DISCLAIMERS],
  };
}

export function explainPublicationCandidateStatus(status: PublicationCandidateStatus): string {
  switch (status) {
    case 'candidate_unmatched':
      return 'Candidate record from a public source. Not matched to this clinician yet.';
    case 'candidate_matched_pending_review':
      return 'Candidate has an attempted author/person match. A reviewer must confirm before display as "yours".';
    case 'source_backed_pending_verification':
      return 'A source-of-record check returned metadata. Verification of authorship is still pending.';
    case 'user_entered':
      return 'Entered manually by the clinician. Self-attested, not verified.';
    case 'unknown':
      return 'No status recorded for this candidate.';
  }
}

export function getResearchProfileReadiness(
  candidates: readonly PublicationCandidate[],
): ResearchProfileReadiness {
  const candidateCount = candidates.length;
  const matchedPendingReviewCount = candidates.filter(
    (c) => c.status === 'candidate_matched_pending_review',
  ).length;
  const userEnteredCount = candidates.filter((c) => c.status === 'user_entered').length;
  let summary: string;
  if (candidateCount === 0) {
    summary = 'No publication candidates on file.';
  } else if (matchedPendingReviewCount === 0) {
    summary = `${candidateCount} candidate${candidateCount === 1 ? '' : 's'} unmatched. Disambiguation pending.`;
  } else {
    summary = `${candidateCount} candidates · ${matchedPendingReviewCount} pending reviewer confirmation · ${userEnteredCount} user-entered.`;
  }
  return {
    candidateCount,
    matchedPendingReviewCount,
    userEnteredCount,
    verifiedCount: 0,
    summary,
  };
}

/** Build a sample candidate set for the route to render. Useful for tests too. */
export function buildSamplePublicationCandidates(): PublicationCandidate[] {
  return [
    {
      id: 'pub-1',
      source: 'PubMed',
      title: 'Sample title — disambiguation pending',
      year: 2024,
      externalId: '00000000',
      status: 'candidate_unmatched',
      verified: false,
      requiresDisambiguation: true,
    },
    {
      id: 'pub-2',
      source: 'ORCID',
      title: 'Sample ORCID work — match attempted',
      year: 2023,
      externalId: '0000-0000-0000-0000',
      status: 'candidate_matched_pending_review',
      verified: false,
      requiresDisambiguation: true,
    },
    {
      id: 'pub-3',
      source: 'manual_entry',
      title: 'Manually entered publication',
      year: 2022,
      externalId: null,
      status: 'user_entered',
      verified: false,
      requiresDisambiguation: false,
    },
  ];
}
