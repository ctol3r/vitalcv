import type {
  CopilotCommandContract,
  CopilotDocumentContract,
  CopilotDocumentEntityContract,
  CopilotDocumentSectionContract,
  CopilotDocumentSectionItemContract,
  CopilotQueryContextContract,
  CopilotQueryLimitedResponseContract,
  CopilotQueryResponseContract,
  CopilotResultContract,
} from './contracts';

type CopilotOkResponse = Extract<CopilotQueryResponseContract, { status: 'ok' }>;

const DEFAULT_LIMITED_TITLE = 'Copilot needs more investigation context';
const DEFAULT_LIMITED_MESSAGE = 'Copilot could not safely complete this request with the currently available investigation context and sources.';
const DEFAULT_LIMITED_SUGGESTIONS = [
  'Select a provider, finding, or storyline',
  'Open the investigation workbench',
  'Retry once live sources recover',
];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function asMode(command: CopilotCommandContract | undefined): CopilotDocumentContract['mode'] {
  switch (command?.name) {
    case 'plan':
      return 'plan';
    case 'check':
      return 'check';
    case 'compare':
      return 'compare';
    case 'network':
      return 'network';
    case 'history':
      return 'history';
    case 'summarize':
    case 'investigate':
    default:
      return 'summary';
  }
}

function inferProviderNpi(result: Pick<CopilotResultContract, 'id'>): string | null {
  const match = result.id.match(/(\d{10})/);
  return match?.[1] ?? null;
}

function buildResultEntity(result: CopilotResultContract): CopilotDocumentEntityContract[] {
  const providerNpi = inferProviderNpi(result);
  if (!providerNpi) {
    return [];
  }

  return [{
    id: `provider:${providerNpi}`,
    kind: 'provider',
    label: result.title,
    providerNpi,
  }];
}

function buildContextEntities(context: CopilotQueryContextContract | undefined): CopilotDocumentEntityContract[] {
  const entities: CopilotDocumentEntityContract[] = [];

  if (context?.provider?.npi) {
    entities.push({
      id: `provider:${context.provider.npi}`,
      kind: 'provider',
      label: context.provider.label ?? context.provider.npi,
      providerNpi: context.provider.npi,
    });
  }

  if (context?.finding?.id) {
    entities.push({
      id: `finding:${context.finding.id}`,
      kind: 'finding',
      label: context.finding.title,
      findingId: context.finding.id,
    });
  }

  if (context?.storyline?.id) {
    entities.push({
      id: `storyline:${context.storyline.id}`,
      kind: 'storyline',
      label: context.storyline.title,
      storylineId: context.storyline.id,
    });
  }

  if (context?.graph?.selectedNodeId) {
    entities.push({
      id: `graph:${context.graph.selectedNodeId}`,
      kind: 'graph_node',
      label: context.graph.selectedNodeId,
      nodeId: context.graph.selectedNodeId,
    });
  }

  return entities;
}

function buildEvidenceItems(
  response: Omit<CopilotOkResponse, 'status' | 'document'>,
  context: CopilotQueryContextContract | undefined,
): CopilotDocumentSectionItemContract[] {
  const explanationItems = response.explanations.slice(0, 3).map((explanation, index) => ({
    id: `evidence:${explanation.resultId}:${index}`,
    title: explanation.title,
    body: explanation.because.length > 0 ? explanation.because.join(' ') : explanation.summary,
    entities: response.results
      .filter((result) => result.id === explanation.resultId)
      .flatMap((result) => buildResultEntity(result)),
    citations: (context?.finding?.evidence ?? []).slice(0, 2).map((evidence, evidenceIndex) => ({
      id: `citation:${explanation.resultId}:${evidenceIndex}`,
      label: evidence.source,
      source: evidence.source,
      findingId: context?.finding?.id,
      evidenceIndex,
    })),
  }));

  if (explanationItems.length > 0) {
    return explanationItems;
  }

  return (context?.finding?.evidence ?? []).slice(0, 3).map((evidence, index) => ({
    id: `finding-evidence:${index}`,
    title: evidence.field ?? evidence.source,
    body: evidence.claim,
    citations: [{
      id: `citation:finding:${index}`,
      label: evidence.source,
      source: evidence.source,
      findingId: context?.finding?.id,
      evidenceIndex: index,
    }],
  }));
}

function buildSignalItems(
  response: Omit<CopilotOkResponse, 'status' | 'document'>,
  context: CopilotQueryContextContract | undefined,
): CopilotDocumentSectionItemContract[] {
  const resultItems = response.results.slice(0, 3).map((result) => {
    const scoreParts = [
      typeof result.trustScore === 'number' ? `trust ${Math.round(result.trustScore)}` : null,
      result.trustBand ? `band ${result.trustBand}` : null,
      result.subtitle ?? null,
    ].filter((value): value is string => Boolean(value));

    return {
      id: `signal:${result.id}`,
      title: result.title,
      body: scoreParts.length > 0 ? scoreParts.join(' · ') : result.summary,
      entities: buildResultEntity(result),
    };
  });

  const recentFindingItems = (context?.recentFindings ?? []).slice(0, 2).map((finding, index) => ({
    id: `recent-finding:${finding.id}:${index}`,
    title: finding.title,
    body: `${finding.severity.toUpperCase()} · ${finding.summary}`,
    entities: [{
      id: `finding:${finding.id}`,
      kind: 'finding',
      label: finding.title,
      findingId: finding.id,
    }],
  }));

  return [...resultItems, ...recentFindingItems];
}

function buildNetworkItems(
  response: Omit<CopilotOkResponse, 'status' | 'document'>,
  context: CopilotQueryContextContract | undefined,
): CopilotDocumentSectionItemContract[] {
  const graphItems = response.graphInsights.slice(0, 3).map((insight, index) => ({
    id: `graph:${index}`,
    title: insight.type.replace(/_/g, ' '),
    body: insight.summary,
    graphAction: insight.path[0]
      ? {
          type: 'highlight_neighborhood',
          label: 'Highlight in graph',
          nodeId: insight.path[0],
        }
      : undefined,
  }));

  if (graphItems.length > 0) {
    return graphItems;
  }

  const focusNodeId = context?.graph?.selectedNodeId ?? context?.graph?.focusNodeId ?? null;
  if (!focusNodeId) {
    return [];
  }

  return [{
    id: `graph-context:${focusNodeId}`,
    title: 'Current graph focus',
    body: `Focus node ${focusNodeId} with ${context?.graph?.neighborNodeIds.length ?? 0} highlighted neighbors.`,
    graphAction: {
      type: 'highlight_neighborhood',
      label: 'Highlight current focus',
      nodeId: focusNodeId,
    },
  }];
}

function buildRecommendedActionItems(
  response: Omit<CopilotOkResponse, 'status' | 'document'>,
  context: CopilotQueryContextContract | undefined,
): CopilotDocumentSectionItemContract[] {
  if (response.results.length === 0) {
    return [{
      id: 'recommendation:no-match',
      title: 'Broaden the current scope',
      body: 'No exact Copilot matches were available. Refine the question or inspect the current provider, finding, or storyline directly.',
      availability: 'limited',
      entities: buildContextEntities(context),
    }];
  }

  const topResult = response.results[0]!;
  const recommendation = inferProviderNpi(topResult)
    ? `Inspect ${topResult.title} against the current workbench context before escalating or dismissing the active finding.`
    : `Inspect the top Copilot result ${topResult.title} against the current workbench context before taking action.`;

  return [{
    id: `recommendation:${topResult.id}`,
    title: 'Suggested next action',
    body: recommendation,
    entities: buildResultEntity(topResult),
    graphAction: inferProviderNpi(topResult)
      ? {
          type: 'navigate_provider',
          label: 'Use provider as focus',
          providerNpi: inferProviderNpi(topResult) ?? undefined,
        }
      : undefined,
  }];
}

function buildFollowUpQuestions(
  response: Omit<CopilotOkResponse, 'status' | 'document'>,
  context: CopilotQueryContextContract | undefined,
): string[] {
  const providerName = context?.provider?.label;
  const storylineTitle = context?.storyline?.title;

  return uniqueStrings([
    providerName ? `Summarize ${providerName}'s current risk` : '',
    storylineTitle ? `Explain ${storylineTitle}` : '',
    response.results[0]?.title ? `Show related entities for ${response.results[0].title}` : '',
    'What evidence is strongest here?',
    'What should I do next?',
  ]).slice(0, 5);
}

function buildSection(
  key: CopilotDocumentSectionContract['key'],
  title: string,
  items: CopilotDocumentSectionItemContract[],
): CopilotDocumentSectionContract {
  return {
    key,
    title,
    availability: items.length > 0 ? 'ready' : 'limited',
    items,
  };
}

export function buildCopilotDocumentFromQueryResponse(
  response: Omit<CopilotOkResponse, 'status' | 'document'>,
  input: {
    query: string;
    context?: CopilotQueryContextContract;
    command?: CopilotCommandContract;
  },
): CopilotDocumentContract {
  const summaryItems = response.results.length > 0
    ? response.results.slice(0, 2).map((result, index) => ({
        id: `summary:${result.id}:${index}`,
        title: result.title,
        body: result.summary,
        entities: buildResultEntity(result),
        graphAction: inferProviderNpi(result)
          ? {
              type: 'navigate_provider',
              label: 'Use provider as focus',
              providerNpi: inferProviderNpi(result) ?? undefined,
            }
          : undefined,
      }))
    : [{
        id: 'summary:no-results',
        title: 'No exact Copilot matches',
        body: 'Copilot returned a valid empty result set for this request. Refine the scope or inspect the current investigation context directly.',
        availability: 'limited',
        entities: buildContextEntities(input.context),
      }];

  const followUpQuestions = buildFollowUpQuestions(response, input.context);
  const followUpItems = followUpQuestions.map((question, index) => ({
    id: `follow-up:${index}`,
    body: question,
  }));

  return {
    mode: asMode(input.command),
    title: input.command?.name === 'summarize' ? 'Copilot summary' : 'Copilot response',
    subtitle: input.query,
    generatedAt: new Date().toISOString(),
    suggestions: followUpQuestions,
    sections: [
      buildSection('summary', 'Summary', summaryItems),
      buildSection('evidence', 'Evidence', buildEvidenceItems(response, input.context)),
      buildSection('signals', 'Signals', buildSignalItems(response, input.context)),
      buildSection('network_context', 'Network Context', buildNetworkItems(response, input.context)),
      buildSection('recommended_action', 'Recommended Action', buildRecommendedActionItems(response, input.context)),
      buildSection('follow_up_questions', 'Follow-up Questions', followUpItems),
    ],
  };
}

export function buildLimitedCopilotResponse(input: {
  title?: string;
  message?: string;
  suggestions?: string[];
  context?: CopilotQueryContextContract;
  command?: CopilotCommandContract;
}): CopilotQueryLimitedResponseContract {
  const title = input.title?.trim() || DEFAULT_LIMITED_TITLE;
  const message = input.message?.trim() || DEFAULT_LIMITED_MESSAGE;
  const suggestions = input.suggestions?.length
    ? uniqueStrings(input.suggestions)
    : DEFAULT_LIMITED_SUGGESTIONS;
  const contextEntities = buildContextEntities(input.context);

  return {
    status: 'limited',
    title,
    message,
    suggestions,
    answer: message,
    sources: [],
    confidence: 0,
    results: [],
    explanations: [],
    graphInsights: [],
    document: {
      mode: asMode(input.command),
      title,
      subtitle: message,
      generatedAt: new Date().toISOString(),
      suggestions,
      sections: [
        {
          key: 'summary',
          title: 'Summary',
          availability: 'limited',
          items: [{
            id: 'limited-summary',
            title,
            body: message,
            availability: 'limited',
            entities: contextEntities,
          }],
        },
        {
          key: 'evidence',
          title: 'Evidence',
          availability: 'unavailable',
          items: [{
            id: 'limited-evidence',
            body: 'Source evidence is unavailable for this response.',
            availability: 'unavailable',
            entities: contextEntities,
          }],
        },
        {
          key: 'signals',
          title: 'Signals',
          availability: 'limited',
          items: [{
            id: 'limited-signals',
            body: 'Copilot could not complete a reliable synthesis from the current live sources.',
            availability: 'limited',
          }],
        },
        {
          key: 'network_context',
          title: 'Network Context',
          availability: input.context?.graph?.selectedNodeId || input.context?.graph?.focusNodeId ? 'limited' : 'unavailable',
          items: input.context?.graph?.selectedNodeId || input.context?.graph?.focusNodeId
            ? [{
                id: 'limited-graph',
                body: `Graph context is available for ${input.context.graph.selectedNodeId ?? input.context.graph.focusNodeId}, but Copilot could not safely synthesize it into a complete answer.`,
                availability: 'limited',
                graphAction: {
                  type: 'highlight_neighborhood',
                  label: 'Highlight current focus',
                  nodeId: input.context.graph.selectedNodeId ?? input.context.graph.focusNodeId ?? undefined,
                },
              }]
            : [{
                id: 'limited-graph-unavailable',
                body: 'Graph context is unavailable for this response.',
                availability: 'unavailable',
              }],
        },
        {
          key: 'recommended_action',
          title: 'Recommended Action',
          availability: 'ready',
          items: suggestions.slice(0, 3).map((suggestion, index) => ({
            id: `limited-action:${index}`,
            body: suggestion,
          })),
        },
        {
          key: 'follow_up_questions',
          title: 'Follow-up Questions',
          availability: 'ready',
          items: suggestions.map((suggestion, index) => ({
            id: `limited-follow-up:${index}`,
            body: suggestion,
          })),
        },
      ],
    },
  };
}
