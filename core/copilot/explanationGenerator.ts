import type {
  CopilotExplanation,
  CopilotMatch,
  RankedCopilotResult,
} from './copilotEngine';

function formatMatch(match: CopilotMatch): string {
  if (typeof match.value === 'boolean') {
    return `${match.field} = ${match.value ? 'yes' : 'no'}`;
  }

  return `${match.field} = ${String(match.value)}`;
}

function topBecause(result: RankedCopilotResult): string[] {
  const because = result.matches
    .slice(0, 4)
    .map((match) => formatMatch(match));

  if (result.trustScore !== undefined) {
    because.push(`trust score = ${result.trustScore}`);
  }

  if (result.sourceCoverage.length > 0) {
    because.push(`verified sources = ${result.sourceCoverage.slice(0, 4).join(', ')}`);
  }

  return because.slice(0, 4);
}

export function generateCopilotExplanation(result: RankedCopilotResult): CopilotExplanation {
  const because = topBecause(result);
  const summary = `${result.title} appears because ${because.join('; ')}.`;

  return {
    resultId: result.id,
    title: result.title,
    summary,
    because,
    matchedFilters: result.matches,
    verifiedSources: result.sourceCoverage,
    scoring: {
      relevance: result.scores.relevance,
      trustScore: result.scores.trustScore,
      freshness: result.scores.freshness,
      sourceCoverage: result.scores.sourceCoverage,
      total: result.scores.total,
    },
  };
}
