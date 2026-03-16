import type {
  EngineFinding,
  EngineStoryline,
  InvestigatorSeverity,
  StorylineAnchorType,
  StorylineFindingSummary,
  StorylineNarrative,
} from './types';

function severityRank(severity: InvestigatorSeverity): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

function highestSeverity(findings: readonly EngineFinding[]): InvestigatorSeverity {
  return [...findings]
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))[0]?.severity ?? 'low';
}

function anchorLabel(anchorType: StorylineAnchorType): string {
  switch (anchorType) {
    case 'event':
      return 'event';
    case 'trend':
      return 'trend';
    case 'entity':
    default:
      return 'entity';
  }
}

function buildNarrative(
  title: string,
  anchorType: StorylineAnchorType,
  findings: readonly EngineFinding[],
): StorylineNarrative {
  const primary = findings[0];
  const providerContext = primary?.metadata.providerLabel && primary?.metadata.providerSpecialty
    ? `${primary.metadata.providerLabel} is monitored as a ${primary.metadata.providerSpecialty} provider.`
    : primary?.metadata.providerLabel
      ? `${primary.metadata.providerLabel} is the primary provider anchor.`
      : `This storyline is anchored on a ${anchorLabel(anchorType)} change.`;
  const networkContext = typeof primary?.metadata.trendAnchorLabel === 'string'
    ? `Network context: ${primary.metadata.trendAnchorLabel}.`
    : typeof primary?.metadata.providerState === 'string'
      ? `Network context: activity is scoped to ${primary.metadata.providerState}.`
      : 'Network context: corroboration is limited to currently connected provider evidence.';
  const recommendedAction = primary?.severity === 'critical'
    ? 'Escalate immediately and confirm the source record.'
    : primary?.signalType === 'payment'
      ? 'Review payment context and compare with peer baselines.'
      : primary?.signalType === 'grant' || primary?.signalType === 'publication' || primary?.signalType === 'trial'
        ? 'Validate identity linkage and preserve the research audit trail.'
        : 'Verify the source delta and keep the provider under monitoring.';

  const bullets = findings.slice(0, 4).map((finding) => finding.summary);
  return {
    headline: title,
    providerContext,
    findings: bullets,
    networkContext,
    recommendedAction,
    narrative: `${providerContext} ${bullets.join(' ')} ${networkContext} ${recommendedAction}`.trim(),
  };
}

export function groupFindingsIntoStorylines(findings: readonly EngineFinding[]): EngineStoryline[] {
  const groups = new Map<string, EngineFinding[]>();
  for (const finding of findings) {
    const group = groups.get(finding.storylineKey);
    if (group) {
      group.push(finding);
      continue;
    }
    groups.set(finding.storylineKey, [finding]);
  }

  return [...groups.entries()].map(([storylineKey, group]) => {
    const sorted = [...group].sort((left, right) => (
      Date.parse(right.timestamp) - Date.parse(left.timestamp)
    ));
    const top = sorted[0];
    const anchorType = top?.storylineAnchorType ?? 'entity';
    const title = typeof top?.metadata.storylineTitle === 'string'
      ? String(top.metadata.storylineTitle)
      : `${top?.metadata.providerLabel ?? top?.providerId ?? 'Provider'} ${top?.signalType ?? 'change'}`.trim();
    const findingsSummary: StorylineFindingSummary[] = sorted.map((finding) => ({
      title: finding.title,
      summary: finding.summary,
      signalType: finding.signalType,
      severity: finding.severity,
      timestamp: finding.timestamp,
    }));

    return {
      storylineKey,
      anchorType,
      title,
      summary: sorted.slice(0, 2).map((finding) => finding.summary).join(' '),
      severity: highestSeverity(sorted),
      providerIds: [...new Set(sorted.map((finding) => finding.providerId))],
      signalTypes: [...new Set(sorted.map((finding) => finding.signalType))],
      findings: findingsSummary,
      narrative: buildNarrative(title, anchorType, sorted),
      metadata: {
        anchorType,
        findingCount: sorted.length,
      },
    };
  });
}
