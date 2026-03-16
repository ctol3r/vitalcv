import { extractNpiFromValue } from './parser';
import type {
  VCommandActionDefinition,
  VCommandInput,
  VCommandNavigationContext,
} from './types';

function graphHref(context: VCommandNavigationContext): string {
  const params = new URLSearchParams();

  if (context.npi) {
    params.set('npi', context.npi);
  } else if (context.query.trim().length > 0) {
    params.set('q', context.query.trim());
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `/graph?${serialized}` : '/graph';
}

export const VITAL_COMMANDS: VCommandActionDefinition[] = [
  {
    id: 'run-verification',
    label: 'Run verification',
    description: 'Open the investigation workspace for the current provider or query scope.',
    group: 'Commands',
    aliases: ['run verification', 'verify provider', 'start verification'],
    keywords: ['verification', 'investigate', 'provider'],
    buildHref: (context) => (
      context.npi
        ? `/investigations?npi=${encodeURIComponent(context.npi)}`
        : '/investigations'
    ),
    buildGraphHref: graphHref,
  },
  {
    id: 'export-report',
    label: 'Export report',
    description: 'Export the current provider trust proof as a PDF when an NPI is in scope.',
    group: 'Reports',
    aliases: ['export report', 'download report', 'trust proof'],
    keywords: ['export', 'report', 'pdf', 'proof'],
    requiresProvider: true,
    buildHref: (context) => (
      context.npi
        ? `/api/trust-proof/${encodeURIComponent(context.npi)}?format=pdf`
        : '/providers'
    ),
    buildGraphHref: graphHref,
  },
  {
    id: 'open-graph',
    label: 'Open graph',
    description: 'Open the graph workspace with the active provider or query in scope.',
    group: 'Navigation',
    aliases: ['open graph', 'graph', 'show graph'],
    keywords: ['graph', 'network', 'connections'],
    buildHref: graphHref,
    buildGraphHref: graphHref,
  },
  {
    id: 'open-providers',
    label: 'Open providers',
    description: 'Jump to the provider directory with the current search text applied.',
    group: 'Navigation',
    aliases: ['open providers', 'providers', 'provider directory'],
    keywords: ['providers', 'directory', 'search'],
    buildHref: (context) => (
      context.query.trim().length > 0
        ? `/providers?q=${encodeURIComponent(context.query.trim())}`
        : '/providers'
    ),
    buildGraphHref: graphHref,
  },
  {
    id: 'open-findings',
    label: 'Open findings',
    description: 'Pivot into the findings feed for the active provider.',
    group: 'Navigation',
    aliases: ['open findings', 'findings', 'show findings'],
    keywords: ['findings', 'alerts', 'risk'],
    buildHref: (context) => (
      context.npi
        ? `/findings?provider=${encodeURIComponent(context.npi)}`
        : '/findings'
    ),
    buildGraphHref: graphHref,
  },
];

function scoreCommand(definition: VCommandActionDefinition, query: string): number {
  if (!query) {
    return 1;
  }

  const normalizedQuery = query.toLowerCase();
  const haystack = [
    definition.label,
    definition.description,
    ...definition.aliases,
    ...definition.keywords,
  ].join(' ').toLowerCase();

  if (haystack === normalizedQuery) {
    return 200;
  }

  if (definition.aliases.some((alias) => alias.toLowerCase() === normalizedQuery)) {
    return 160;
  }

  if (definition.label.toLowerCase().startsWith(normalizedQuery)) {
    return 120;
  }

  if (haystack.includes(normalizedQuery)) {
    return 80;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const overlap = queryTokens.filter((token) => haystack.includes(token)).length;
  return overlap * 20;
}

export function buildCommandContext(input: VCommandInput, selectedNpi: string | null): VCommandNavigationContext {
  return {
    query: input.mode === 'command' ? input.commandText : input.searchText || input.normalized,
    npi: selectedNpi ?? extractNpiFromValue(input.normalized),
    mode: input.mode,
  };
}

export function findMatchingCommands(query: string): VCommandActionDefinition[] {
  return [...VITAL_COMMANDS]
    .map((definition) => ({
      definition,
      score: scoreCommand(definition, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.definition.label.localeCompare(right.definition.label))
    .map((entry) => entry.definition);
}
