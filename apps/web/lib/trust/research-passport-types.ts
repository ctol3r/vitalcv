/**
 * Wave 12: Frontend type layer for Research Identity data.
 *
 * These types mirror the domain contracts in packages/domain-common/researchContracts.ts.
 * Defined locally to avoid adding @vitalcv/domain-common as a web app dependency.
 * When the backend wires research data into PassportData, these can be replaced
 * with re-exports from the shared package.
 */

export interface PubMedArticle {
  readonly pmid: string;
  readonly title: string;
  readonly journal: string;
  readonly publicationDate: string;
  readonly authorPosition: 'first' | 'last' | 'middle';
  readonly doi?: string;
}

export type OrcidVerificationStatus = 'VERIFIED' | 'PENDING' | 'UNLINKED';

export interface OrcidAffiliation {
  readonly organizationName: string;
  readonly role: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

export interface OrcidProfile {
  readonly clinicianId: string;
  readonly orcidId: string;
  readonly verificationStatus: OrcidVerificationStatus;
  readonly displayName: string;
  readonly works: readonly { readonly title: string; readonly type: string; readonly publicationDate?: string; readonly doi?: string }[];
  readonly affiliations: readonly OrcidAffiliation[];
  readonly fetchedAt: string;
}

export type ClinicalTrialRole = 'PRINCIPAL_INVESTIGATOR' | 'SUB_INVESTIGATOR' | 'STUDY_DIRECTOR' | 'STUDY_CHAIR';
export type ClinicalTrialPhase = 'EARLY_PHASE1' | 'PHASE1' | 'PHASE2' | 'PHASE3' | 'PHASE4' | 'NA';
export type ClinicalTrialStatus =
  | 'RECRUITING' | 'ACTIVE_NOT_RECRUITING' | 'COMPLETED' | 'TERMINATED'
  | 'WITHDRAWN' | 'SUSPENDED' | 'NOT_YET_RECRUITING' | 'UNKNOWN';

export interface ClinicalTrialRecord {
  readonly nctId: string;
  readonly title: string;
  readonly phase: ClinicalTrialPhase;
  readonly status: ClinicalTrialStatus;
  readonly role: ClinicalTrialRole;
  readonly sponsor: string;
  readonly startDate?: string;
  readonly completionDate?: string;
}

export interface ResearchActivityScore {
  readonly clinicianId: string;
  readonly score: number;
  readonly publicationCount: number;
  readonly firstAuthorCount: number;
  readonly activeTrialCount: number;
  readonly completedTrialCount: number;
  readonly orcidVerified: boolean;
  readonly computedAt: string;
}

export interface ResearchDisclosurePreferences {
  readonly showPublications: boolean;
  readonly showTrials: boolean;
  readonly showOrcid: boolean;
  readonly showResearchScore: boolean;
}

export interface PassportResearchData {
  publications: readonly PubMedArticle[];
  orcid: OrcidProfile | null;
  trials: readonly ClinicalTrialRecord[];
  activityScore: ResearchActivityScore | null;
  disclosurePreferences: ResearchDisclosurePreferences;
}
