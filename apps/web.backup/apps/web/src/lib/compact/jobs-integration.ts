/**
 * Jobs and Recruiter Integration
 *
 * Phase 5: Make compacts part of hiring intelligence and scheduling safety
 */

import type { CompactRuleInput } from './CompactEngine';
import { CompactEngine, CompactTypeEnum } from './CompactEngine';
import { getWhereYouCanPracticeToday } from './eligibility-algorithms';

/**
 * Job filter by compact eligibility
 */
export interface CompactJobFilter {
  compactTypes: string[];
  requiredStates: string[];
  easyLicensing: boolean; // Filter for jobs where compact makes licensing easy
}

/**
 * Candidate compact summary for recruiters
 */
export interface CandidateCompactSummary {
  clinicianId: string;
  compactTypes: string[];
  authorizedStates: string[];
  totalStates: number;
  easyLicensingStates: string[];
  compactStatus: 'eligible' | 'conditional' | 'ineligible';
}

/**
 * Job matching with compact awareness
 */
export interface CompactAwareJobMatch {
  jobId: string;
  jobState: string;
  matchScore: number;
  viaCompact: boolean;
  compactType?: string;
  estimatedLicensingTime: number;
  requirements: string[];
}

/**
 * Scheduler integration for cross-state tele-shifts
 */
export interface TeleShiftEligibility {
  shiftState: string;
  eligible: boolean;
  viaCompact: boolean;
  compactType?: string;
  riskLevel: 'low' | 'medium' | 'high';
  notes: string[];
}

/**
 * Filter jobs by compact eligibility
 */
export function filterJobsByCompactEligibility(
  jobs: Array<{ id: string; state: string; [key: string]: unknown }>,
  filter: CompactJobFilter,
  input: CompactRuleInput
): Array<{ job: typeof jobs[0]; match: CompactAwareJobMatch }> {
  const matches: Array<{ job: typeof jobs[0]; match: CompactAwareJobMatch }> = [];

  jobs.forEach(job => {
    const evaluation = CompactEngine.evaluate(input, job.state);
    const viaCompact = evaluation.status === 'eligible' || evaluation.status === 'conditional';

    // Check if job matches filter
    if (filter.requiredStates.length > 0 && !filter.requiredStates.includes(job.state)) {
      return;
    }

    if (filter.easyLicensing && !viaCompact) {
      return;
    }

    // Calculate match score
    let matchScore = 0.5;
    if (viaCompact) {
      matchScore += 0.4; // Compact makes it easy
    }
    if (evaluation.status === 'eligible') {
      matchScore += 0.1; // Fully eligible is better
    }

    matches.push({
      job,
      match: {
        jobId: job.id,
        jobState: job.state,
        matchScore,
        viaCompact,
        compactType: viaCompact ? evaluation.notes[0] : undefined,
        estimatedLicensingTime: evaluation.estimatedTime,
        requirements: evaluation.requiredSteps,
      },
    });
  });

  return matches.sort((a, b) => b.match.matchScore - a.match.matchScore);
}

/**
 * Generate candidate compact summary for recruiters
 */
export function generateCandidateCompactSummary(
  input: CompactRuleInput,
  clinicianId: string
): CandidateCompactSummary {
  const evaluation = CompactEngine.evaluate(input);
  const mapData = getWhereYouCanPracticeToday(input);

  const authorizedStates = evaluation.authorizedStates;
  const easyLicensingStates = mapData
    .filter(data => data.status === 'eligible')
    .map(data => data.state);

  const compactTypes = CompactEngine['getApplicableCompacts'](input);

  return {
    clinicianId,
    compactTypes: compactTypes.map(c => c.toString()),
    authorizedStates,
    totalStates: authorizedStates.length,
    easyLicensingStates,
    compactStatus: evaluation.status,
  };
}

/**
 * Check tele-shift eligibility
 */
export function checkTeleShiftEligibility(
  input: CompactRuleInput,
  shiftState: string
): TeleShiftEligibility {
  const evaluation = CompactEngine.evaluate(input, shiftState);
  const viaCompact = evaluation.status === 'eligible' || evaluation.status === 'conditional';

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (evaluation.status === 'ineligible') {
    riskLevel = 'high';
  } else if (evaluation.status === 'conditional') {
    riskLevel = 'medium';
  }

  return {
    shiftState,
    eligible: viaCompact,
    viaCompact,
    compactType: viaCompact ? evaluation.notes[0] : undefined,
    riskLevel,
    notes: evaluation.notes,
  };
}

/**
 * Growth Engine suggestion for compact application
 */
export interface GrowthSuggestion {
  compactType: string;
  benefit: string;
  estimatedTime: number;
  requirements: string[];
  priority: 'high' | 'medium' | 'low';
  impact: string; // Description of career impact
}

/**
 * Generate growth engine suggestion
 */
export function generateGrowthSuggestion(
  input: CompactRuleInput
): GrowthSuggestion | null {
  const applicableCompacts = CompactEngine['getApplicableCompacts'](input);
  const currentEvaluation = CompactEngine.evaluate(input);

  // Check if IMLC would help
  if (!applicableCompacts.includes(CompactTypeEnum.IMLC)) {
    const licenseType = input.licenseType.toUpperCase();
    if (licenseType.includes('MD') || licenseType.includes('DO')) {
      const imlcEvaluation = CompactEngine.evaluate({
        ...input,
        compactMembership: [CompactTypeEnum.IMLC],
      });

      if (imlcEvaluation.status === 'eligible' || imlcEvaluation.status === 'conditional') {
        return {
          compactType: 'IMLC',
          benefit: `Apply for IMLC for instant mobility to ${imlcEvaluation.authorizedStates.length} states`,
          estimatedTime: imlcEvaluation.estimatedTime,
          requirements: imlcEvaluation.requiredSteps,
          priority: 'high',
          impact: 'Significantly expand practice opportunities across multiple states',
        };
      }
    }
  }

  return null;
}

/**
 * Patient Safety Engine: cross-state readiness signals
 */
export interface CrossStateReadinessSignal {
  state: string;
  ready: boolean;
  signals: {
    licenseActive: boolean;
    compactCoverage: boolean;
    disciplinaryClear: boolean;
    credentialsVerified: boolean;
  };
  riskFactors: string[];
  recommendations: string[];
}

/**
 * Generate cross-state readiness signals
 */
export function generateCrossStateReadinessSignals(
  input: CompactRuleInput,
  targetStates: string[]
): CrossStateReadinessSignal[] {
  const signals: CrossStateReadinessSignal[] = [];

  targetStates.forEach(state => {
    const evaluation = CompactEngine.evaluate(input, state);
    const profile = input.profile;

    const licenseActive = profile?.licenses?.some(l =>
      l.state === state && l.status === 'active'
    ) || false;

    const compactCoverage = evaluation.status === 'eligible' || evaluation.status === 'conditional';
    const disciplinaryClear = !profile?.metadata?.hasDisciplinaryActions;
    const credentialsVerified = true; // Would check actual verification status

    const riskFactors: string[] = [];
    if (!licenseActive && !compactCoverage) {
      riskFactors.push('No active license or compact coverage');
    }
    if (!disciplinaryClear) {
      riskFactors.push('Disciplinary actions on record');
    }
    if (!credentialsVerified) {
      riskFactors.push('Credentials not fully verified');
    }

    const recommendations: string[] = [];
    if (!compactCoverage && evaluation.requiredSteps.length > 0) {
      recommendations.push(...evaluation.requiredSteps);
    }
    if (!disciplinaryClear) {
      recommendations.push('Resolve disciplinary actions');
    }

    signals.push({
      state,
      ready: licenseActive || compactCoverage,
      signals: {
        licenseActive,
        compactCoverage,
        disciplinaryClear,
        credentialsVerified,
      },
      riskFactors,
      recommendations,
    });
  });

  return signals;
}

/**
 * NCQA compact-based compliance report
 */
export interface NCQAComplianceReport {
  clinicianId: string;
  compactTypes: string[];
  compliantStates: string[];
  nonCompliantStates: string[];
  complianceScore: number; // 0-100
  findings: Array<{
    state: string;
    compliant: boolean;
    issues: string[];
    recommendations: string[];
  }>;
}

/**
 * Generate NCQA compliance report
 */
export function generateNCQAComplianceReport(
  input: CompactRuleInput,
  clinicianId: string
): NCQAComplianceReport {
  const mapData = getWhereYouCanPracticeToday(input);
  const compactTypes = CompactEngine['getApplicableCompacts'](input);

  const compliantStates: string[] = [];
  const nonCompliantStates: string[] = [];
  const findings: NCQAComplianceReport['findings'] = [];

  mapData.forEach(data => {
    const compliant = data.status === 'eligible';
    if (compliant) {
      compliantStates.push(data.state);
    } else {
      nonCompliantStates.push(data.state);
    }

    const evaluation = CompactEngine.evaluate(input, data.state);
    findings.push({
      state: data.state,
      compliant,
      issues: evaluation.blockers,
      recommendations: evaluation.requiredSteps,
    });
  });

  const complianceScore = Math.round(
    (compliantStates.length / mapData.length) * 100
  );

  return {
    clinicianId,
    compactTypes: compactTypes.map(c => c.toString()),
    compliantStates,
    nonCompliantStates,
    complianceScore,
    findings,
  };
}

