import type { AnchorRecord } from '../audit/anchor';

export type AuthorityCode = 'FSMB' | 'NCSBN' | 'GMC' | 'AHPRA' | string;

export interface BaseRegulatorySegment {
  authorityCode: AuthorityCode;
  fetchedAt: string;
  source: 'remote' | 'synthetic' | 'scraper';
}

export interface CmeCategory {
  code: string;
  label: string;
  minimumHours: number;
  description: string;
  renewalPeriodMonths: number;
}

export interface RenewalCycle {
  cycleLabel: string;
  months: number;
  minimumHours: number;
  requiresAudit: boolean;
  carryOverHours: number;
}

export interface SpecialtyRule {
  specialty: string;
  minimumHours: number;
  notes: string;
  enforcementLevel: 'recommended' | 'mandatory';
}

export interface CmeRequirementSnapshot extends BaseRegulatorySegment {
  categories: CmeCategory[];
  renewalCycles: RenewalCycle[];
  specialtyRules: SpecialtyRule[];
}

export interface ControlledSubstanceRequirement extends BaseRegulatorySegment {
  mateActHours: number;
  csLicenseRequirements: Array<{
    label: string;
    description: string;
    enforcement: 'mandatory' | 'state-dependent';
  }>;
  attestationFields: Array<{
    field: string;
    description: string;
    required: boolean;
  }>;
}

export interface StateBoardRule {
  state: string;
  boardName: string;
  renewalWindowMonths: number;
  telehealthFlexibility: 'full' | 'limited' | 'none';
  verificationLagDays: number;
  sourceUrl: string;
  lastObserved: string;
  requiresCmeAudit: boolean;
}

export interface StateRuleSnapshot extends BaseRegulatorySegment {
  states: StateBoardRule[];
}

export interface RegulatoryRuleSet {
  authorityCode: AuthorityCode;
  fetchedAt: string;
  cme: CmeRequirementSnapshot;
  controlledSubstances: ControlledSubstanceRequirement;
  stateRules: StateRuleSnapshot;
}

export interface RequirementDelta {
  label: string;
  requirementType: 'cme' | 'mate' | 'attestation';
  detail?: string;
  specialty?: string;
}

export interface RenewalDelta {
  state: string;
  previousWindow: number;
  currentWindow: number;
  boardName?: string;
}

export interface RuleDiffSummary {
  hasChanges: boolean;
  newRequirements: RequirementDelta[];
  removedRequirements: RequirementDelta[];
  changedRenewalWindows: RenewalDelta[];
  headline: string;
  tags: string[];
  hash: string;
  generatedAt: string;
  impactScore: number;
  metadata?: Record<string, unknown>;
}

export interface RegulatoryInsight {
  title: string;
  value: string;
  helper: string;
  tone?: 'default' | 'warning' | 'success';
}

export interface RegulatoryTimelineEvent {
  id: string;
  authorityCode: AuthorityCode;
  title: string;
  description?: string | null;
  eventType: string;
  tags: string[];
  diffHash?: string | null;
  occurredAt: string;
  snapshotId?: string | null;
  metadata?: Record<string, unknown>;
  anchor?: Pick<AnchorRecord, 'txHash' | 'network' | 'id'> & { timestamp: string } | null;
}

export interface RegulatoryRuleResponse {
  authority: {
    code: AuthorityCode;
    country: string;
    apiUrl?: string | null;
    updatedAt: string;
  };
  snapshot: {
    id: string;
    fetchedAt: string;
    snapshotHash: string;
    diffHash?: string | null;
    ruleVersion: number;
    anchor?: RegulatoryTimelineEvent['anchor'];
  };
  ruleSet: RegulatoryRuleSet;
  diff: RuleDiffSummary;
  timeline: RegulatoryTimelineEvent[];
  insights: RegulatoryInsight[];
  source: 'cache' | 'refreshed';
}

export interface RegulatoryIngestionResult {
  ruleSet: RegulatoryRuleSet;
  insights: RegulatoryInsight[];
}

