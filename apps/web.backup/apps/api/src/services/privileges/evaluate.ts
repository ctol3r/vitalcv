import { PrismaClient } from '@prisma/client';
import { normalizePrivilegeCode } from '../../../../../services/privyDep/models/PrivilegeNode';
import {
  getPrerequisitesForPrivilege,
  type PrerequisiteRule,
} from '../../../../../services/privyDep/rules/prereqRuleSet';
import type { ClinicianCredentialGraph } from './evaluator';
import { buildCredentialGraph } from './graph';

const prisma = new PrismaClient();

type RuleSeverity = 'blocker' | 'review';

export interface PrivilegeEvidenceItem {
  label: string;
  value: string;
  source?: string;
}

export interface RuleResult {
  type: string;
  label: string;
  met: boolean;
  severity: RuleSeverity;
  detail: string;
  evidence?: PrivilegeEvidenceItem[];
}

export interface PrivilegeEligibilityDetail {
  privilegeCode: string;
  summary?: string;
  status: 'eligible' | 'needs-review' | 'missing';
  score: number;
  blockers: string[];
  pendingReview: string[];
  rules: RuleResult[];
  supportingEvidence: PrivilegeEvidenceItem[];
  recommendation: string;
}

export interface ClinicianPrivilegeEvaluationV2 {
  clinicianId: string;
  hospitalId: string;
  specialty: string;
  privilegeSetId: string;
  version: number;
  evaluatedAt: string;
  privileges: PrivilegeEligibilityDetail[];
  summary: {
    eligible: number;
    needsReview: number;
    missing: number;
    overallScore: number;
  };
}

export interface PrivilegeEvaluationV2Input {
  clinicianId: string;
  hospitalId: string;
  specialty: string;
  privilegeCodes?: string[];
  privilegeSetVersion?: number;
}

type LicenseRule = { type: 'LICENSE'; states?: string[] };

interface VolumeRecord {
  count: number;
  periodEnd: Date;
}

type VolumeIndex = Map<string, VolumeRecord[]>;

const DEFAULT_RULES: LicenseRule[] = [{ type: 'LICENSE' }];

export async function evaluateClinicianPrivilegesV2(
  input: PrivilegeEvaluationV2Input,
  prismaClient: PrismaClient = prisma,
): Promise<ClinicianPrivilegeEvaluationV2> {
  const service = new PrivilegeEvaluatorV2(prismaClient);
  return service.evaluate(input);
}

export class PrivilegeEvaluatorV2 {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async evaluate(input: PrivilegeEvaluationV2Input): Promise<ClinicianPrivilegeEvaluationV2> {
    const privilegeSet = await this.loadPrivilegeSet(input);
    const graph = await buildCredentialGraph(input.clinicianId);
    if (!graph) {
      throw new Error(`Clinician ${input.clinicianId} not found`);
    }

    const requestedCodes = input.privilegeCodes?.map(normalizePrivilegeCode);
    const privilegeCodes = (requestedCodes?.length ? requestedCodes : privilegeSet.procedures).map(
      normalizePrivilegeCode,
    );

    const volumeIndex = await this.loadVolumeIndex(input.clinicianId);
    const now = new Date();

    const privileges = privilegeCodes.map((code) =>
      this.evaluatePrivilege({
        code,
        graph,
        volumeIndex,
        now,
      }),
    );

    const summary = privileges.reduce(
      (acc, privilege) => {
        acc[privilege.status] += 1;
        return acc;
      },
      { eligible: 0, 'needs-review': 0, missing: 0 } as Record<PrivilegeEligibilityDetail['status'], number>,
    );

    const total = privileges.length || 1;
    const overallScore = Number(
      (
        (privileges.reduce((sum, privilege) => sum + privilege.score, 0) || 0) /
        total
      ).toFixed(3),
    );

    return {
      clinicianId: input.clinicianId,
      hospitalId: input.hospitalId,
      specialty: input.specialty,
      privilegeSetId: privilegeSet.id,
      version: privilegeSet.version,
      evaluatedAt: now.toISOString(),
      privileges,
      summary: {
        eligible: summary.eligible,
        needsReview: summary['needs-review'],
        missing: summary.missing,
        overallScore,
      },
    };
  }

  private async loadPrivilegeSet(input: PrivilegeEvaluationV2Input) {
    if (input.privilegeSetVersion) {
      const explicit = await this.prismaClient.privilegeSet.findFirst({
        where: {
          hospitalId: input.hospitalId,
          specialty: input.specialty,
          version: input.privilegeSetVersion,
        },
      });
      if (!explicit) {
        throw new Error(
          `PrivilegeSet ${input.hospitalId}/${input.specialty} v${input.privilegeSetVersion} not found`,
        );
      }
      return explicit;
    }

    const latest = await this.prismaClient.privilegeSet.findFirst({
      where: {
        hospitalId: input.hospitalId,
        specialty: input.specialty,
      },
      orderBy: { version: 'desc' },
    });

    if (!latest) {
      throw new Error(`PrivilegeSet ${input.hospitalId}/${input.specialty} not found`);
    }
    return latest;
  }

  private async loadVolumeIndex(clinicianId: string): Promise<VolumeIndex> {
    const records = await this.prismaClient.procedureVolume.findMany({
      where: { clinicianId },
      orderBy: { periodEnd: 'desc' },
    });
    const index: VolumeIndex = new Map();

    records.forEach((record) => {
      const normalized = normalizeProcedureLabel(record.procedure);
      if (!normalized) return;
      const entry = index.get(normalized) ?? [];
      entry.push({
        count: record.count ?? 0,
        periodEnd: new Date(record.periodEnd ?? record.createdAt ?? new Date()),
      });
      index.set(normalized, entry);
    });

    index.forEach((list) => list.sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime()));
    return index;
  }

  private evaluatePrivilege({
    code,
    graph,
    volumeIndex,
    now,
  }: {
    code: string;
    graph: ClinicianCredentialGraph;
    volumeIndex: VolumeIndex;
    now: Date;
  }): PrivilegeEligibilityDetail {
    const prerequisites = getPrerequisitesForPrivilege(code);
    const rules: Array<PrerequisiteRule | LicenseRule> = [...(prerequisites?.rules ?? []), ...DEFAULT_RULES];

    const ruleResults = rules.map((rule) =>
      this.evaluateRule(rule, {
        graph,
        volumeIndex,
        now,
      }),
    );

    const blockers = ruleResults
      .filter((result) => !result.met && result.severity === 'blocker')
      .map((result) => result.detail);
    const pendingReview = ruleResults
      .filter((result) => !result.met && result.severity === 'review')
      .map((result) => result.detail);
    const supportingEvidence = ruleResults.flatMap((result) => result.evidence ?? []);

    const status: PrivilegeEligibilityDetail['status'] = blockers.length
      ? 'missing'
      : pendingReview.length
        ? 'needs-review'
        : 'eligible';

    const score =
      rules.length === 0
        ? 1
        : Number(
            (
              ruleResults.reduce((sum, result) => sum + (result.met ? 1 : 0), 0) / rules.length
            ).toFixed(3),
          );

    return {
      privilegeCode: code,
      summary: prerequisites?.summary,
      status,
      score,
      blockers,
      pendingReview,
      rules: ruleResults,
      supportingEvidence,
      recommendation: this.buildRecommendation(status, blockers, pendingReview),
    };
  }

  private evaluateRule(
    rule: PrerequisiteRule | LicenseRule,
    context: { graph: ClinicianCredentialGraph; volumeIndex: VolumeIndex; now: Date },
  ): RuleResult {
    switch (rule.type) {
      case 'BOARD_CERT':
        return this.evaluateBoardRule(rule, context);
      case 'CERT_PATHWAY':
        return this.evaluateCertificationRule(rule, context);
      case 'CASE_LOG':
        return this.evaluateCaseLogRule(rule, context);
      case 'FPPE':
        return this.evaluateFppeRule(rule);
      case 'OPPE':
        return this.evaluateOppeRule(rule);
      case 'LICENSE':
        return this.evaluateLicenseRule(rule, context.graph);
      default:
        return {
          type: rule.type,
          label: rule.type,
          met: true,
          severity: 'review',
          detail: 'No evaluation available for this rule type',
        };
    }
  }

  private evaluateBoardRule(
    rule: Extract<PrerequisiteRule, { type: 'BOARD_CERT' }>,
    context: { graph: ClinicianCredentialGraph; now: Date },
  ): RuleResult {
    const requiredBoards = (rule.boards ?? []).map((board) => board.toUpperCase());
    const requiredSpecialties = (rule.specialties ?? []).map((specialty) => specialty.toLowerCase());
    const bufferMonths = rule.expirationBufferMonths ?? 6;
    const bufferMs = monthsToMs(bufferMonths);

    const matches = context.graph.boardCertifications.filter((cert) => {
      const board = (cert.board ?? '').toUpperCase();
      const specialty = (cert.specialty ?? '').toLowerCase();
      const boardMatch = !requiredBoards.length || requiredBoards.some((candidate) => board.includes(candidate));
      const specialtyMatch =
        !requiredSpecialties.length || requiredSpecialties.some((candidate) => specialty.includes(candidate));
      if (!(boardMatch && specialtyMatch)) return false;

      if (!cert.expiresAt) return true;
      const expiry = new Date(cert.expiresAt).getTime();
      return expiry > Date.now() + bufferMs;
    });

    if (matches.length === 0) {
      return {
        type: 'BOARD_CERT',
        label: 'Board certification',
        met: false,
        severity: 'blocker',
        detail: `Board certification required (${rule.boards?.join(', ') ?? 'see matrix'})`,
      };
    }

    return {
      type: 'BOARD_CERT',
      label: 'Board certification',
      met: true,
      severity: 'blocker',
      detail: 'Active board certification on file',
      evidence: matches.map((cert) => ({
        label: cert.board,
        value: `Expires ${cert.expiresAt ? new Date(cert.expiresAt).toISOString().slice(0, 10) : 'n/a'}`,
        source: 'board-certification',
      })),
    };
  }

  private evaluateCertificationRule(
    rule: Extract<PrerequisiteRule, { type: 'CERT_PATHWAY' }>,
    context: { graph: ClinicianCredentialGraph },
  ): RuleResult {
    const pathways = (rule.pathways ?? []).map((pathway) => pathway.toLowerCase());
    const completed = context.graph.trainings.filter((training) => {
      if (!training.name) return false;
      return pathways.some((pathway) => training.name.toLowerCase().includes(pathway));
    });

    if (completed.length === 0) {
      return {
        type: 'CERT_PATHWAY',
        label: 'Training pathway',
        met: false,
        severity: 'blocker',
        detail: `Complete training pathway (${rule.pathways?.join(', ') ?? 'see matrix'})`,
      };
    }

    return {
      type: 'CERT_PATHWAY',
      label: 'Training pathway',
      met: true,
      severity: 'blocker',
      detail: 'Training evidence provided',
      evidence: completed.map((training) => ({
        label: training.name ?? 'Training',
        value: training.completedAt ?? 'completed',
        source: 'training-record',
      })),
    };
  }

  private evaluateCaseLogRule(
    rule: Extract<PrerequisiteRule, { type: 'CASE_LOG' }>,
    context: { volumeIndex: VolumeIndex; now: Date },
  ): RuleResult {
    const normalizedProcedure = normalizeProcedureLabel(rule.procedure);
    const lookbackMonths = rule.lookbackMonths ?? 24;
    const lookbackStart = new Date(context.now.getTime() - monthsToMs(lookbackMonths));
    const records = context.volumeIndex.get(normalizedProcedure) ?? [];
    const observed = records
      .filter((record) => record.periodEnd >= lookbackStart)
      .reduce((sum, record) => sum + record.count, 0);
    const met = observed >= rule.minCases;

    return {
      type: 'CASE_LOG',
      label: `Case log: ${rule.procedure}`,
      met,
      severity: 'blocker',
      detail: met
        ? `Observed ${observed} cases in ${lookbackMonths} months`
        : `Need ${rule.minCases} ${rule.procedure} cases (observed ${observed})`,
      evidence: met
        ? [
            {
              label: rule.procedure,
              value: `${observed} / ${rule.minCases} cases (lookback ${lookbackMonths}m)`,
              source: 'case-log',
            },
          ]
        : undefined,
    };
  }

  private evaluateFppeRule(
    rule: Extract<PrerequisiteRule, { type: 'FPPE' }>,
  ): RuleResult {
    return {
      type: 'FPPE',
      label: 'FPPE oversight',
      met: false,
      severity: 'review',
      detail: `FPPE documentation (${rule.casesObserved} observed cases) required for committee upload`,
    };
  }

  private evaluateOppeRule(
    rule: Extract<PrerequisiteRule, { type: 'OPPE' }>,
  ): RuleResult {
    return {
      type: 'OPPE',
      label: 'OPPE monitoring',
      met: false,
      severity: 'review',
      detail: `Provide OPPE metric "${rule.metric}" within ${rule.lookbackMonths} months (threshold ${rule.threshold})`,
    };
  }

  private evaluateLicenseRule(rule: LicenseRule, graph: ClinicianCredentialGraph): RuleResult {
    const activeLicenses = graph.licenses.filter((license) => {
      if (license.status && license.status.toLowerCase() !== 'active') {
        return false;
      }
      if (!license.expiresAt) return true;
      return new Date(license.expiresAt).getTime() > Date.now();
    });

    if (!activeLicenses.length) {
      return {
        type: 'LICENSE',
        label: 'Active license',
        met: false,
        severity: 'blocker',
        detail: 'No active unrestricted license on record',
      };
    }

    if (rule.states?.length) {
      const normalizedStates = rule.states.map((state) => state.toUpperCase());
      const matches = activeLicenses.filter((license) =>
        license.jurisdiction && normalizedStates.includes(license.jurisdiction.toUpperCase()),
      );
      if (!matches.length) {
        return {
          type: 'LICENSE',
          label: 'Active license',
          met: false,
          severity: 'blocker',
          detail: `Need active license in ${rule.states.join(', ')}`,
        };
      }
    }

    return {
      type: 'LICENSE',
      label: 'Active license',
      met: true,
      severity: 'blocker',
      detail: 'Active unrestricted license found',
      evidence: activeLicenses.slice(0, 3).map((license) => ({
        label: license.jurisdiction ?? 'License',
        value: license.expiresAt ? `Expires ${license.expiresAt}` : 'No expiry on file',
        source: 'license',
      })),
    };
  }

  private buildRecommendation(
    status: PrivilegeEligibilityDetail['status'],
    blockers: string[],
    pendingReview: string[],
  ): string {
    if (status === 'eligible') {
      return 'Ready for committee packet';
    }
    if (blockers.length) {
      return blockers[0];
    }
    if (pendingReview.length) {
      return pendingReview[0];
    }
    return 'Collect additional evidence';
  }
}

function normalizeProcedureLabel(value?: string | null): string {
  if (!value) return '';
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
}

function monthsToMs(months: number): number {
  if (!Number.isFinite(months) || months <= 0) {
    return 24 * 30 * 24 * 60 * 60 * 1000;
  }
  return months * 30 * 24 * 60 * 60 * 1000;
}










