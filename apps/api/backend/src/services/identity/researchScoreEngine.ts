/**
 * Wave 12: Research Activity Score Engine.
 *
 * Computes a 0–10 Research Activity Score based on:
 *   - Publication count and authorship positions (PubMed)
 *   - Active and completed clinical trials (ClinicalTrials.gov)
 *   - ORCID verification status
 *
 * Scoring rubric:
 *   Publications (max 4 points):
 *     - 1 point per 3 publications (up to 3 points)
 *     - +1 point if any first/last author position
 *
 *   Trials (max 4 points):
 *     - 1 point per active trial as PI (up to 2 points)
 *     - 1 point per 2 completed trials (up to 2 points)
 *
 *   ORCID (max 2 points):
 *     - 2 points if ORCID is verified and linked
 *
 * The score is additive (supplementary dimension), not blocking.
 */

import type { ResearchActivityScore, PubMedSearchResult, ClinicalTrialSearchResult } from '@vitalcv/domain-common';

interface ResearchScoreInput {
  clinicianId: string;
  pubmed: PubMedSearchResult | null;
  trials: ClinicalTrialSearchResult | null;
  orcidVerified: boolean;
}

export function computeResearchActivityScore(input: ResearchScoreInput): ResearchActivityScore {
  const { clinicianId, pubmed, trials, orcidVerified } = input;

  // ── Publication points (max 4) ─────────────────────────────
  const publicationCount = pubmed?.articles.length ?? 0;
  const firstAuthorCount = pubmed?.articles.filter((a) => a.authorPosition === 'first').length ?? 0;
  const lastAuthorCount = pubmed?.articles.filter((a) => a.authorPosition === 'last').length ?? 0;
  const hasLeadAuthorship = firstAuthorCount > 0 || lastAuthorCount > 0;

  const pubCountPoints = Math.min(3, Math.floor(publicationCount / 3));
  const pubLeadPoints = hasLeadAuthorship ? 1 : 0;
  const publicationPoints = Math.min(4, pubCountPoints + pubLeadPoints);

  // ── Trial points (max 4) ───────────────────────────────────
  const activeTrials = trials?.trials.filter(
    (t) => t.role === 'PRINCIPAL_INVESTIGATOR' && (t.status === 'RECRUITING' || t.status === 'ACTIVE_NOT_RECRUITING'),
  ) ?? [];
  const completedTrials = trials?.trials.filter((t) => t.status === 'COMPLETED') ?? [];
  const activeTrialCount = activeTrials.length;
  const completedTrialCount = completedTrials.length;

  const activeTrialPoints = Math.min(2, activeTrialCount);
  const completedTrialPoints = Math.min(2, Math.floor(completedTrialCount / 2));
  const trialPoints = Math.min(4, activeTrialPoints + completedTrialPoints);

  // ── ORCID points (max 2) ───────────────────────────────────
  const orcidPoints = orcidVerified ? 2 : 0;

  // ── Composite score ────────────────────────────────────────
  const score = Math.min(10, publicationPoints + trialPoints + orcidPoints);

  return Object.freeze({
    clinicianId,
    score,
    publicationCount,
    firstAuthorCount,
    activeTrialCount,
    completedTrialCount,
    orcidVerified,
    computedAt: new Date().toISOString(),
  });
}
