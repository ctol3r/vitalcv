import {
  EvidencePoint,
  ExplainSectionOptions,
  QualityProfile,
  SectionNarrative,
  SentinelEvent,
} from './narrativeTypes';
import {
  DEFAULT_HIGHLIGHT_LIMIT,
  compareBySeverity,
  dedupeStrings,
  delta,
  emptySection,
  formatDate,
  limitList,
} from './utils';

export function explainQualitySection(
  profile?: QualityProfile,
  options?: ExplainSectionOptions
): SectionNarrative {
  if (!profile) {
    return emptySection('quality');
  }

  const highlightLimit = options?.highlightLimit ?? DEFAULT_HIGHLIGHT_LIMIT;
  const deterministic = options?.deterministic ?? false;

  const summarySegments: string[] = [];

  const oppeSummary = buildOppeSummary(profile);
  if (oppeSummary) summarySegments.push(oppeSummary);

  const fppeSummary = buildFppeSummary(profile);
  if (fppeSummary) summarySegments.push(fppeSummary);

  const volumeSummary = buildVolumeSummary(profile);
  if (volumeSummary) summarySegments.push(volumeSummary);

  if (summarySegments.length === 0) {
    summarySegments.push('No OPPE/FPPE metrics provided');
  }

  const highlights = collectQualityHighlights(profile);
  const concerns = collectQualityConcerns(profile);
  const evidence = collectQualityEvidence(profile);

  return {
    section: 'quality',
    summary: summarySegments.join(' • '),
    highlights: limitList(dedupeStrings(highlights), highlightLimit),
    concerns: dedupeStrings(concerns),
    evidence: deterministic ? limitList(evidence, highlightLimit * 2) : evidence,
    confidence: profile.oppe?.trend && profile.oppe.trend.length > 0 ? 'high' : 'medium',
  };
}

function buildOppeSummary(profile: QualityProfile): string | undefined {
  const trend = profile.oppe?.trend;
  if (!trend || trend.length === 0) {
    return undefined;
  }
  const sortedTrend = [...trend].sort((a, b) => b.period.localeCompare(a.period));
  const latest = sortedTrend[0];
  const previous = sortedTrend[1];
  const change = delta(latest.score, previous?.score);
  const changeText =
    change === null
      ? ''
      : change > 0
      ? ` (+${change})`
      : change < 0
      ? ` (${change})`
      : ' (flat)';
  const statusText = latest.status ? latest.status.toUpperCase() : 'UNKNOWN';
  return `OPPE score ${latest.score}${changeText} – ${statusText}`;
}

function buildFppeSummary(profile: QualityProfile): string | undefined {
  const fppe = profile.fppe;
  if (!fppe) return undefined;
  const parts = [`FPPE ${fppe.status.replace(/_/g, ' ').toLowerCase()}`];
  if (fppe.lastReviewAt) {
    parts.push(`last reviewed ${formatDate(fppe.lastReviewAt)}`);
  }
  return parts.join(', ');
}

function buildVolumeSummary(profile: QualityProfile): string | undefined {
  const volume = profile.procedureVolume;
  if (!volume) return undefined;
  const parts = [`${volume.totalProcedures} procedures`];
  if (volume.requiredMinimum) {
    parts.push(`target ${volume.requiredMinimum}`);
  }
  if (typeof volume.trend === 'number') {
    parts.push(volume.trend >= 0 ? `trend +${volume.trend}` : `trend ${volume.trend}`);
  }
  if (volume.period) {
    parts.push(`period ${volume.period}`);
  }
  return parts.join(', ');
}

function collectQualityHighlights(profile: QualityProfile): string[] {
  const highlights: string[] = [];

  const trend = profile.oppe?.trend;
  if (trend && trend.length >= 2) {
    const sorted = [...trend].sort((a, b) => b.period.localeCompare(a.period));
    const latest = sorted[0];
    const previous = sorted[1];
    const change = delta(latest.score, previous?.score);
    if (change !== null && change > 0) {
      highlights.push(`OPPE improved by ${change} since ${previous?.period ?? 'previous review'}.`);
    }
  }

  if (profile.fppe?.status === 'COMPLETED') {
    highlights.push('FPPE completed with no outstanding actions.');
  }

  if (profile.procedureVolume?.requiredMinimum !== undefined) {
    if (profile.procedureVolume.totalProcedures >= profile.procedureVolume.requiredMinimum) {
      highlights.push(
        `Procedure volume meets target (${profile.procedureVolume.totalProcedures}/${profile.procedureVolume.requiredMinimum}).`
      );
    }
  }

  if ((profile.sentinelEvents ?? []).length === 0) {
    highlights.push('No sentinel events reported this period.');
  }

  return highlights;
}

function collectQualityConcerns(profile: QualityProfile): string[] {
  const concerns: string[] = [];

  const trend = profile.oppe?.trend;
  if (trend && trend.length >= 2) {
    const sorted = [...trend].sort((a, b) => b.period.localeCompare(a.period));
    const latest = sorted[0];
    const previous = sorted[1];
    const change = delta(latest.score, previous?.score);
    if (change !== null && change < 0) {
      concerns.push(
        `OPPE declined by ${Math.abs(change)} since ${previous?.period ?? 'prior review'}.`
      );
    }
    if (latest.status === 'red') {
      concerns.push('OPPE composite flagged red status.');
    }
  }

  if (profile.fppe && profile.fppe.status !== 'NOT_REQUIRED' && profile.fppe.status !== 'COMPLETED') {
    concerns.push(`FPPE ${profile.fppe.status.replace(/_/g, ' ').toLowerCase()} – follow-up required.`);
  }

  if (profile.procedureVolume?.requiredMinimum) {
    const diff =
      profile.procedureVolume.requiredMinimum - profile.procedureVolume.totalProcedures;
    if (diff > 0) {
      concerns.push(`Procedure volume below target by ${diff} case(s).`);
    }
  }

  const openSentinelEvents = (profile.sentinelEvents ?? []).filter(
    (event) => event.status === 'OPEN'
  );
  for (const event of openSentinelEvents) {
    concerns.push(
      `Sentinel event (${event.severity}) on ${formatDate(event.occurredAt)} – ${event.description}.`
    );
  }

  const openPlans =
    profile.improvementPlans?.filter((plan) => plan.status !== 'COMPLETED') ?? [];
  for (const plan of openPlans) {
    concerns.push(
      `Improvement plan "${plan.title}" is ${plan.status.toLowerCase()}${
        plan.dueDate ? ` (due ${formatDate(plan.dueDate)})` : ''
      }.`
    );
  }

  return concerns;
}

function collectQualityEvidence(profile: QualityProfile): EvidencePoint[] {
  const evidence: EvidencePoint[] = [];

  const trend = profile.oppe?.trend ?? [];
  trend.forEach((point, index) => {
    evidence.push({
      id: `oppe-${point.period}-${index}`,
      label: `OPPE ${point.period}`,
      severity:
        point.status === 'red'
          ? 'critical'
          : point.status === 'yellow'
          ? 'medium'
          : 'low',
      detail: `Score ${point.score}${
        typeof point.change === 'number' ? ` (Δ ${point.change})` : ''
      }`,
      sectionRef: 'quality',
    });
  });

  const sentinelEvents = profile.sentinelEvents ?? [];
  sentinelEvents
    .sort((a, b) => compareBySeverity(a.severity, b.severity))
    .forEach((event) => {
      evidence.push(mapSentinelEvent(event));
    });

  const improvementPlans = profile.improvementPlans ?? [];
  improvementPlans.forEach((plan) => {
    evidence.push({
      id: plan.id,
      label: `Improvement plan: ${plan.title}`,
      severity: plan.severity ?? 'medium',
      detail: `Status ${plan.status}${
        plan.dueDate ? `, due ${formatDate(plan.dueDate)}` : ''
      }`,
      sectionRef: 'quality',
    });
  });

  if (profile.fppe) {
    evidence.push({
      id: `fppe-${profile.fppe.status}`,
      label: 'FPPE status',
      severity:
        profile.fppe.status === 'FAILED'
          ? 'critical'
          : profile.fppe.status === 'COMPLETED'
          ? 'low'
          : 'medium',
      detail: `${profile.fppe.status.replace(/_/g, ' ')}${
        profile.fppe.lastReviewAt ? `, last review ${formatDate(profile.fppe.lastReviewAt)}` : ''
      }`,
      sectionRef: 'quality',
    });
  }

  return evidence;
}

function mapSentinelEvent(event: SentinelEvent): EvidencePoint {
  return {
    id: event.id,
    label: `Sentinel event (${event.status})`,
    severity: event.severity,
    detail: `${event.description} on ${formatDate(event.occurredAt)}${
      event.resolvedAt ? `, resolved ${formatDate(event.resolvedAt)}` : ''
    }`,
    sectionRef: 'quality',
    observedAt: event.occurredAt,
    resolved: event.status === 'CLOSED',
  };
}


