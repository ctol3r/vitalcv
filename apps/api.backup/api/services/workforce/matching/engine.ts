import { NegativeConstraintEngine } from './negativeConstraints';
import { MobilityIntegration } from './mobilityIntegration';
import {
  enhanceMatchCandidateWithCCI,
  enhanceCoverageWithCCI,
  meetsCCIThreshold,
  type CCIIntegrationOptions,
} from '../integration/cciIntegration.js';
import type {
  ClinicianProfile,
  DemandSignal,
  MatchCandidate,
  MatchHighlight,
  MatchRejection,
  WorkforceMatchOptions,
  CoverageSnapshot,
} from './types';

const DRIFT_ORDER: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

export class WorkforceMatchingEngine {
  constructor(
    private readonly negativeConstraints: NegativeConstraintEngine,
    private readonly mobilityIntegration: MobilityIntegration,
    private readonly cciOptions?: CCIIntegrationOptions
  ) {}

  async matchDemand(
    demand: DemandSignal,
    clinicians: ClinicianProfile[],
    options: WorkforceMatchOptions = {}
  ): Promise<MatchCandidate[]> {
    const matches: MatchCandidate[] = [];

    for (const clinician of clinicians) {
      const candidate = await this.evaluateCandidate(demand, clinician, options);
      if (candidate) {
        matches.push(candidate);
      }
    }

    matches.sort((a, b) => b.score - a.score);
    if (typeof options.maxResults === 'number') {
      return matches.slice(0, options.maxResults);
    }

    return matches;
  }

  private async evaluateCandidate(
    demand: DemandSignal,
    clinician: ClinicianProfile,
    options: WorkforceMatchOptions
  ): Promise<MatchCandidate | null> {
    if (!this.hasLocationAccess(clinician, demand)) {
      this.logReject(clinician, demand, 'Missing compact or license coverage', options);
      return null;
    }

    const privilegeCoverage = this.calculatePrivilegeCoverage(clinician, demand);
    if (privilegeCoverage < 1) {
      this.logReject(clinician, demand, 'Required privileges not fully active', options);
      return null;
    }

    const payerAlignment = this.calculatePayerAlignment(clinician, demand);
    if ((demand.preferredPayers?.length ?? 0) > 0 && payerAlignment === 0) {
      this.logReject(clinician, demand, 'No payer enrollment overlap', options);
      return null;
    }

    if (!this.hasEhrReadiness(clinician, demand)) {
      this.logReject(clinician, demand, `EHR vendor ${demand.ehrVendor} not ready`, options);
      return null;
    }

    const availabilityCoverage = this.calculateAvailabilityCoverage(clinician, demand);
    if (availabilityCoverage < 0.5) {
      this.logReject(clinician, demand, 'Insufficient availability overlap', options);
      return null;
    }

    if (!this.meetsRiskTolerance(clinician, demand)) {
      this.logReject(clinician, demand, 'Risk threshold exceeded', options);
      return null;
    }

    const constraintResult = this.negativeConstraints.evaluate(clinician, demand);
    if (!constraintResult.allowed) {
      this.logReject(
        clinician,
        demand,
        `Negative constraints: ${constraintResult.messages.join('; ')}`,
        options
      );
      return null;
    }

    const mobilityDecision = await this.mobilityIntegration.canMatch({
      clinicianId: clinician.id,
      clinicianOrgId: clinician.orgId,
      targetOrgId: demand.orgId,
      clinicianProfile: clinician,
    });

    if (!mobilityDecision.allowed) {
      this.logReject(clinician, demand, mobilityDecision.reason, options, ['mobility']);
      return null;
    }

    let coverage = this.buildCoverageSnapshot({
      privilegeCoverage,
      payerAlignment,
      availabilityCoverage,
      clinician,
      demand,
    });

    // Enhance coverage with CCI if enabled
    if (this.cciOptions?.useCCIForReadiness) {
      coverage = await enhanceCoverageWithCCI(coverage, clinician.id, this.cciOptions);
    }

    // Check CCI threshold if enabled
    if (this.cciOptions?.minCCIThreshold) {
      const meetsCCI = await meetsCCIThreshold(clinician.id, this.cciOptions.minCCIThreshold);
      if (!meetsCCI) {
        this.logReject(clinician, demand, 'CCI threshold not met', options);
        return null;
      }
    }

    const ratingScore = clinician.rating ?? 0.65;
    const baseScore =
      coverage.privileges * 0.25 +
      coverage.availability * 0.2 +
      coverage.payerAlignment * 0.15 +
      coverage.experience * 0.15 +
      coverage.ehr * 0.1 +
      ratingScore * 0.15;

    const burnoutPenalty = clinician.burnoutRisk ? 1 - Math.min(0.3, clinician.burnoutRisk * 0.3) : 1;
    const mobilityMultiplier = mobilityDecision.readiness.status === 'instantly_onboardable' ? 1 : 0.85;

    let score = baseScore * coverage.riskModifier * burnoutPenalty * mobilityMultiplier;
    score = clamp(score, 0, 1);

    if (typeof options.minScore === 'number' && score < options.minScore) {
      this.logReject(clinician, demand, `Score ${score.toFixed(2)} below threshold`, options);
      return null;
    }

    const highlights = this.buildHighlights(coverage, clinician, demand, mobilityDecision.reason);

    let candidate: MatchCandidate = {
      clinicianId: clinician.id,
      clinicianName: clinician.name,
      demandId: demand.id,
      score,
      coverage,
      highlights,
      mobilityContext: {
        allowed: true,
        reason: mobilityDecision.reason,
      },
    };

    // Enhance candidate with CCI if enabled
    if (this.cciOptions?.useCCIForRanking) {
      candidate = await enhanceMatchCandidateWithCCI(candidate, this.cciOptions);
    }

    return candidate;
  }

  private hasLocationAccess(clinician: ClinicianProfile, demand: DemandSignal): boolean {
    if (!demand.locationState) {
      return true;
    }
    const state = demand.locationState;
    const licenses = clinician.stateLicenses ?? [];
    const compacts = clinician.compactEligibleStates ?? [];
    return licenses.includes(state) || compacts.includes(state);
  }

  private calculatePrivilegeCoverage(clinician: ClinicianProfile, demand: DemandSignal): number {
    const required = demand.requiredPrivileges ?? [];
    if (required.length === 0) {
      return 1;
    }
    const activePrivileges = new Set(
      clinician.privileges.filter((priv) => priv.status === 'ACTIVE').map((priv) => priv.code)
    );
    const matched = required.filter((req) => activePrivileges.has(req)).length;
    return matched / required.length;
  }

  private calculatePayerAlignment(clinician: ClinicianProfile, demand: DemandSignal): number {
    const preferred = demand.preferredPayers ?? [];
    if (preferred.length === 0) {
      return 1;
    }
    const enrolled = new Set(
      clinician.payerCoverage.filter((payer) => payer.status === 'ENROLLED').map((payer) => payer.payerId)
    );
    const matched = preferred.filter((payer) => enrolled.has(payer)).length;
    return matched / preferred.length;
  }

  private hasEhrReadiness(clinician: ClinicianProfile, demand: DemandSignal): boolean {
    if (!demand.ehrVendor) {
      return true;
    }
    return clinician.ehrReadiness.some(
      (ehr) => ehr.vendor === demand.ehrVendor && ehr.ready && (ehr.trained ?? true)
    );
  }

  private calculateAvailabilityCoverage(clinician: ClinicianProfile, demand: DemandSignal): number {
    const requiredMinutes = windowMinutes(demand.shift.start, demand.shift.end);
    if (requiredMinutes <= 0) {
      return 0;
    }

    let overlap = 0;
    for (const window of clinician.availability) {
      if (window.day !== demand.shift.day) {
        continue;
      }
      const start = Math.max(toMinutes(window.start), toMinutes(demand.shift.start));
      const end = Math.min(toMinutes(window.end), toMinutes(demand.shift.end));
      if (end > start) {
        overlap += end - start;
      }
    }

    return clamp(overlap / requiredMinutes, 0, 1);
  }

  private meetsRiskTolerance(clinician: ClinicianProfile, demand: DemandSignal): boolean {
    const maxRisk = demand.riskTolerance?.maxRiskScore ?? 1;
    if (clinician.risk.overall > maxRisk) {
      return false;
    }

    if (
      clinician.risk.complianceStatus === 'AT_RISK' &&
      demand.riskTolerance?.allowComplianceAtRisk === false
    ) {
      return false;
    }

    const allowedDrift = demand.riskTolerance?.allowDrift ?? 'HIGH';
    const clinicianDrift = clinician.risk.driftSignal ?? 'LOW';
    if (DRIFT_ORDER[clinicianDrift] > DRIFT_ORDER[allowedDrift]) {
      return false;
    }

    return true;
  }

  private buildCoverageSnapshot(params: {
    privilegeCoverage: number;
    payerAlignment: number;
    availabilityCoverage: number;
    clinician: ClinicianProfile;
    demand: DemandSignal;
  }): CoverageSnapshot {
    const experienceScore = this.calculateExperienceScore(
      params.clinician.yearsExperience,
      params.demand.minExperienceYears
    );
    const ehrScore = this.hasEhrReadiness(params.clinician, params.demand) ? 1 : 0;
    const riskModifier = this.calculateRiskModifier(params.clinician, params.demand);

    return {
      privileges: clamp(params.privilegeCoverage, 0, 1),
      payerAlignment: clamp(params.payerAlignment, 0, 1),
      availability: clamp(params.availabilityCoverage, 0, 1),
      experience: experienceScore,
      ehr: ehrScore,
      riskModifier,
    };
  }

  private calculateExperienceScore(
    yearsExperience: number | undefined,
    minExperienceYears: number | undefined
  ): number {
    if (yearsExperience === undefined && minExperienceYears === undefined) {
      return 0.6;
    }
    const minYears = minExperienceYears ?? 0;
    if (yearsExperience === undefined) {
      return clamp(0.4 + minYears * 0.02, 0, 1);
    }
    if (yearsExperience >= minYears) {
      const excess = yearsExperience - minYears;
      return clamp(0.6 + excess * 0.04, 0, 1);
    }
    const deficit = minYears - yearsExperience;
    return clamp(0.6 - deficit * 0.08, 0, 1);
  }

  private calculateRiskModifier(clinician: ClinicianProfile, demand: DemandSignal): number {
    const maxRisk = demand.riskTolerance?.maxRiskScore ?? 1;
    const riskRatio = 1 - clamp(clinician.risk.overall / maxRisk, 0, 1);

    const driftPenalty = (() => {
      const drift = clinician.risk.driftSignal ?? 'LOW';
      if (drift === 'HIGH') return 0.4;
      if (drift === 'MEDIUM') return 0.7;
      return 1;
    })();

    const compliancePenalty =
      clinician.risk.complianceStatus === 'AT_RISK' && demand.riskTolerance?.allowComplianceAtRisk === false
        ? 0.6
        : 1;

    return clamp(riskRatio * driftPenalty * compliancePenalty, 0, 1);
  }

  private buildHighlights(
    coverage: CoverageSnapshot,
    clinician: ClinicianProfile,
    demand: DemandSignal,
    mobilityReason: string
  ): MatchHighlight[] {
    const requiredPrivileges = demand.requiredPrivileges ?? [];
    const privilegeDetail =
      requiredPrivileges.length === 0
        ? 'No privilege prerequisites'
        : `${Math.round(coverage.privileges * requiredPrivileges.length)}/${requiredPrivileges.length} privileges ready`;

    return [
      {
        label: 'Privileges',
        detail: privilegeDetail,
        sentiment: sentimentFor(coverage.privileges),
      },
      {
        label: 'Availability',
        detail: `${Math.round(coverage.availability * 100)}% of shift covered`,
        sentiment: sentimentFor(coverage.availability),
      },
      {
        label: 'Payer mix',
        detail:
          (demand.preferredPayers?.length ?? 0) === 0
            ? 'Any payer'
            : `${Math.round(coverage.payerAlignment * 100)}% payer overlap`,
        sentiment: sentimentFor(coverage.payerAlignment),
      },
      {
        label: 'Risk modifier',
        detail: `${Math.round(coverage.riskModifier * 100)}% of allowable risk`,
        sentiment: sentimentFor(coverage.riskModifier),
      },
      {
        label: 'Mobility',
        detail: mobilityReason,
        sentiment: 'positive',
      },
      {
        label: 'Experience',
        detail: `${clinician.yearsExperience ?? 'N/A'} yrs vs ${demand.minExperienceYears ?? 'n/a'} required`,
        sentiment: sentimentFor(coverage.experience),
      },
    ];
  }

  private logReject(
    clinician: ClinicianProfile,
    demand: DemandSignal,
    reason: string,
    options: WorkforceMatchOptions,
    tags: string[] = []
  ) {
    if (!options.logRejection) {
      return;
    }
    const rejection: MatchRejection = {
      clinicianId: clinician.id,
      clinicianName: clinician.name,
      demandId: demand.id,
      reason,
      tags,
    };
    options.logRejection(rejection);
  }
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function windowMinutes(start: string, end: string): number {
  return Math.max(0, toMinutes(end) - toMinutes(start));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sentimentFor(value: number): MatchHighlight['sentiment'] {
  if (value >= 0.85) return 'positive';
  if (value < 0.5) return 'warning';
  return 'neutral';
}
