'use client';

import type {
  CopilotDocument as ServerCopilotDocument,
  CopilotDocumentEntity as ServerCopilotDocumentEntity,
  CopilotDocumentGraphAction as ServerCopilotDocumentGraphAction,
} from '@/lib/copilot/contracts';
import { formatAbsoluteTime } from '@/lib/intelligence/time';
import type {
  CopilotContextPayload,
  CopilotDocument,
  CopilotEntityRef,
  CopilotGraphAction,
  CopilotDocumentItem,
  CopilotDocumentSection,
  CopilotHistoryEvent,
  CopilotMode,
  CopilotPlanPayload,
  CopilotQueryLimitedPayload,
  CopilotQueryPayload,
  CopilotQueryResult,
  CopilotSessionEntry,
} from './types';

function compactText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function section(
  id: CopilotDocumentSection['id'],
  title: string,
  items: CopilotDocumentItem[],
  summary?: string | null,
  collapsedByDefault = false,
  availability: CopilotDocumentSection['availability'] = 'ready',
): CopilotDocumentSection {
  return {
    id,
    title,
    items,
    summary,
    collapsedByDefault,
    availability,
  };
}

function item(
  id: string,
  label: string,
  detail?: string | null,
  extra: Partial<CopilotDocumentItem> = {},
): CopilotDocumentItem {
  return {
    id,
    label,
    detail: compactText(detail),
    ...extra,
  };
}

function translateServerEntity(entity: ServerCopilotDocumentEntity): CopilotEntityRef {
  const value = entity.providerNpi
    ?? (entity.findingId ? `finding:${entity.findingId}` : null)
    ?? (entity.storylineId ? `storyline:${entity.storylineId}` : null)
    ?? entity.nodeId
    ?? entity.id;

  return {
    id: entity.id,
    kind: entity.kind === 'graph_node' ? 'graph-node' as const : entity.kind,
    label: entity.label,
    value,
  };
}

function translateServerGraphAction(action: ServerCopilotDocumentGraphAction): CopilotGraphAction {
  const kind = action.type === 'focus_node'
    ? 'focus-node'
    : action.type === 'highlight_neighborhood'
      ? 'highlight-neighborhood'
      : 'navigate-provider';

  return {
    kind,
    nodeId: action.nodeId ?? null,
    npi: action.providerNpi ?? null,
  };
}

function hasSections(value: unknown): value is { sections: unknown[] } {
  return Boolean(
    value
    && typeof value === 'object'
    && Array.isArray((value as { sections?: unknown }).sections),
  );
}

function isServerDocument(document: CopilotDocument | ServerCopilotDocument): document is ServerCopilotDocument {
  if (!hasSections(document)) {
    return false;
  }

  const firstSection = document.sections[0];
  return Boolean(firstSection && typeof firstSection === 'object' && 'key' in firstSection);
}

function translateServerDocument(document: ServerCopilotDocument): CopilotDocument {
  return {
    mode: document.mode,
    sections: document.sections.map((section) => ({
      id: section.key,
      title: section.title,
      availability: section.availability,
      summary: section.summary,
      collapsedByDefault: section.key !== 'summary' && section.key !== 'recommended_action',
      items: section.items.map((entry) => ({
        id: entry.id,
        label: entry.title ?? entry.body,
        detail: entry.title ? entry.body : null,
        availability: entry.availability,
        entities: (entry.entities ?? []).map(translateServerEntity),
        citations: (entry.citations ?? []).map((citation) => ({
          id: citation.id,
          label: citation.label,
          findingId: citation.findingId ?? null,
          evidenceIndex: citation.evidenceIndex ?? null,
        })),
        graphAction: entry.graphAction ? translateServerGraphAction(entry.graphAction) : null,
      })),
    })),
  };
}

export function normalizePayloadDocument(
  document: CopilotDocument | ServerCopilotDocument | null | undefined,
): CopilotDocument | null {
  if (!document) {
    return null;
  }

  return isServerDocument(document) ? translateServerDocument(document) : document;
}

function querySummaryText(payload: CopilotQueryPayload): string {
  if (payload.status === 'limited') {
    return payload.message;
  }

  const firstExplanation = payload.explanations?.find((entry) => compactText(entry.summary));
  if (firstExplanation?.summary) {
    return firstExplanation.summary;
  }

  const firstResult = payload.results?.find((entry) => compactText(entry.summary));
  if (firstResult?.summary) {
    return firstResult.summary;
  }

  return 'Copilot returned a structured response for the current scope.';
}

function buildEntityItemsFromResults(results: CopilotQueryResult[]): CopilotDocumentItem[] {
  return results.map((result, index) => {
    const entityValue = compactText(result.id) ?? `${index}`;
    const entityLabel = compactText(result.title) ?? `Result ${index + 1}`;
    const entities = entityValue
      ? [{
          id: `entity:${entityValue}`,
          kind: 'provider' as const,
          label: entityLabel,
          value: entityValue,
        }]
      : [];

    return item(
      `result:${entityValue}`,
      entityLabel,
      [
        compactText(result.subtitle),
        compactText(result.summary),
      ].filter(Boolean).join(' · '),
      {
        entities,
      },
    );
  });
}

function buildEvidenceItems(payload: CopilotQueryPayload): CopilotDocumentItem[] {
  if (payload.status === 'limited') {
    return [];
  }

  const explanations = payload.explanations ?? [];
  if (explanations.length > 0) {
    return explanations.map((explanation, index) => item(
      `evidence:${explanation.resultId ?? index}`,
      compactText(explanation.title) ?? `Evidence ${index + 1}`,
      compactText(explanation.summary) ?? explanation.because?.join(' · ') ?? null,
      {
        citations: explanation.resultId
          ? [{
              id: `citation:${explanation.resultId}`,
              label: 'Open evidence',
            }]
          : [],
      },
    ));
  }

  return buildEntityItemsFromResults(payload.results ?? []);
}

function buildSignalItems(payload: CopilotQueryPayload, context: CopilotContextPayload): CopilotDocumentItem[] {
  const items: CopilotDocumentItem[] = [];

  if (context.riskSummary?.summary) {
    items.push(item('risk:summary', 'Current risk summary', context.riskSummary.summary));
  }

  if (typeof context.riskSummary?.trustScore === 'number' || compactText(context.riskSummary?.trustBand)) {
    items.push(item(
      'risk:band',
      'Trust posture',
      [
        typeof context.riskSummary?.trustScore === 'number' ? `score ${Math.round(context.riskSummary.trustScore)}` : null,
        compactText(context.riskSummary?.trustBand),
      ].filter(Boolean).join(' · '),
    ));
  }

  if (payload.status === 'ok' && (payload.results?.length ?? 0) > 0) {
    items.push(item(
      'signal:result-count',
      'Results in scope',
      `${payload.results?.length ?? 0} ranked match${payload.results?.length === 1 ? '' : 'es'}`,
    ));
  }

  if (context.evidenceSummaryStats) {
    items.push(item(
      'signal:evidence',
      'Evidence quality',
      [
        context.evidenceSummaryStats.evidenceQuality,
        `${context.evidenceSummaryStats.uniqueSourceCount} sources`,
        `${context.evidenceSummaryStats.corroborationCount} corroborations`,
        context.evidenceSummaryStats.freshness.toLowerCase(),
      ].join(' · '),
    ));
  }

  return items;
}

function buildNetworkItems(payload: CopilotQueryPayload, context: CopilotContextPayload): CopilotDocumentItem[] {
  const items: CopilotDocumentItem[] = [];
  const graph = context.graph;

  if (graph?.focusNodeId) {
    items.push(item(
      `graph:${graph.focusNodeId}`,
      'Focused graph node',
      graph.focusNodeId,
      {
        graphAction: {
          kind: 'focus-node',
          nodeId: graph.focusNodeId,
        },
      },
    ));
  }

  if (graph && graph.neighborNodeIds.length > 0) {
    items.push(item(
      'graph:neighbors',
      'Visible neighborhood',
      `${graph.neighborNodeIds.length} neighboring node${graph.neighborNodeIds.length === 1 ? '' : 's'} in the current graph scope`,
      {
        graphAction: {
          kind: 'highlight-neighborhood',
          nodeId: graph.selectedNodeId ?? graph.focusNodeId,
        },
      },
    ));
  }

  if (payload.status === 'ok') {
    for (const insight of payload.graphInsights ?? []) {
      items.push(item(
        `insight:${insight.resultId ?? insight.summary ?? items.length}`,
        compactText(insight.type) ?? 'Graph signal',
        compactText(insight.summary) ?? insight.path?.join(' -> ') ?? null,
      ));
    }
  }

  return items;
}

function buildFollowUpItems(payload: CopilotQueryPayload): CopilotDocumentItem[] {
  return (payload.suggestions ?? []).map((suggestion, index) => item(
    `follow-up:${index}`,
    suggestion,
    null,
  ));
}

export function buildDocumentFromQueryPayload(
  payload: CopilotQueryPayload,
  context: CopilotContextPayload,
): CopilotDocument {
  const normalizedDocument = normalizePayloadDocument(payload.document);
  if (normalizedDocument) {
    return normalizedDocument;
  }

  const summaryItems = payload.status === 'ok'
    ? buildEntityItemsFromResults(payload.results ?? []).slice(0, 3)
    : [item('limited:message', payload.title, payload.message, { availability: 'limited' })];
  const evidenceItems = buildEvidenceItems(payload);
  const signalItems = buildSignalItems(payload, context);
  const networkItems = buildNetworkItems(payload, context);
  const followUpItems = buildFollowUpItems(payload);
  const recommendedAction = payload.status === 'limited'
    ? payload.title
    : payload.results?.[0]?.summary ?? 'Review the highest-signal result in the current scope.';

  return {
    mode: 'summary',
    sections: [
      section('summary', 'SUMMARY', summaryItems, querySummaryText(payload), false, payload.status === 'limited' ? 'limited' : 'ready'),
      section('evidence', 'EVIDENCE', evidenceItems, null, true, evidenceItems.length === 0 ? 'unavailable' : 'ready'),
      section('signals', 'SIGNALS', signalItems, null, true, signalItems.length === 0 ? 'unavailable' : 'ready'),
      section('network_context', 'NETWORK CONTEXT', networkItems, null, true, networkItems.length === 0 ? 'unavailable' : 'ready'),
      section('recommended_action', 'RECOMMENDED ACTION', [item('recommended:action', 'Next action', recommendedAction)], null, false, payload.status === 'limited' ? 'limited' : 'ready'),
      section('follow_up_questions', 'FOLLOW-UP QUESTIONS', followUpItems, null, false, followUpItems.length === 0 ? 'unavailable' : 'ready'),
    ],
  };
}

export function buildLimitedPayload(
  title: string,
  message: string,
  suggestions: string[],
  mode: CopilotMode = 'summary',
): CopilotQueryLimitedPayload & { document: CopilotDocument } {
  return {
    status: 'limited',
    title,
    message,
    suggestions,
    document: {
      mode,
      sections: [
        section('summary', 'SUMMARY', [item('limited:summary', title, message, { availability: 'limited' })], message, false, 'limited'),
        section('evidence', 'EVIDENCE', [], null, true, 'unavailable'),
        section('signals', 'SIGNALS', [], null, true, 'unavailable'),
        section('network_context', 'NETWORK CONTEXT', [], null, true, 'unavailable'),
        section('recommended_action', 'RECOMMENDED ACTION', [
          item('limited:action', 'Recommended next step', suggestions[0] ?? 'Gather more context before retrying.', {
            availability: 'limited',
          }),
        ], null, false, 'limited'),
        section('follow_up_questions', 'FOLLOW-UP QUESTIONS', suggestions.map((suggestion, index) => item(`limited:suggestion:${index}`, suggestion)), null, false, suggestions.length > 0 ? 'ready' : 'unavailable'),
      ],
    },
    results: [],
    explanations: [],
    graphInsights: [],
  };
}

export function buildDocumentFromPlanPayload(payload: CopilotPlanPayload): CopilotDocument {
  return {
    mode: 'plan',
    sections: [
      section('summary', 'SUMMARY', [
        item('plan:objective', 'Objective', payload.objective),
      ], payload.objective),
      section('evidence', 'EVIDENCE', payload.evidenceSummary.map((entry, index) => item(
        `plan:evidence:${index}`,
        entry.label,
        `${entry.detail} · ${entry.source} · ${formatAbsoluteTime(entry.observedAt)}`,
      )), null, true, payload.evidenceSummary.length > 0 ? 'ready' : 'unavailable'),
      section('signals', 'SIGNALS', payload.signalChecks.map((signalCheck, index) => item(
        `plan:signal:${index}`,
        signalCheck.investigatorId,
        `${signalCheck.findingCount} finding(s) · ${Math.round(signalCheck.confidence * 100)}% confidence · ${signalCheck.summary}`,
      )), null, true, payload.signalChecks.length > 0 ? 'ready' : 'unavailable'),
      section('network_context', 'NETWORK CONTEXT', payload.networkContext.topPaths.map((path, index) => item(
        `plan:path:${index}`,
        `Path ${index + 1}`,
        path.explanation,
        {
          graphAction: {
            kind: 'focus-node',
            nodeId: path.nodeIds[0] ?? payload.networkContext.focusNodeId,
          },
        },
      )), null, true, payload.networkContext.topPaths.length > 0 ? 'ready' : 'unavailable'),
      section('recommended_action', 'RECOMMENDED ACTION', [
        item('plan:recommended', 'Recommended action', payload.recommendedAction),
      ]),
      section('follow_up_questions', 'FOLLOW-UP QUESTIONS', [
        ...payload.keyQuestions.map((question, index) => item(`plan:key-question:${index}`, question)),
        ...payload.followUpQueries.map((query, index) => item(`plan:follow-up:${index}`, query)),
      ]),
    ],
  };
}

export function buildDocumentFromHistory(entries: CopilotSessionEntry[], events: CopilotHistoryEvent[]): CopilotDocument {
  return {
    mode: 'history',
    sections: [
      section('summary', 'SUMMARY', entries.slice(-6).reverse().map((entry) => item(
        `history:entry:${entry.id}`,
        entry.query,
        `${entry.title} · ${formatAbsoluteTime(entry.createdAt)}`,
      )), entries.length > 0 ? `${entries.length} Copilot response${entries.length === 1 ? '' : 's'} in this session.` : 'No Copilot activity yet.'),
      section('evidence', 'EVIDENCE', [], null, true, 'unavailable'),
      section('signals', 'SIGNALS', events.slice(-10).reverse().map((event) => item(
        `history:event:${event.id}`,
        event.label,
        [compactText(event.detail), formatAbsoluteTime(event.createdAt)].filter(Boolean).join(' · '),
      )), null, true, events.length > 0 ? 'ready' : 'unavailable'),
      section('network_context', 'NETWORK CONTEXT', [], null, true, 'unavailable'),
      section('recommended_action', 'RECOMMENDED ACTION', [
        item('history:action', 'Next step', entries.length > 0 ? 'Review the latest response or run a new targeted command.' : 'Start with /investigate or ask for a structured summary.'),
      ], null, false, entries.length > 0 ? 'ready' : 'limited'),
      section('follow_up_questions', 'FOLLOW-UP QUESTIONS', [
        item('history:follow-up:0', 'Show the latest plan'),
        item('history:follow-up:1', 'Run a targeted check'),
      ]),
    ],
  };
}
