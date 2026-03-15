import type { InvestigatorDefinition, InvestigatorFindingDraft } from './investigatorTypes';

function cleanSentence(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function buildFindingExplanation<TDependencies>(
  investigator: InvestigatorDefinition<TDependencies>,
  finding: InvestigatorFindingDraft,
): string {
  const suppliedExplanation = cleanSentence(finding.explanation);
  if (suppliedExplanation) {
    return suppliedExplanation;
  }

  const sources = uniqueValues(
    finding.supportingEvidence.flatMap((evidence) => {
      const labels = [evidence.sourceLabel ?? '', evidence.sourceId ?? ''];
      return labels.filter((value) => value.trim().length > 0);
    }),
  );
  const sourceClause = sources.length > 0
    ? `Evidence corroborates the signal across ${sources.join(', ')}.`
    : 'Evidence is presently limited to the current run context.';
  const entityClause = finding.entityIds.length > 0
    ? `Affected entities: ${finding.entityIds.slice(0, 4).join(', ')}${finding.entityIds.length > 4 ? ` and ${finding.entityIds.length - 4} more` : ''}.`
    : '';

  return [
    `${investigator.name} detected ${finding.title.toLowerCase()}.`,
    cleanSentence(finding.summary),
    sourceClause,
    `Confidence is ${Math.round(finding.confidence * 100)}%.`,
    entityClause,
  ]
    .filter((value) => value.trim().length > 0)
    .join(' ');
}
