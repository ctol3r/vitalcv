/**
 * Wave 12: Research Identity Layer — domain contracts.
 *
 * Defines immutable snapshot types for PubMed publications, ORCID profiles,
 * ClinicalTrials.gov trials, and the composite Research Activity Score.
 *
 * Zero PHI on-chain: these types carry publication metadata only (titles,
 * PMIDs, NCT IDs, roles) — never patient data.
 */

// ── PubMed ──────────────────────────────────────────────────────

export type PubMedArticle = Readonly<{
  pmid: string;
  title: string;
  journal: string;
  publicationDate: string; // YYYY-MM-DD or YYYY
  authorPosition: 'first' | 'last' | 'middle';
  doi?: string;
}>;

export type PubMedSearchResult = Readonly<{
  clinicianId: string;
  npi: string;
  query: string;
  articles: readonly PubMedArticle[];
  totalCount: number;
  fetchedAt: string; // RFC3339 UTC
}>;

// ── ORCID ───────────────────────────────────────────────────────

export type OrcidVerificationStatus = 'VERIFIED' | 'PENDING' | 'UNLINKED';

export type OrcidAffiliation = Readonly<{
  organizationName: string;
  role: string;
  startDate?: string;
  endDate?: string;
}>;

export type OrcidWork = Readonly<{
  title: string;
  type: string; // journal-article, conference-paper, etc.
  publicationDate?: string;
  doi?: string;
  externalIds: readonly Readonly<{ type: string; value: string }>[];
}>;

export type OrcidProfile = Readonly<{
  clinicianId: string;
  orcidId: string;
  verificationStatus: OrcidVerificationStatus;
  displayName: string;
  works: readonly OrcidWork[];
  affiliations: readonly OrcidAffiliation[];
  fetchedAt: string; // RFC3339 UTC
}>;

// ── ClinicalTrials.gov ──────────────────────────────────────────

export type ClinicalTrialRole = 'PRINCIPAL_INVESTIGATOR' | 'SUB_INVESTIGATOR' | 'STUDY_DIRECTOR' | 'STUDY_CHAIR';

export type ClinicalTrialPhase =
  | 'EARLY_PHASE1'
  | 'PHASE1'
  | 'PHASE2'
  | 'PHASE3'
  | 'PHASE4'
  | 'NA';

export type ClinicalTrialStatus =
  | 'RECRUITING'
  | 'ACTIVE_NOT_RECRUITING'
  | 'COMPLETED'
  | 'TERMINATED'
  | 'WITHDRAWN'
  | 'SUSPENDED'
  | 'NOT_YET_RECRUITING'
  | 'UNKNOWN';

export type ClinicalTrialRecord = Readonly<{
  nctId: string;
  title: string;
  phase: ClinicalTrialPhase;
  status: ClinicalTrialStatus;
  role: ClinicalTrialRole;
  sponsor: string;
  startDate?: string;
  completionDate?: string;
}>;

export type ClinicalTrialSearchResult = Readonly<{
  clinicianId: string;
  npi: string;
  query: string;
  trials: readonly ClinicalTrialRecord[];
  totalCount: number;
  fetchedAt: string; // RFC3339 UTC
}>;

// ── Research Activity Score ────────────────────────────────────

export type ResearchActivityScore = Readonly<{
  clinicianId: string;
  score: number; // 0–10
  publicationCount: number;
  firstAuthorCount: number;
  activeTrialCount: number;
  completedTrialCount: number;
  orcidVerified: boolean;
  computedAt: string; // RFC3339 UTC
}>;

// ── Selective Disclosure ───────────────────────────────────────

export type ResearchDisclosurePreferences = Readonly<{
  showPublications: boolean;
  showTrials: boolean;
  showOrcid: boolean;
  showResearchScore: boolean;
}>;
