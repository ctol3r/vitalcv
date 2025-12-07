import {
  ComplianceItem,
  DriftEvent,
  EvidencePoint,
  ExplainSectionOptions,
  RiskProfile,
  SectionNarrative,
} from './narrativeTypes';
import {
  DEFAULT_HIGHLIGHT_LIMIT,
  clampScore,
  compareBySeverity,
  dedupeStrings,
  emptySection,
  formatDate,
  inferRiskTier,
  limitList,
  severityWeight,
} from './utils';

export function explainRiskSection(
  profile?: RiskProfile,
  options?: ExplainSectionOptions
): SectionNarrative {
  if (!profile) {
    return emptySection('risk');
  }

  const highlightLimit = options?.highlightLimit ?? DEFAULT_HIGHLIGHT_LIMIT;
  const deterministic = options?.deterministic ?? false;

  const score = clampScore(profile.score ?? 0);
  const tier = profile.tier ?? inferRiskTier(score);
  const signals = [...(profile.signals ?? [])];
  const driftEvents = [...(profile.driftEvents ?? [])];
  const expirations = [...(profile.expiredItems ?? [])];

  const unresolvedSignals = signals.filter((signal) => !signal.resolved);
  const criticalSignals = unresolvedSignals
    .filter((signal) => severityWeight(signal.severity) >= severityWeight('medium'))
    .sort((a, b) =>
      compareBySeverity(a.severity, b.severity) || a.label.localeCompare(b.label)
    );

  const openDriftEvents = driftEvents
    .filter((event) => !event.resolved)
    .sort(
      (a, b) =>
        compareBySeverity(a.severity, b.severity) ||
        (b.detectedAt ?? '').localeCompare(a.detectedAt ?? '')
    );

  const blockingExpirations = expirations.filter(
    (item) => item.status === 'EXPIRED' || item.status === 'SUSPENDED'
  );

  const summaryParts = [
    `Risk score ${score} (${tier})`,
    `${unresolvedSignals.length} active driver${unresolvedSignals.length === 1 ? '' : 's'}`,
  ];

  if (profile.monitoringLevel) {
    summaryParts.push(`monitoring: ${profile.monitoringLevel}`);
  }

  if (criticalSignals.length === 0 && openDriftEvents.length === 0 && blockingExpirations.length === 0) {
    summaryParts.push('no critical blockers detected');
  } else {
    const issues = criticalSignals.length + openDriftEvents.length + blockingExpirations.length;
    summaryParts.push(`${issues} blocker${issues === 1 ? '' : 's'} require review`);
  }

  const highlights: string[] = [];

  if (tier === 'low' || (tier === 'moderate' && score < 50)) {
    highlights.push(`Risk posture remains ${tier} with score ${score}.`);
  }

  if (criticalSignals.length === 0) {
    highlights.push('No high-severity risk drivers are open.');
  }

  if (blockingExpirations.length === 0 && expirations.length === 0) {
    highlights.push('All monitored credentials are current.');
  }

  if (openDriftEvents.length === 0 && driftEvents.length > 0) {
    highlights.push('Recent drift events have been resolved.');
  }

  const concerns: string[] = [];

  for (const signal of criticalSignals) {
    concerns.push(
      `${signal.label} (${signal.severity}) – ${signal.description}${
        signal.detectedAt ? ` since ${formatDate(signal.detectedAt)}` : ''
      }.`
    );
  }

  for (const event of openDriftEvents) {
    concerns.push(
      `${event.label} (${event.category}) detected ${formatDate(event.detectedAt)} – ${
        event.description
      }.`
    );
  }

  for (const item of blockingExpirations) {
    concerns.push(
      `${item.label} is ${item.status.toLowerCase()}${
        item.expiresAt ? ` (expired ${formatDate(item.expiresAt)})` : ''
      }.`
    );
  }

  const evidence: EvidencePoint[] = [
    ...signals.map((signal) => ({
      id: signal.id,
      label: signal.label,
      detail: signal.description,
      severity: signal.severity,
      observedAt: signal.detectedAt,
      resolved: signal.resolved,
      sectionRef: 'risk',
    })),
    ...mapDriftToEvidence(openDriftEvents),
    ...mapComplianceToEvidence(expirations),
  ];

  const lastEvaluated = profile.lastEvaluatedAt ? new Date(profile.lastEvaluatedAt) : undefined;
  const stalenessDays =
    lastEvaluated && Number.isFinite(lastEvaluated.getTime())
      ? Math.floor((Date.now() - lastEvaluated.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

  const confidence =
    stalenessDays === undefined
      ? 'medium'
      : stalenessDays <= 30
      ? 'high'
      : stalenessDays <= 90
      ? 'medium'
      : 'low';

  return {
    section: 'risk',
    summary: summaryParts.join(' • '),
    highlights: limitList(dedupeStrings(highlights), highlightLimit),
    concerns: dedupeStrings(concerns),
    evidence: deterministic ? limitList(evidence, highlightLimit * 2) : evidence,
    confidence,
  };
}

function mapDriftToEvidence(events: DriftEvent[]): EvidencePoint[] {
  return events.map((event) => ({
    id: event.id,
    label: event.label,
    severity: event.severity,
    detail: event.description,
    observedAt: event.detectedAt,
    resolved: event.resolved,
    sectionRef: 'risk',
  }));
}

function mapComplianceToEvidence(items: ComplianceItem[]): EvidencePoint[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    severity: item.severity ?? (item.status === 'EXPIRED' ? 'high' : 'medium'),
    detail: `${item.status}${
      item.expiresAt ? `, expires ${formatDate(item.expiresAt)}` : ''
    }`,
    observedAt: item.lastVerifiedAt,
    resolved: item.status === 'ACTIVE',
    sectionRef: 'risk',
  }));
}

import { getServiceLogger } from '../logging/serviceLogger';
import {
  ComplianceItem,
  DriftEvent,
  EvidencePoint,
  ExplainSectionOptions,
  RiskProfile,
  SectionNarrative,
} from './types';
import {
  DEFAULT_HIGHLIGHT_LIMIT,
  clampScore,
  compareBySeverity,
  dedupeStrings,
  emptySection,
  formatDate,
  inferRiskTier,
  limitList,
  severityWeight,
} from './utils';

const log = getServiceLogger('committeePacket/explainRisk');

export function explainRiskSection(
  profile?: RiskProfile,
  options?: ExplainSectionOptions
): SectionNarrative {
  if (!profile) {
    log.warn('Risk profile missing; returning empty section');
    return emptySection('risk');
  }

  const highlightLimit = options?.highlightLimit ?? DEFAULT_HIGHLIGHT_LIMIT;
  const deterministic = options?.deterministic ?? false;

  const score = clampScore(profile.score ?? 0);
  const tier = profile.tier ?? inferRiskTier(score);
  const signals = [...(profile.signals ?? [])];
  const driftEvents = [...(profile.driftEvents ?? [])];
  const expirations = [...(profile.expiredItems ?? [])];

  const unresolvedSignals = signals.filter((signal) => !signal.resolved);
  const criticalSignals = unresolvedSignals
    .filter((signal) => severityWeight(signal.severity) >= severityWeight('medium'))
    .sort((a, b) =>
      compareBySeverity(a.severity, b.severity) || a.label.localeCompare(b.label)
    );

  const openDriftEvents = driftEvents
    .filter((event) => !event.resolved)
    .sort(
      (a, b) =>
        compareBySeverity(a.severity, b.severity) ||
        (b.detectedAt ?? '').localeCompare(a.detectedAt ?? '')
    );

  const blockingExpirations = expirations.filter(
    (item) => item.status === 'EXPIRED' || item.status === 'SUSPENDED'
  );

  const summaryParts = [
    `Risk score ${score} (${tier})`,
    `${unresolvedSignals.length} active driver${unresolvedSignals.length === 1 ? '' : 's'}`,
  ];

  if (profile.monitoringLevel) {
    summaryParts.push(`monitoring: ${profile.monitoringLevel}`);
  }

  if (criticalSignals.length === 0 && openDriftEvents.length === 0 && blockingExpirations.length === 0) {
    summaryParts.push('no critical blockers detected');
  } else {
    const issues = criticalSignals.length + openDriftEvents.length + blockingExpirations.length;
    summaryParts.push(`${issues} blocker${issues === 1 ? '' : 's'} require review`);
  }

  const highlights: string[] = [];

  if (tier === 'low' || (tier === 'moderate' && score < 50)) {
    highlights.push(`Risk posture remains ${tier} with score ${score}.`);
  }

  if (criticalSignals.length === 0) {
    highlights.push('No high-severity risk drivers are open.');
  }

  if (blockingExpirations.length === 0 && expirations.length === 0) {
    highlights.push('All monitored credentials are current.');
  }

  if (openDriftEvents.length === 0 && driftEvents.length > 0) {
    highlights.push('Recent drift events have been resolved.');
  }

  const concerns: string[] = [];

  for (const signal of criticalSignals) {
    concerns.push(
      `${signal.label} (${signal.severity}) – ${signal.description}${
        signal.detectedAt ? ` since ${formatDate(signal.detectedAt)}` : ''
      }.`
    );
  }

  for (const event of openDriftEvents) {
    concerns.push(
      `${event.label} (${event.category}) detected ${formatDate(event.detectedAt)} – ${
        event.description
      }.`
    );
  }

  for (const item of blockingExpirations) {
    concerns.push(
      `${item.label} is ${item.status.toLowerCase()}${item.expiresAt ? ` (expired ${formatDate(item.expiresAt)})` : ''
      }.`
    );
  }

  const evidence: EvidencePoint[] = [
    ...signals.map((signal) => ({
      id: signal.id,
      label: signal.label,
      detail: signal.description,
      severity: signal.severity,
      observedAt: signal.detectedAt,
      resolved: signal.resolved,
      sectionRef: 'risk',
    })),
    ...mapDriftToEvidence(openDriftEvents),
    ...mapComplianceToEvidence(expirations),
  ];

  const lastEvaluated = profile.lastEvaluatedAt ? new Date(profile.lastEvaluatedAt) : undefined;
  const stalenessDays =
    lastEvaluated && Number.isFinite(lastEvaluated.getTime())
      ? Math.floor((Date.now() - lastEvaluated.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

  const confidence =
    stalenessDays === undefined
      ? 'medium'
      : stalenessDays <= 30
      ? 'high'
      : stalenessDays <= 90
      ? 'medium'
      : 'low';

  const narrative: SectionNarrative = {
    section: 'risk',
    summary: summaryParts.join(' • '),
    highlights: limitList(dedupeStrings(highlights), highlightLimit),
    concerns: dedupeStrings(concerns),
    evidence: deterministic ? limitList(evidence, highlightLimit * 2) : evidence,
    confidence,
  };

  return narrative;
}

function mapDriftToEvidence(events: DriftEvent[]): EvidencePoint[] {
  return events.map((event) => ({
    id: event.id,
    label: event.label,
    severity: event.severity,
    detail: event.description,
    observedAt: event.detectedAt,
    resolved: event.resolved,
    sectionRef: 'risk',
  }));
}

function mapComplianceToEvidence(items: ComplianceItem[]): EvidencePoint[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    severity: item.severity ?? (item.status === 'EXPIRED' ? 'high' : 'medium'),
    detail: `${item.status}${item.expiresAt ? `, expires ${formatDate(item.expiresAt)}` : ''}`,
    observedAt: item.lastVerifiedAt,
    resolved: item.status === 'ACTIVE',
    sectionRef: 'risk',
  }));
}


