import {
  ComplianceFinding,
  FusionRuleMatch,
  FusionSeverity,
  FusionSignal,
  QualitySignalType,
  CredentialSignalType,
} from '../types';

export interface FusionRuleContext {
  qualitySignals: FusionSignal[];
  credentialSignals: FusionSignal[];
  complianceFindings: ComplianceFinding[];
}

interface FusionRuleDefinition {
  id: string;
  label: string;
  severity: FusionSeverity;
  impact: number;
  description: string;
  recommendedActions: string[];
  evaluate(context: FusionRuleContext): string[] | null;
}

const severityRank: Record<FusionSeverity, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function signalIdsForType(
  signals: FusionSignal[],
  type: string,
  minSeverity: FusionSeverity = 'LOW'
): string[] {
  const threshold = severityRank[minSeverity];
  return signals
    .filter(
      (signal) =>
        signal.type === type && severityRank[signal.severity] >= threshold
    )
    .map((signal) => signal.id);
}

function hasSignal(
  signals: FusionSignal[],
  type: string,
  minSeverity: FusionSeverity = 'LOW'
): boolean {
  return signalIdsForType(signals, type, minSeverity).length > 0;
}

const fusionRules: FusionRuleDefinition[] = [
  {
    id: 'OPPE_FAIL_BOARD_DRIFT',
    label: 'OPPE failing with board drift',
    severity: 'HIGH',
    impact: 18,
    description:
      'Active OPPE failure combined with board credential drift indicates elevated privileging risk.',
    recommendedActions: [
      'Escalate to Credentials Committee for targeted FPPE',
      'Lock new privilege requests until board attestation updated',
    ],
    evaluate(context) {
      if (
        !hasSignal(
          context.qualitySignals,
          QualitySignalType.OPPE_FAILURE,
          'MODERATE'
        )
      ) {
        return null;
      }
      const boardDriftIds = signalIdsForType(
        context.credentialSignals,
        CredentialSignalType.BOARD_STATUS_DRIFT,
        'MODERATE'
      );
      if (!boardDriftIds.length) return null;
      const oppeIds = signalIdsForType(
        context.qualitySignals,
        QualitySignalType.OPPE_FAILURE,
        'MODERATE'
      );
      return [...oppeIds, ...boardDriftIds];
    },
  },
  {
    id: 'PECOS_DENIAL_SPIKE',
    label: 'PECOS conflict with payer denial spike',
    severity: 'HIGH',
    impact: 16,
    description:
      'CMS enrollment conflicts paired with payer denial spikes typically precede claim holds.',
    recommendedActions: [
      'Route to payer ops for immediate PECOS remediation',
      'Notify revenue cycle to prepare for claim edits',
    ],
    evaluate(context) {
      if (
        !hasSignal(
          context.credentialSignals,
          CredentialSignalType.PECOS_CONFLICT,
          'MODERATE'
        )
      ) {
        return null;
      }
      const denialIds = signalIdsForType(
        context.qualitySignals,
        QualitySignalType.PAYER_DENIAL_SPIKE,
        'MODERATE'
      );
      if (!denialIds.length) return null;
      const pecosIds = signalIdsForType(
        context.credentialSignals,
        CredentialSignalType.PECOS_CONFLICT,
        'MODERATE'
      );
      return [...pecosIds, ...denialIds];
    },
  },
  {
    id: 'LICENSE_COMPLICATION_CRITICAL',
    label: 'License drift with complication spike',
    severity: 'CRITICAL',
    impact: 24,
    description:
      'Concurrent license drift and quality complication spike requires immediate suspension review.',
    recommendedActions: [
      'Pause scheduling until license status confirmed',
      'Launch focused review for impacted cases',
    ],
    evaluate(context) {
      if (
        !hasSignal(
          context.credentialSignals,
          CredentialSignalType.LICENSE_DRIFT,
          'MODERATE'
        )
      ) {
        return null;
      }
      const complicationIds = signalIdsForType(
        context.qualitySignals,
        QualitySignalType.COMPLICATION_SPIKE,
        'HIGH'
      );
      if (!complicationIds.length) return null;
      const licenseIds = signalIdsForType(
        context.credentialSignals,
        CredentialSignalType.LICENSE_DRIFT,
        'MODERATE'
      );
      return [...licenseIds, ...complicationIds];
    },
  },
  {
    id: 'FPPE_PRIVILEGE_TENSION',
    label: 'FPPE escalation with privilege gaps',
    severity: 'HIGH',
    impact: 15,
    description:
      'Escalating FPPE/OPPE oversight combined with privilege gaps signals readiness risk.',
    recommendedActions: [
      'Assign mentor for remedial proctoring',
      'Hold additional privilege approvals pending FPPE completion',
    ],
    evaluate(context) {
      if (
        !hasSignal(
          context.qualitySignals,
          QualitySignalType.FPPE_ESCALATION,
          'MODERATE'
        )
      ) {
        return null;
      }
      const privilegeIds = signalIdsForType(
        context.credentialSignals,
        CredentialSignalType.PRIVILEGE_GAP,
        'LOW'
      );
      if (!privilegeIds.length) return null;
      const fppeIds = signalIdsForType(
        context.qualitySignals,
        QualitySignalType.FPPE_ESCALATION,
        'MODERATE'
      );
      return [...fppeIds, ...privilegeIds];
    },
  },
  {
    id: 'QUALITY_HOLD_SANCTION',
    label: 'Quality hold with sanction activity',
    severity: 'CRITICAL',
    impact: 20,
    description:
      'Quality hold events paired with sanction activity require MEC review.',
    recommendedActions: [
      'Trigger MEC review workflow',
      'Notify compliance of sanction correlation',
    ],
    evaluate(context) {
      if (
        !hasSignal(
          context.qualitySignals,
          QualitySignalType.QUALITY_HOLD,
          'MODERATE'
        )
      ) {
        return null;
      }
      const sanctionIds = signalIdsForType(
        context.credentialSignals,
        CredentialSignalType.SANCTION_ACTIVITY,
        'LOW'
      );
      if (!sanctionIds.length) return null;
      const holdIds = signalIdsForType(
        context.qualitySignals,
        QualitySignalType.QUALITY_HOLD,
        'MODERATE'
      );
      return [...holdIds, ...sanctionIds];
    },
  },
];

export function evaluateFusionRules(
  context: FusionRuleContext
): FusionRuleMatch[] {
  return fusionRules
    .map((rule) => {
      const matchedSignals = rule.evaluate(context);
      if (!matchedSignals) return null;
      return {
        id: rule.id,
        label: rule.label,
        severity: rule.severity,
        impact: rule.impact,
        matchedSignals,
        description: rule.description,
        recommendedActions: rule.recommendedActions,
      };
    })
    .filter((match): match is FusionRuleMatch => Boolean(match));
}

export const FUSION_RULES = fusionRules;


