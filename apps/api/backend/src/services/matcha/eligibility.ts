/**
 * MATCHA Eligibility Engine
 *
 * Pure deterministic matching: (clinicianProfile, jobPostings) → matchedOpportunities[]
 * No side effects, no database access — swappable to real data sources later.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CredentialRequirementKey =
  | 'state_license'
  | 'board_cert'
  | 'dea'
  | 'npi'
  | 'malpractice'
  | 'sanctions_clear';

export type RequirementPriority = 'required' | 'preferred';

export interface CredentialRequirement {
  key: CredentialRequirementKey;
  label: string;
  priority: RequirementPriority;
  /** Required state for state_license (e.g. "CA") */
  state?: string;
  /** Required specialty for board_cert (e.g. "Cardiology") */
  specialty?: string;
}

export interface JobPosting {
  id: string;
  title: string;
  facility: string;
  employerSlug?: string;
  employer?: {
    slug?: string;
    name: string;
    trustScore?: number;
    hiringStatus?: string;
    timeToStart?: string;
  };
  askContext?: {
    employerSlug?: string;
    employerName: string;
    opportunityId: string;
  };
  location: string;
  department: string;
  compensation: string;
  startDate: string;
  requirements: CredentialRequirement[];
  postedAt: string;
}

export type ClaimLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type CredentialStatus = 'active' | 'expiring' | 'expired' | 'not_found';

export interface HeldCredential {
  key: CredentialRequirementKey;
  status: CredentialStatus;
  claimLevel: ClaimLevel;
  issuer: string;
  state?: string;
  specialty?: string;
  expiresAt?: string;
}

export interface ClinicianProfile {
  npi: string;
  name: string;
  specialty: string;
  credentials: HeldCredential[];
}

export type MatchBand = 'CLEAR' | 'PARTIAL' | 'INELIGIBLE';

export interface MatchedRequirement {
  key: CredentialRequirementKey;
  label: string;
  priority: RequirementPriority;
  met: boolean;
  heldCredential: HeldCredential | null;
  reason: string;
}

export interface OpportunityMatch {
  job: JobPosting;
  matchConfidence: number;
  matchBand: MatchBand;
  requirementResults: MatchedRequirement[];
  missingCredentials: CredentialRequirementKey[];
  metCount: number;
  totalRequired: number;
}

/* ------------------------------------------------------------------ */
/*  Engine                                                             */
/* ------------------------------------------------------------------ */

/**
 * Match a clinician profile against a list of job postings.
 * Weighted scoring: required credentials = 80%, preferred = 20%.
 */
export function computeEligibility(
  profile: ClinicianProfile,
  jobs: JobPosting[],
): OpportunityMatch[] {
  return jobs.map((job) => matchJob(profile, job));
}

function matchJob(profile: ClinicianProfile, job: JobPosting): OpportunityMatch {
  const results: MatchedRequirement[] = job.requirements.map((req) => {
    const held = findMatchingCredential(profile.credentials, req);
    const met = held !== null && held.status === 'active' && held.claimLevel === 'L3';

    return {
      key: req.key,
      label: req.label,
      priority: req.priority,
      met,
      heldCredential: held,
      reason: met
        ? `Verified at ${held!.claimLevel} — ${held!.issuer}`
        : held
          ? `Found but ${held.status} / ${held.claimLevel}`
          : 'Not found in credential wallet',
    };
  });

  const requiredReqs = results.filter((r) => r.priority === 'required');
  const preferredReqs = results.filter((r) => r.priority === 'preferred');

  const requiredMet = requiredReqs.filter((r) => r.met).length;
  const requiredTotal = requiredReqs.length;
  const preferredMet = preferredReqs.filter((r) => r.met).length;
  const preferredTotal = preferredReqs.length;

  // Weighted: required = 80% weight, preferred = 20% weight
  const requiredScore = requiredTotal > 0 ? (requiredMet / requiredTotal) * 80 : 80;
  const preferredScore = preferredTotal > 0 ? (preferredMet / preferredTotal) * 20 : 20;
  const matchConfidence = Math.round(requiredScore + preferredScore);

  const allRequiredMet = requiredMet === requiredTotal;
  const matchBand: MatchBand = allRequiredMet
    ? 'CLEAR'
    : matchConfidence >= 50
      ? 'PARTIAL'
      : 'INELIGIBLE';

  const missingCredentials = results
    .filter((r) => !r.met)
    .map((r) => r.key);

  return {
    job,
    matchConfidence,
    matchBand,
    requirementResults: results,
    missingCredentials,
    metCount: results.filter((r) => r.met).length,
    totalRequired: results.length,
  };
}

function findMatchingCredential(
  credentials: HeldCredential[],
  req: CredentialRequirement,
): HeldCredential | null {
  return (
    credentials.find((c) => {
      if (c.key !== req.key) return false;
      if (req.state && c.state !== req.state) return false;
      if (req.specialty && c.specialty !== req.specialty) return false;
      return true;
    }) ?? null
  );
}
