import { computePriorityScore, noveltyFromSignal, severityWithNovelty } from './novelty';
import { sourceDefinitionFor } from './sources';
import { groupFindingsIntoStorylines } from './storylines';
import type {
  EngineFinding,
  EngineStoryline,
  InvestigatorEvidenceItem,
  InvestigatorSeverity,
  NormalizedInvestigatorSignal,
  StorylineAnchorType,
} from './types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function simpleHash(input: string): string {
  let hash = 0;
  for (const char of input) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function weekBucket(timestamp: string): string {
  const value = Date.parse(timestamp);
  if (!Number.isFinite(value)) {
    return 'unknown-week';
  }

  return new Date(Math.floor(value / SEVEN_DAYS_MS) * SEVEN_DAYS_MS).toISOString().slice(0, 10);
}

function baseSeverityForSignal(signal: NormalizedInvestigatorSignal): InvestigatorSeverity {
  if (signal.signalType === 'exclusion') {
    return 'critical';
  }

  if (signal.signalType === 'payment') {
    return (signal.magnitude ?? 0) >= 0.8 ? 'high' : 'medium';
  }

  if (signal.signalType === 'grant' || signal.signalType === 'trial') {
    return 'high';
  }

  if (signal.signalType === 'publication' || signal.signalType === 'network') {
    return 'medium';
  }

  return 'medium';
}

function storylineAnchorType(signal: NormalizedInvestigatorSignal): StorylineAnchorType {
  if (signal.eventAnchor?.id) {
    return 'event';
  }

  if (signal.trendAnchor?.id) {
    return 'trend';
  }

  return 'entity';
}

function storylineKey(signal: NormalizedInvestigatorSignal): string {
  if (signal.eventAnchor?.id) {
    return `event:${signal.signalType}:${signal.eventAnchor.id}`;
  }

  if (signal.trendAnchor?.id) {
    return `trend:${signal.signalType}:${signal.trendAnchor.id}`;
  }

  return `entity:${signal.providerId}:${signal.signalType}`;
}

function dedupeKey(signal: NormalizedInvestigatorSignal): string {
  if (signal.eventAnchor?.id) {
    return `${signal.providerId}:${signal.signalType}:${signal.eventAnchor.id}:${weekBucket(signal.detectedAt)}`;
  }

  return `${signal.providerId}:${signal.signalType}:${weekBucket(signal.detectedAt)}`;
}

function titleForSignal(signal: NormalizedInvestigatorSignal): string {
  const providerLabel = signal.providerLabel ?? signal.providerId;
  switch (signal.signalType) {
    case 'exclusion':
      return `${providerLabel} exclusion status changed`;
    case 'trial':
      return `${providerLabel} trial activity changed`;
    case 'publication':
      return `${providerLabel} publication record changed`;
    case 'grant':
      return `${providerLabel} grant activity changed`;
    case 'payment':
      return `${providerLabel} payment profile changed`;
    case 'network':
      return `${providerLabel} network signal changed`;
    case 'practice':
      return `${providerLabel} practice footprint changed`;
    case 'credential':
    default:
      return `${providerLabel} credential signal changed`;
  }
}

function explanationForSignal(signal: NormalizedInvestigatorSignal, noveltyScore: number, priorityScore: number): string {
  const source = sourceDefinitionFor(signal.sourceId);
  const corroborationCount = signal.corroborationSourceIds?.length ?? 0;
  return [
    `${source.label} produced a ${signal.signalType} signal for provider ${signal.providerId}.`,
    signal.summary,
    `Novelty ${noveltyScore.toFixed(2)} and investigation priority ${priorityScore.toFixed(2)} were computed from first occurrence, change magnitude, peer rarity, recency, centrality, and corroboration.`,
    corroborationCount > 0
      ? `${corroborationCount} corroborating source(s) matched the same anchor.`
      : 'No cross-source corroboration was available for this signal yet.',
  ].join(' ');
}

function normalizeEvidence(evidence: readonly InvestigatorEvidenceItem[]): InvestigatorEvidenceItem[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.sourceId}:${item.recordId ?? ''}:${item.label}:${item.observedAt}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildFinding(signal: NormalizedInvestigatorSignal, options: {
  firstOccurrence: boolean;
}): EngineFinding {
  const novelty = noveltyFromSignal(signal, { firstOccurrence: options.firstOccurrence });
  const severity = severityWithNovelty(baseSeverityForSignal(signal), novelty.score);
  const priority = computePriorityScore({
    severity,
    providerCentrality: signal.providerCentrality ?? null,
    noveltyScore: novelty.score,
    sourceConfidence: signal.sourceConfidence ?? sourceDefinitionFor(signal.sourceId).defaultConfidence,
    corroborationCount: signal.corroborationSourceIds?.length ?? 0,
  });
  const anchorType = storylineAnchorType(signal);
  const key = storylineKey(signal);
  const evidence = normalizeEvidence(signal.evidence);

  return {
    providerId: signal.providerId,
    signalType: signal.signalType,
    severity,
    confidence: signal.sourceConfidence ?? sourceDefinitionFor(signal.sourceId).defaultConfidence,
    summary: signal.summary,
    evidence,
    timestamp: signal.detectedAt,
    title: titleForSignal(signal),
    explanation: explanationForSignal(signal, novelty.score, priority.score),
    novelty,
    priority,
    storylineKey: key,
    storylineAnchorType: anchorType,
    dedupeKey: dedupeKey(signal),
    metadata: {
      ...(signal.metadata ?? {}),
      providerLabel: signal.providerLabel ?? null,
      providerSpecialty: signal.providerSpecialty ?? null,
      providerState: signal.providerState ?? null,
      providerCentrality: signal.providerCentrality ?? null,
      sourceRecordId: signal.sourceRecordId ?? null,
      noveltyScore: novelty.score,
      noveltyBreakdown: novelty.breakdown,
      investigationPriorityScore: priority.score,
      investigationPriorityBreakdown: priority.breakdown,
      storylineAnchorType: anchorType,
      storylineTitle: signal.eventAnchor?.label
        ?? signal.trendAnchor?.label
        ?? `${signal.providerLabel ?? signal.providerId} ${signal.signalType}`,
      trendAnchorLabel: signal.trendAnchor?.label ?? null,
      corroborationSourceIds: signal.corroborationSourceIds ?? [],
      eventAnchorId: signal.eventAnchor?.id ?? null,
      eventAnchorType: signal.eventAnchor?.type ?? null,
    },
  };
}

export function buildInvestigatorOutputs(input: {
  signals: NormalizedInvestigatorSignal[];
  existingStorylineKeys?: string[];
}): {
  findings: EngineFinding[];
  storylines: EngineStoryline[];
} {
  const existing = new Set(input.existingStorylineKeys ?? []);
  const findings = input.signals.map((signal) => buildFinding(signal, {
    firstOccurrence: !existing.has(storylineKey(signal)),
  }));

  return {
    findings,
    storylines: groupFindingsIntoStorylines(findings),
  };
}
