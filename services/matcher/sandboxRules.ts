const log = getServiceLogger('matcher/sandboxRules');
/**
 * B133B-SBX-004: Sandbox matcher behavior: deterministic + loggable
 *
 * Deterministic matching rules for sandbox environment.
 * Same clinician input yields predictable job matches.
 * Logs all decision steps for partner documentation.
 */

import crypto from 'crypto';
import { getServiceLogger } from '../logging/serviceLogger';

export interface ClinicianProfile {
  id?: string;
  npi?: string;
  specialty: string;
  licenseState: string;
  yearsExperience: number;
  preferences?: {
    jobType?: 'permanent' | 'locum' | 'any';
    locations?: string[];
    salaryMin?: number;
  };
}

export interface JobPosting {
  id: string;
  title: string;
  specialty: string;
  location: string;
  type: 'permanent' | 'locum';
  salaryMin: number;
  salaryMax: number;
  requirements: string[];
  isActive: boolean;
}

export interface MatchResult {
  jobId: string;
  score: number;
  reasons: string[];
  matchDetails: {
    specialtyMatch: boolean;
    locationMatch: boolean;
    experienceMatch: boolean;
    typeMatch: boolean;
    salaryMatch: boolean;
  };
}

export interface MatchDecisionLog {
  timestamp: Date;
  clinicianId: string;
  clinicianHash: string; // Deterministic hash for same input
  totalJobs: number;
  matchedJobs: number;
  decisionSteps: Array<{
    jobId: string;
    step: string;
    decision: 'pass' | 'fail' | 'score';
    reason: string;
    score?: number;
  }>;
  finalMatches: MatchResult[];
}

/**
 * Generate deterministic hash for clinician
 * Same clinician data -> same hash -> same results
 */
function generateClinicianHash(clinician: ClinicianProfile): string {
  const hashInput = JSON.stringify({
    specialty: clinician.specialty,
    licenseState: clinician.licenseState,
    yearsExperience: clinician.yearsExperience,
    preferences: clinician.preferences,
  });

  return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

/**
 * Check if specialty matches
 */
function checkSpecialtyMatch(clinician: ClinicianProfile, job: JobPosting): { match: boolean; reason: string } {
  const match = clinician.specialty.toLowerCase() === job.specialty.toLowerCase();
  return {
    match,
    reason: match
      ? `Specialty match: ${clinician.specialty}`
      : `Specialty mismatch: ${clinician.specialty} != ${job.specialty}`,
  };
}

/**
 * Check if location/state matches
 */
function checkLocationMatch(clinician: ClinicianProfile, job: JobPosting): { match: boolean; reason: string; score: number } {
  // Extract state from job location (e.g., "Boston, MA" -> "MA")
  const jobStateMatch = job.location.match(/\b([A-Z]{2})\b/);
  const jobState = jobStateMatch ? jobStateMatch[1] : null;

  if (!jobState) {
    return { match: true, reason: 'Location: No state restriction', score: 50 };
  }

  const match = clinician.licenseState === jobState;
  return {
    match,
    reason: match
      ? `License valid in job state: ${jobState}`
      : `License state ${clinician.licenseState} != job state ${jobState}`,
    score: match ? 100 : 0,
  };
}

/**
 * Check experience requirements
 */
function checkExperienceMatch(clinician: ClinicianProfile, job: JobPosting): { match: boolean; reason: string; score: number } {
  // Parse experience requirement from job (e.g., "3+ years experience")
  const expRequirement = job.requirements.find(r => r.toLowerCase().includes('years experience'));

  if (!expRequirement) {
    return { match: true, reason: 'No specific experience requirement', score: 50 };
  }

  const yearsMatch = expRequirement.match(/(\d+)\+?\s*years?/i);
  const requiredYears = yearsMatch ? parseInt(yearsMatch[1]) : 0;

  const match = clinician.yearsExperience >= requiredYears;
  return {
    match,
    reason: match
      ? `Experience sufficient: ${clinician.yearsExperience} >= ${requiredYears} years`
      : `Insufficient experience: ${clinician.yearsExperience} < ${requiredYears} years`,
    score: match ? 100 : Math.min(80, (clinician.yearsExperience / requiredYears) * 100),
  };
}

/**
 * Check job type preference
 */
function checkTypeMatch(clinician: ClinicianProfile, job: JobPosting): { match: boolean; reason: string; score: number } {
  const pref = clinician.preferences?.jobType;

  if (!pref || pref === 'any') {
    return { match: true, reason: 'No job type preference specified', score: 50 };
  }

  const match = pref === job.type;
  return {
    match,
    reason: match
      ? `Job type matches preference: ${job.type}`
      : `Job type ${job.type} != preference ${pref}`,
    score: match ? 100 : 30,
  };
}

/**
 * Check salary expectations
 */
function checkSalaryMatch(clinician: ClinicianProfile, job: JobPosting): { match: boolean; reason: string; score: number } {
  const minSalary = clinician.preferences?.salaryMin;

  if (!minSalary) {
    return { match: true, reason: 'No salary requirement specified', score: 50 };
  }

  const match = job.salaryMax >= minSalary;
  return {
    match,
    reason: match
      ? `Salary meets minimum: $${job.salaryMax.toLocaleString()} >= $${minSalary.toLocaleString()}`
      : `Salary below minimum: $${job.salaryMax.toLocaleString()} < $${minSalary.toLocaleString()}`,
    score: match ? 100 : Math.min(70, (job.salaryMax / minSalary) * 100),
  };
}

/**
 * Calculate match score for a clinician-job pair
 */
function calculateMatchScore(
  clinician: ClinicianProfile,
  job: JobPosting,
  decisionSteps: MatchDecisionLog['decisionSteps']
): MatchResult | null {
  const reasons: string[] = [];
  const matchDetails = {
    specialtyMatch: false,
    locationMatch: false,
    experienceMatch: false,
    typeMatch: false,
    salaryMatch: false,
  };

  // 1. Check specialty (REQUIRED)
  const specialtyCheck = checkSpecialtyMatch(clinician, job);
  decisionSteps.push({
    jobId: job.id,
    step: 'specialty',
    decision: specialtyCheck.match ? 'pass' : 'fail',
    reason: specialtyCheck.reason,
  });

  if (!specialtyCheck.match) {
    return null; // Hard requirement
  }

  matchDetails.specialtyMatch = true;
  reasons.push(specialtyCheck.reason);

  let totalScore = 0;
  let maxScore = 0;

  // 2. Check location/license
  const locationCheck = checkLocationMatch(clinician, job);
  decisionSteps.push({
    jobId: job.id,
    step: 'location',
    decision: 'score',
    reason: locationCheck.reason,
    score: locationCheck.score,
  });

  matchDetails.locationMatch = locationCheck.match;
  reasons.push(locationCheck.reason);
  totalScore += locationCheck.score;
  maxScore += 100;

  // 3. Check experience
  const experienceCheck = checkExperienceMatch(clinician, job);
  decisionSteps.push({
    jobId: job.id,
    step: 'experience',
    decision: experienceCheck.match ? 'pass' : 'score',
    reason: experienceCheck.reason,
    score: experienceCheck.score,
  });

  matchDetails.experienceMatch = experienceCheck.match;
  reasons.push(experienceCheck.reason);
  totalScore += experienceCheck.score;
  maxScore += 100;

  // 4. Check job type
  const typeCheck = checkTypeMatch(clinician, job);
  decisionSteps.push({
    jobId: job.id,
    step: 'jobType',
    decision: 'score',
    reason: typeCheck.reason,
    score: typeCheck.score,
  });

  matchDetails.typeMatch = typeCheck.match;
  reasons.push(typeCheck.reason);
  totalScore += typeCheck.score;
  maxScore += 100;

  // 5. Check salary
  const salaryCheck = checkSalaryMatch(clinician, job);
  decisionSteps.push({
    jobId: job.id,
    step: 'salary',
    decision: 'score',
    reason: salaryCheck.reason,
    score: salaryCheck.score,
  });

  matchDetails.salaryMatch = salaryCheck.match;
  reasons.push(salaryCheck.reason);
  totalScore += salaryCheck.score;
  maxScore += 100;

  // Calculate final score (0-100)
  const finalScore = Math.round((totalScore / maxScore) * 100);

  return {
    jobId: job.id,
    score: finalScore,
    reasons,
    matchDetails,
  };
}

/**
 * Deterministic job matching for sandbox
 * Same clinician input -> same results every time
 */
export function matchJobsSandbox(
  clinician: ClinicianProfile,
  jobs: JobPosting[],
  options: {
    minScore?: number;
    maxResults?: number;
    logDecisions?: boolean;
  } = {}
): { matches: MatchResult[]; log: MatchDecisionLog } {
  const {
    minScore = 60,
    maxResults = 10,
    logDecisions = true,
  } = options;

  const clinicianHash = generateClinicianHash(clinician);
  const decisionSteps: MatchDecisionLog['decisionSteps'] = [];

  // Filter to active jobs only
  const activeJobs = jobs.filter(job => job.isActive);

  if (logDecisions) {
    log.info(`\n🔍 Starting sandbox match for clinician hash: ${clinicianHash}`);
    log.info(`   Specialty: ${clinician.specialty}`);
    log.info(`   License State: ${clinician.licenseState}`);
    log.info(`   Experience: ${clinician.yearsExperience} years`);
    log.info(`   Active Jobs: ${activeJobs.length}`);
  }

  // Calculate scores for all jobs
  const matches: MatchResult[] = [];

  for (const job of activeJobs) {
    const match = calculateMatchScore(clinician, job, decisionSteps);

    if (match && match.score >= minScore) {
      matches.push(match);

      if (logDecisions) {
        log.info(`\n  ✅ Match found: ${job.title} (Score: ${match.score})`);
      }
    } else if (logDecisions && match) {
      log.info(`\n  ❌ Below threshold: ${job.title} (Score: ${match.score})`);
    }
  }

  // Sort by score (deterministic)
  matches.sort((a, b) => b.score - a.score);

  // Limit results
  const finalMatches = matches.slice(0, maxResults);

  const log: MatchDecisionLog = {
    timestamp: new Date(),
    clinicianId: clinician.id || clinician.npi || 'unknown',
    clinicianHash,
    totalJobs: activeJobs.length,
    matchedJobs: matches.length,
    decisionSteps,
    finalMatches,
  };

  if (logDecisions) {
    log.info(`\n📊 Match Summary:`);
    log.info(`   Total Active Jobs: ${activeJobs.length}`);
    log.info(`   Matches Found: ${matches.length}`);
    log.info(`   Returned (top ${maxResults}): ${finalMatches.length}`);
    log.info(`   Clinician Hash: ${clinicianHash} (deterministic)\n`);
  }

  return { matches: finalMatches, log };
}

/**
 * Get detailed explanation of match decisions
 */
export function getMatchExplanation(log: MatchDecisionLog): string {
  let explanation = `Match Decision Log\n`;
  explanation += `==================\n\n`;
  explanation += `Clinician Hash: ${log.clinicianHash} (deterministic)\n`;
  explanation += `Timestamp: ${log.timestamp.toISOString()}\n`;
  explanation += `Total Jobs Evaluated: ${log.totalJobs}\n`;
  explanation += `Matches Found: ${log.matchedJobs}\n\n`;

  // Group decision steps by job
  const jobSteps = new Map<string, typeof log.decisionSteps>();

  for (const step of log.decisionSteps) {
    if (!jobSteps.has(step.jobId)) {
      jobSteps.set(step.jobId, []);
    }
    jobSteps.get(step.jobId)!.push(step);
  }

  explanation += `Decision Steps by Job:\n`;
  explanation += `=====================\n\n`;

  for (const [jobId, steps] of jobSteps.entries()) {
    explanation += `Job: ${jobId}\n`;

    for (const step of steps) {
      const status = step.decision === 'pass' ? '✅' : step.decision === 'fail' ? '❌' : '📊';
      explanation += `  ${status} ${step.step}: ${step.reason}`;
      if (step.score !== undefined) {
        explanation += ` (score: ${step.score})`;
      }
      explanation += '\n';
    }

    explanation += '\n';
  }

  return explanation;
}

