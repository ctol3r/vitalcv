import { getInvestigatorFinding } from './investigatorEngineService';

export interface FindingExplainSignal {
  type: 'reasoning' | 'score_signal' | 'evidence';
  label: string;
  value: string | number;
  confidence: number;
  source: string;
  observedAt?: string | null;
}

export interface FindingExplainPayload {
  findingId: string;
  title: string;
  reasoningChain: string[];
  contributingSignals: FindingExplainSignal[];
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )];
}

function signalSource(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

export async function buildFindingExplainPayload(
  findingId: string,
): Promise<FindingExplainPayload | null> {
  const finding = await getInvestigatorFinding(findingId);
  if (!finding) {
    return null;
  }

  const reasoningChain = uniqueStrings([
    finding.summary,
    finding.explanation,
    `Severity ${finding.severity}; status ${finding.status}; confidence ${(finding.confidence * 100).toFixed(0)}%.`,
    finding.storylineKey ? `Grouped under storyline key ${finding.storylineKey}.` : '',
  ]);

  const scoreSignals = Object.entries(finding.scoreSignals).map(([key, value]) => ({
    type: 'score_signal' as const,
    label: key,
    value,
    confidence: finding.confidence,
    source: 'finding_ranker',
  }));

  const evidenceSignals = finding.supportingEvidence.map((evidence) => ({
    type: 'evidence' as const,
    label: evidence.recordType ?? evidence.evidenceType,
    value: evidence.snippet ?? evidence.recordId ?? evidence.evidenceType,
    confidence: finding.confidence,
    source: signalSource(evidence.sourceLabel ?? evidence.sourceId, evidence.evidenceType),
    observedAt: evidence.observedAt ?? null,
  }));

  return {
    findingId: finding.findingId,
    title: finding.title,
    reasoningChain,
    contributingSignals: [
      {
        type: 'reasoning',
        label: 'priority_score',
        value: finding.priorityScore,
        confidence: finding.confidence,
        source: finding.investigatorId,
      },
      ...scoreSignals,
      ...evidenceSignals,
    ],
  };
}
