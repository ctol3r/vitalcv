import type { AiIncidentRecord } from './incident-log';

export type NistGenAiRiskTag =
  | 'InformationIntegrity'
  | 'Human-AI Configuration'
  | 'Harmful Bias'
  | 'Dangerous Content';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface BiasFlagReference {
  feature: string;
  description: string;
  severity: RiskSeverity;
  source?: string;
}

export interface RiskAssessmentEntry {
  id: NistGenAiRiskTag;
  label: string;
  triggered: boolean;
  severity: RiskSeverity;
  rationale: string;
  score: number;
}

export interface RiskInjectionContext {
  anomalies: AiIncidentRecord[];
  biasFlags: BiasFlagReference[];
  confidence: number;
  dominantContribution: number;
}

const RISK_TAG_LIBRARY: Array<{ id: NistGenAiRiskTag; label: string }> = [
  { id: 'InformationIntegrity', label: 'Information Integrity' },
  { id: 'Human-AI Configuration', label: 'Human-AI Configuration' },
  { id: 'Harmful Bias', label: 'Harmful Bias' },
  { id: 'Dangerous Content', label: 'Dangerous Content' },
];

export function injectNistGenAiRiskTags(context: RiskInjectionContext): RiskAssessmentEntry[] {
  return RISK_TAG_LIBRARY.map((tag) => buildTagAssessment(tag.id, tag.label, context));
}

function buildTagAssessment(
  id: NistGenAiRiskTag,
  label: string,
  context: RiskInjectionContext,
): RiskAssessmentEntry {
  switch (id) {
    case 'InformationIntegrity':
      return buildInformationIntegrityAssessment(label, context);
    case 'Human-AI Configuration':
      return buildHumanAiConfigurationAssessment(label, context);
    case 'Harmful Bias':
      return buildHarmfulBiasAssessment(label, context);
    case 'Dangerous Content':
      return buildDangerousContentAssessment(label, context);
    default:
      return {
        id,
        label,
        triggered: false,
        severity: 'low',
        rationale: 'No signal.',
        score: 0,
      };
  }
}

function buildInformationIntegrityAssessment(
  label: string,
  context: RiskInjectionContext,
): RiskAssessmentEntry {
  const hallucinations = context.anomalies.filter(
    (incident) => incident.event === 'hallucinated_fields',
  );
  const chainMismatches = context.anomalies.filter(
    (incident) => incident.event === 'chain_mismatch',
  );
  const incidents = [...hallucinations, ...chainMismatches];
  if (!incidents.length) {
    return {
      id: 'InformationIntegrity',
      label,
      triggered: false,
      severity: 'low',
      rationale: 'No hallucinations or chain mismatches detected.',
      score: 0,
    };
  }

  const highestSeverity = maxSeverity(incidents.map((incident) => incident.severity));
  const score = Math.min(1, 0.4 + incidents.length * 0.15 + severityWeight(highestSeverity));
  return {
    id: 'InformationIntegrity',
    label,
    triggered: true,
    severity: highestSeverity,
    rationale:
      chainMismatches.length > 0
        ? 'Anchor mismatch detected between expected and observed chains.'
        : 'Model emitted hallucinated fields requiring review.',
    score,
  };
}

function buildHumanAiConfigurationAssessment(
  label: string,
  context: RiskInjectionContext,
): RiskAssessmentEntry {
  const hasChainMismatch = context.anomalies.some(
    (incident) => incident.event === 'chain_mismatch',
  );
  const lowConfidence = context.confidence < 0.62;
  if (!hasChainMismatch && !lowConfidence) {
    return {
      id: 'Human-AI Configuration',
      label,
      triggered: false,
      severity: 'low',
      rationale: 'Confidence and chain configuration fall within guardrails.',
      score: 0,
    };
  }

  const severity: RiskSeverity = lowConfidence
    ? context.confidence < 0.45
      ? 'high'
      : 'medium'
    : 'medium';

  const rationale = hasChainMismatch
    ? 'Decision arrived on an unexpected chain configuration. Require operator validation.'
    : 'Model confidence below configured guardrail. Human override recommended.';

  const score = Math.min(1, (1 - context.confidence) + (hasChainMismatch ? 0.35 : 0));

  return {
    id: 'Human-AI Configuration',
    label,
    triggered: true,
    severity,
    rationale,
    score,
  };
}

function buildHarmfulBiasAssessment(
  label: string,
  context: RiskInjectionContext,
): RiskAssessmentEntry {
  if (!context.biasFlags.length) {
    return {
      id: 'Harmful Bias',
      label,
      triggered: false,
      severity: 'low',
      rationale: 'No bias flags raised during fairness audit.',
      score: 0,
    };
  }

  const highestSeverity = maxSeverity(context.biasFlags.map((flag) => flag.severity));
  const score = Math.min(
    1,
    context.biasFlags.reduce((sum, flag) => sum + severityWeight(flag.severity), 0) /
      context.biasFlags.length,
  );

  return {
    id: 'Harmful Bias',
    label,
    triggered: true,
    severity: highestSeverity,
    rationale: `${context.biasFlags.length} fairness guardrail(s) triggered.`,
    score,
  };
}

function buildDangerousContentAssessment(
  label: string,
  context: RiskInjectionContext,
): RiskAssessmentEntry {
  const unexpectedWeights = context.anomalies.filter(
    (incident) => incident.event === 'unexpected_weights',
  );
  const highContribution = context.dominantContribution > 1.5;

  if (!unexpectedWeights.length && !highContribution) {
    return {
      id: 'Dangerous Content',
      label,
      triggered: false,
      severity: 'low',
      rationale: 'Feature weights remain within calibrated bounds.',
      score: 0,
    };
  }

  const highestSeverity = maxSeverity(unexpectedWeights.map((incident) => incident.severity));
  const score = Math.min(
    1,
    unexpectedWeights.length * 0.2 +
      (highContribution ? 0.4 : 0) +
      severityWeight(highestSeverity || 'medium'),
  );

  return {
    id: 'Dangerous Content',
    label,
    triggered: true,
    severity: highestSeverity || 'medium',
    rationale: highContribution
      ? 'Dominant feature contribution exceeded safe band. Require review for extreme outputs.'
      : 'Weight calibration drift detected outside expected envelope.',
    score,
  };
}

function severityWeight(severity: RiskSeverity): number {
  switch (severity) {
    case 'high':
      return 0.9;
    case 'medium':
      return 0.6;
    default:
      return 0.3;
  }
}

function maxSeverity(levels: RiskSeverity[]): RiskSeverity {
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  return 'low';
}










