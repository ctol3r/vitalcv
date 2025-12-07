/**
 * Compact Eligibility Algorithms
 *
 * Phase 2: Detailed eligibility evaluation for each compact type
 */

import type { ClinicianCompactProfile } from '../../../../services/compacts/eligibilityEngine.js';
import { CompactEngine, CompactTypeEnum, type CompactRuleInput, type CompactRuleOutput } from './CompactEngine';

/**
 * IMLC Eligibility Algorithm
 *
 * Requirements:
 * - Primary state of residence must be IMLC member
 * - Physician license (MD/DO) must be unencumbered
 * - No disciplinary actions
 */
export function evaluateIMLCEligibility(
  input: CompactRuleInput,
  profile?: ClinicianCompactProfile
): CompactRuleOutput {
  const blockers: string[] = [];
  const requiredSteps: string[] = [];

  // Check if home state is IMLC member
  const homeStateCompacts = CompactEngine['STATE_COMPACT_MEMBERSHIP'][input.homeState] || [];
  if (!homeStateCompacts.includes(CompactTypeEnum.IMLC)) {
    blockers.push(`Home state ${input.homeState} is not an IMLC member`);
    requiredSteps.push(`Establish primary residence in an IMLC member state`);
  }

  // Check license type
  const licenseType = input.licenseType.toUpperCase();
  if (!licenseType.includes('MD') && !licenseType.includes('DO')) {
    blockers.push('IMLC is only available for physicians (MD/DO)');
    requiredSteps.push('Obtain MD or DO license');
  }

  // Check for unencumbered license
  if (profile?.metadata?.hasDisciplinaryActions) {
    blockers.push('License has disciplinary actions');
    requiredSteps.push('Resolve all disciplinary actions');
  }

  // Check license status
  const activeLicense = profile?.licenses?.find(l =>
    l.state === input.homeState &&
    l.status === 'active' &&
    (l.type.toUpperCase().includes('MD') || l.type.toUpperCase().includes('DO'))
  );

  if (!activeLicense) {
    blockers.push('No active physician license in home state');
    requiredSteps.push('Obtain active MD/DO license in home state');
  }

  const status = blockers.length === 0 ? 'eligible' : 'ineligible';
  const authorizedStates = status === 'eligible'
    ? CompactEngine.getAuthorizedStates(input)
    : [];

  return {
    status,
    requiredSteps,
    estimatedTime: blockers.length > 0 ? 90 : 0,
    authorizedStates,
    blockers,
    notes: status === 'eligible'
      ? ['IMLC eligibility confirmed', `Can practice in ${authorizedStates.length} states`]
      : ['IMLC eligibility requirements not met'],
  };
}

/**
 * NLC Eligibility Algorithm
 *
 * Requirements:
 * - Multistate nurse license (RN)
 * - Active status
 * - No disciplinary actions
 */
export function evaluateNLCEligibility(
  input: CompactRuleInput,
  profile?: ClinicianCompactProfile
): CompactRuleOutput {
  const blockers: string[] = [];
  const requiredSteps: string[] = [];

  // Check license type
  const licenseType = input.licenseType.toUpperCase();
  if (!licenseType.includes('RN') && !licenseType.includes('NURSE')) {
    blockers.push('NLC is only available for registered nurses (RN)');
    requiredSteps.push('Obtain RN license');
  }

  // Check for multistate license
  const multistateLicense = profile?.licenses?.find(l =>
    l.isMultiState === true &&
    (l.type.toUpperCase().includes('RN') || l.type.toUpperCase().includes('NURSE'))
  );

  if (!multistateLicense) {
    blockers.push('No multistate RN license found');
    requiredSteps.push('Obtain multistate RN license from compact state');
  }

  // Check license status
  if (multistateLicense && multistateLicense.status !== 'active') {
    blockers.push('Multistate license is not active');
    requiredSteps.push('Activate multistate RN license');
  }

  // Check for disciplinary actions
  if (profile?.metadata?.hasDisciplinaryActions) {
    blockers.push('License has disciplinary actions');
    requiredSteps.push('Resolve all disciplinary actions');
  }

  const status = blockers.length === 0 ? 'eligible' : 'ineligible';
  const authorizedStates = status === 'eligible'
    ? CompactEngine.getAuthorizedStates(input)
    : [];

  return {
    status,
    requiredSteps,
    estimatedTime: blockers.length > 0 ? 60 : 0,
    authorizedStates,
    blockers,
    notes: status === 'eligible'
      ? ['NLC eligibility confirmed', `Can practice in ${authorizedStates.length} states`]
      : ['NLC eligibility requirements not met'],
  };
}

/**
 * PSYPACT Eligibility Algorithm
 *
 * Requirements:
 * - E.Passport (for telepsychology)
 * - Interjurisdictional Practice Certificate (IPC) for temporary practice
 */
export function evaluatePSYPACTEligibility(
  input: CompactRuleInput,
  profile?: ClinicianCompactProfile
): CompactRuleOutput {
  const blockers: string[] = [];
  const requiredSteps: string[] = [];

  // Check license type
  const licenseType = input.licenseType.toUpperCase();
  if (!licenseType.includes('PSY') && !licenseType.includes('PSYCH')) {
    blockers.push('PSYPACT is only available for psychologists');
    requiredSteps.push('Obtain psychology license');
  }

  // Check for E.Passport or IPC
  const psypactInfo = profile?.compacts?.psypact;
  const hasEPassport = psypactInfo?.ePassport === true;
  const hasIPC = psypactInfo?.authorities?.includes('APIT') ||
                 psypactInfo?.authorities?.includes('TAP');

  if (!hasEPassport && !hasIPC) {
    blockers.push('No E.Passport or IPC certificate found');
    requiredSteps.push('Apply for E.Passport (telepsychology) or IPC (temporary practice)');
  }

  // Check if expired
  if (psypactInfo?.expiresAt) {
    const expiresAt = new Date(psypactInfo.expiresAt);
    if (expiresAt < new Date()) {
      blockers.push('PSYPACT certificate has expired');
      requiredSteps.push('Renew E.Passport or IPC certificate');
    }
  }

  const status = blockers.length === 0 ? 'eligible' : 'conditional';
  const authorizedStates = status === 'eligible' || status === 'conditional'
    ? CompactEngine.getAuthorizedStates(input)
    : [];

  return {
    status,
    requiredSteps,
    estimatedTime: blockers.length > 0 ? 45 : 0,
    authorizedStates,
    blockers,
    notes: status === 'eligible'
      ? ['PSYPACT eligibility confirmed', `Can practice in ${authorizedStates.length} states`]
      : ['PSYPACT eligibility requires E.Passport or IPC'],
  };
}

/**
 * APRN Compact Eligibility Algorithm
 *
 * Requirements:
 * - Full practice authority in home state
 * - APRN license
 */
export function evaluateAPRNEligibility(
  input: CompactRuleInput,
  profile?: ClinicianCompactProfile
): CompactRuleOutput {
  const blockers: string[] = [];
  const requiredSteps: string[] = [];

  // Check license type
  const licenseType = input.licenseType.toUpperCase();
  if (!licenseType.includes('NP') && !licenseType.includes('APRN') && !licenseType.includes('APN')) {
    blockers.push('APRN Compact is only available for Advanced Practice Registered Nurses');
    requiredSteps.push('Obtain APRN/NP license');
  }

  // Check for full practice authority
  const aprnInfo = profile?.compacts?.aprn;
  const homeStateLicense = profile?.licenses?.find(l =>
    l.state === input.homeState &&
    (l.type.toUpperCase().includes('NP') ||
     l.type.toUpperCase().includes('APRN') ||
     l.type.toUpperCase().includes('APN'))
  );

  if (!homeStateLicense) {
    blockers.push('No APRN license in home state');
    requiredSteps.push('Obtain APRN license in home state');
  }

  // Check for full practice authority (simplified check)
  // In reality, this would check state-specific regulations
  if (homeStateLicense && homeStateLicense.status !== 'active') {
    blockers.push('APRN license is not active');
    requiredSteps.push('Activate APRN license in home state');
  }

  const status = blockers.length === 0 ? 'eligible' : 'ineligible';
  const authorizedStates = status === 'eligible'
    ? CompactEngine.getAuthorizedStates(input)
    : [];

  return {
    status,
    requiredSteps,
    estimatedTime: blockers.length > 0 ? 75 : 0,
    authorizedStates,
    blockers,
    notes: status === 'eligible'
      ? ['APRN Compact eligibility confirmed', `Can practice in ${authorizedStates.length} states`]
      : ['APRN Compact eligibility requires full practice authority in home state'],
  };
}

/**
 * PT/OT/ASLP Compact Eligibility
 */
export function evaluatePTCompactEligibility(
  input: CompactRuleInput,
  profile?: ClinicianCompactProfile
): CompactRuleOutput {
  const blockers: string[] = [];
  const requiredSteps: string[] = [];

  const licenseType = input.licenseType.toUpperCase();
  const isPT = licenseType.includes('PT') || licenseType.includes('PHYSICAL');
  const isOT = licenseType.includes('OT') || licenseType.includes('OCCUPATIONAL');
  const isASLP = licenseType.includes('ASLP') ||
                 licenseType.includes('AUDIOLOGY') ||
                 licenseType.includes('SPEECH');

  if (!isPT && !isOT && !isASLP) {
    blockers.push('PT/OT/ASLP Compact is only available for physical therapists, occupational therapists, or speech-language pathologists');
    requiredSteps.push('Obtain PT, OT, or ASLP license');
  }

  const compactType = isPT ? CompactTypeEnum.PT :
                      isOT ? CompactTypeEnum.OT :
                      CompactTypeEnum.ASLP;

  const activeLicense = profile?.licenses?.find(l =>
    l.status === 'active' &&
    ((isPT && l.type.toUpperCase().includes('PT')) ||
     (isOT && l.type.toUpperCase().includes('OT')) ||
     (isASLP && (l.type.toUpperCase().includes('ASLP') ||
                 l.type.toUpperCase().includes('AUDIOLOGY') ||
                 l.type.toUpperCase().includes('SPEECH'))))
  );

  if (!activeLicense) {
    blockers.push(`No active ${compactType} license found`);
    requiredSteps.push(`Obtain active ${compactType} license`);
  }

  const status = blockers.length === 0 ? 'eligible' : 'ineligible';
  const authorizedStates = status === 'eligible'
    ? CompactEngine.getAuthorizedStates(input)
    : [];

  return {
    status,
    requiredSteps,
    estimatedTime: blockers.length > 0 ? 60 : 0,
    authorizedStates,
    blockers,
    notes: status === 'eligible'
      ? [`${compactType} Compact eligibility confirmed`, `Can practice in ${authorizedStates.length} states`]
      : [`${compactType} Compact eligibility requirements not met`],
  };
}

/**
 * Get "Where You Can Practice Today" map data
 */
export interface PracticeMapData {
  state: string;
  status: 'eligible' | 'conditional' | 'ineligible';
  compactTypes: CompactTypeEnum[];
  notes: string[];
}

export function getWhereYouCanPracticeToday(
  input: CompactRuleInput
): PracticeMapData[] {
  const allStates = Object.keys(STATE_COMPACT_MEMBERSHIP);
  const mapData: PracticeMapData[] = [];

  allStates.forEach(state => {
    const compacts = CompactEngine['STATE_COMPACT_MEMBERSHIP'][state] || [];
    const applicableCompacts = CompactEngine.getApplicableCompacts(input).filter(c =>
      compacts.includes(c)
    );

    if (applicableCompacts.length === 0) {
      mapData.push({
        state,
        status: 'ineligible',
        compactTypes: [],
        notes: ['No applicable compact coverage'],
      });
      return;
    }

    // Evaluate eligibility for this state
    const evaluation = CompactEngine.evaluate({ ...input, clinicianState: state }, state);

    mapData.push({
      state,
      status: evaluation.status,
      compactTypes: applicableCompacts,
      notes: evaluation.notes,
    });
  });

  return mapData;
}

/**
 * Get "Where You Can Get Licensed Quickly" suggestions
 */
export interface QuickLicenseSuggestion {
  state: string;
  compactTypes: CompactTypeEnum[];
  estimatedTime: number;
  requirements: string[];
  priority: 'high' | 'medium' | 'low';
}

export function getWhereYouCanGetLicensedQuickly(
  input: CompactRuleInput
): QuickLicenseSuggestion[] {
  const suggestions: QuickLicenseSuggestion[] = [];
  const applicableCompacts = CompactEngine['getApplicableCompacts'](input);

  // Find states with most compact coverage
  const stateCoverage = new Map<string, CompactTypeEnum[]>();

  Object.entries(STATE_COMPACT_MEMBERSHIP).forEach(([state, compacts]) => {
    const matching = compacts.filter(c => applicableCompacts.includes(c));
    if (matching.length > 0) {
      stateCoverage.set(state, matching);
    }
  });

  // Sort by coverage (most compacts first)
  const sortedStates = Array.from(stateCoverage.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10); // Top 10

  sortedStates.forEach(([state, compacts]) => {
    const evaluation = CompactEngine.evaluate({ ...input, clinicianState: state }, state);

    suggestions.push({
      state,
      compactTypes: compacts,
      estimatedTime: evaluation.estimatedTime,
      requirements: evaluation.requiredSteps,
      priority: compacts.length >= 3 ? 'high' : compacts.length >= 2 ? 'medium' : 'low',
    });
  });

  return suggestions;
}

/**
 * AI-based eligibility prediction for future compact expansion
 */
export interface FutureCompactPrediction {
  state: string;
  compactType: CompactTypeEnum;
  probability: number;
  estimatedEnactmentDate: string;
  reasoning: string[];
}

export function predictFutureCompactExpansion(
  input: CompactRuleInput
): FutureCompactPrediction[] {
  // This would integrate with AI/ML model in production
  // For now, return predictions based on legislative trends

  const predictions: FutureCompactPrediction[] = [];
  const applicableCompacts = CompactEngine['getApplicableCompacts'](input);

  // States likely to join IMLC soon (based on legislative activity)
  const likelyIMLCStates = ['NY', 'CA', 'HI'];
  if (applicableCompacts.includes(CompactTypeEnum.IMLC)) {
    likelyIMLCStates.forEach(state => {
      if (!STATE_COMPACT_MEMBERSHIP[state]?.includes(CompactTypeEnum.IMLC)) {
        predictions.push({
          state,
          compactType: CompactTypeEnum.IMLC,
          probability: 0.65,
          estimatedEnactmentDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          reasoning: [
            'Active legislative consideration',
            'Strong physician advocacy',
            'Telemedicine demand',
          ],
        });
      }
    });
  }

  return predictions;
}

