/**
 * Wave 12: Research Identity Orchestrator.
 *
 * Coordinates PubMed, ORCID, and ClinicalTrials.gov adapters.
 * Computes the composite Research Activity Score.
 * Enforces the audit-before-2xx contract on every mutation.
 */

import { PubMedAdapter } from './pubmedAdapter';
import { OrcidAdapter } from './orcidAdapter';
import { ClinicalTrialsAdapter } from './clinicalTrialsAdapter';
import { computeResearchActivityScore } from './researchScoreEngine';
import { requireAuditBeforeResponse } from '../audit/auditService';
import { sha256ForPayload } from '../../utils/deterministic';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import type {
  PubMedSearchResult,
  OrcidProfile,
  ClinicalTrialSearchResult,
  ResearchActivityScore,
} from '@vitalcv/domain-common';

const pubmed = new PubMedAdapter();
const orcid = new OrcidAdapter();
const clinicalTrials = new ClinicalTrialsAdapter();

// ── PubMed ──────────────────────────────────────────────────────

export async function fetchPubMedPublications(
  clinicianId: string,
  npi: string,
  name: string,
  affiliation: string,
): Promise<PubMedSearchResult> {
  const result = await pubmed.searchByAuthor(name, affiliation, clinicianId, npi);

  await requireAuditBeforeResponse(prisma, {
    type: 'RESEARCH_PUBMED_FETCHED',
    hash: sha256ForPayload({ clinicianId, npi, query: result.query, totalCount: result.totalCount }),
    referenceId: clinicianId,
    clinicianId,
    metadata: {
      npi,
      query: result.query,
      articleCount: result.articles.length,
      totalCount: result.totalCount,
      fetchedAt: result.fetchedAt,
    },
  });

  return result;
}

// ── ORCID ───────────────────────────────────────────────────────

export function getOrcidAuthUrl(state: string): string {
  return orcid.generateAuthUrl(state);
}

export async function linkOrcidAccount(
  code: string,
  clinicianId: string,
): Promise<OrcidProfile> {
  const profile = await orcid.linkAccount(code, clinicianId);

  await requireAuditBeforeResponse(prisma, {
    type: 'RESEARCH_ORCID_LINKED',
    hash: sha256ForPayload({ clinicianId, orcidId: profile.orcidId }),
    referenceId: clinicianId,
    clinicianId,
    metadata: {
      orcidId: profile.orcidId,
      worksCount: profile.works.length,
      affiliationsCount: profile.affiliations.length,
      fetchedAt: profile.fetchedAt,
    },
  });

  return profile;
}

export async function unlinkOrcidAccount(clinicianId: string, orcidId: string): Promise<void> {
  await requireAuditBeforeResponse(prisma, {
    type: 'RESEARCH_ORCID_UNLINKED',
    hash: sha256ForPayload({ clinicianId, orcidId }),
    referenceId: clinicianId,
    clinicianId,
    metadata: { orcidId },
  });
}

// ── ClinicalTrials.gov ──────────────────────────────────────────

export async function fetchClinicalTrials(
  clinicianId: string,
  npi: string,
  name: string,
): Promise<ClinicalTrialSearchResult> {
  const result = await clinicalTrials.searchByInvestigator(npi, name, clinicianId);

  await requireAuditBeforeResponse(prisma, {
    type: 'RESEARCH_TRIALS_FETCHED',
    hash: sha256ForPayload({ clinicianId, npi, query: result.query, totalCount: result.totalCount }),
    referenceId: clinicianId,
    clinicianId,
    metadata: {
      npi,
      query: result.query,
      trialCount: result.trials.length,
      totalCount: result.totalCount,
      fetchedAt: result.fetchedAt,
    },
  });

  return result;
}

// ── Research Activity Score ────────────────────────────────────

export async function computeAndAuditResearchScore(
  clinicianId: string,
  pubmedResult: PubMedSearchResult | null,
  trialsResult: ClinicalTrialSearchResult | null,
  orcidVerified: boolean,
): Promise<ResearchActivityScore> {
  const score = computeResearchActivityScore({
    clinicianId,
    pubmed: pubmedResult,
    trials: trialsResult,
    orcidVerified,
  });

  await requireAuditBeforeResponse(prisma, {
    type: 'RESEARCH_SCORE_COMPUTED',
    hash: sha256ForPayload({ clinicianId, score: score.score, computedAt: score.computedAt }),
    referenceId: clinicianId,
    clinicianId,
    metadata: {
      score: score.score,
      publicationCount: score.publicationCount,
      firstAuthorCount: score.firstAuthorCount,
      activeTrialCount: score.activeTrialCount,
      completedTrialCount: score.completedTrialCount,
      orcidVerified: score.orcidVerified,
      computedAt: score.computedAt,
    },
  });

  return score;
}

// ── Full Research Profile ──────────────────────────────────────

export interface ResearchProfile {
  pubmed: PubMedSearchResult | null;
  trials: ClinicalTrialSearchResult | null;
  orcid: OrcidProfile | null;
  score: ResearchActivityScore;
}

/**
 * Fetch the full research profile for a clinician.
 * Runs PubMed + ClinicalTrials queries in parallel, then computes the composite score.
 */
export async function fetchFullResearchProfile(
  clinicianId: string,
  npi: string,
  name: string,
  affiliation: string,
  orcidProfile: OrcidProfile | null,
): Promise<ResearchProfile> {
  const [pubmedResult, trialsResult] = await Promise.allSettled([
    fetchPubMedPublications(clinicianId, npi, name, affiliation),
    fetchClinicalTrials(clinicianId, npi, name),
  ]);

  const pubmed = pubmedResult.status === 'fulfilled' ? pubmedResult.value : null;
  const trials = trialsResult.status === 'fulfilled' ? trialsResult.value : null;

  if (pubmedResult.status === 'rejected') {
    log('warn', 'research_pubmed_fetch_failed', { clinicianId, error: String(pubmedResult.reason) });
  }
  if (trialsResult.status === 'rejected') {
    log('warn', 'research_trials_fetch_failed', { clinicianId, error: String(trialsResult.reason) });
  }

  const score = await computeAndAuditResearchScore(
    clinicianId,
    pubmed,
    trials,
    orcidProfile?.verificationStatus === 'VERIFIED',
  );

  return { pubmed, trials, orcid: orcidProfile, score };
}
