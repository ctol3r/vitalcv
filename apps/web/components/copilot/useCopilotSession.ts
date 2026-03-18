'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildDocumentFromHistory,
  buildDocumentFromPlanPayload,
  buildDocumentFromQueryPayload,
} from './documentBuilders';
import type {
  CopilotCommandPayload,
  CopilotContextPayload,
  CopilotDocument,
  CopilotGraphAction,
  CopilotHistoryEvent,
  CopilotMode,
  CopilotPlanPayload,
  CopilotQueryPayload,
  CopilotSessionAction,
  CopilotSessionEntry,
} from './types';

interface CopilotHostActions {
  onNavigateToNpi?: (npi: string) => void;
  onSelectFinding?: (findingId: string) => void;
  onSelectStoryline?: (storylineId: string) => void;
  onFocusGraphNode?: (nodeId: string) => void;
  onHighlightGraphNode?: (nodeId: string) => void;
  onOpenEvidence?: (findingId: string, evidenceIndex: number | null) => void;
}

interface UseCopilotSessionInput {
  sessionId: string;
  context: CopilotContextPayload;
  host: CopilotHostActions;
}

interface PendingPlanState {
  entryId: string;
  query: string;
  payload: CopilotPlanPayload;
}

type CompareResponse = {
  comparison?: {
    ranking?: Array<{ npi: string; score: number; band: string }>;
    commonGaps?: string[];
    strengthDelta?: Array<{ dimension: string; spread: number; leader: string }>;
  };
  recommendations?: string[];
};

type NetworkResponse = {
  network?: {
    collaborators?: Array<{ nodeId: string; label: string; type: string; sharedEdges: number; edgeTypes: string[] }>;
    institutions?: Array<{ institutionId: string; name: string; memberCount: number }>;
    networkStats?: {
      totalNodes: number;
      totalEdges: number;
      clinicianCount: number;
      institutionCount: number;
      isolatedNodes: number;
    };
  };
  recommendations?: string[];
};

type VerifyProfessionalResponse = {
  authorization?: {
    verdict?: string;
    confidence?: string;
    summary?: string;
    reasons?: string[];
  };
  checks?: Record<string, { status?: string; label?: string; detail?: string }>;
  blockingIssues?: string[];
  warnings?: string[];
  trustBand?: string;
  readinessScore?: number;
};

type OigCheckResponse = {
  excluded?: boolean;
  matchType?: string;
  detail?: string;
  firstName?: string;
  lastName?: string;
  npi?: string;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function compactText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function extractNpi(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const direct = value.match(/\b(\d{10})\b/);
  if (direct?.[1]) {
    return direct[1];
  }

  const typed = value.match(/(?:clinician:|provider:|npi:)(\d{10})/i);
  return typed?.[1] ?? null;
}

function parseCommand(query: string): CopilotCommandPayload | null {
  const trimmed = query.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const [rawName, ...rest] = trimmed.slice(1).split(/\s+/);
  const name = rawName?.trim().toLowerCase();
  const argument = rest.join(' ').trim();

  switch (name) {
    case 'investigate':
    case 'summarize':
    case 'plan':
    case 'check':
    case 'compare':
    case 'network':
    case 'history':
      return {
        name,
        argument: argument.length > 0 ? argument : null,
      };
    default:
      return null;
  }
}

function buildQueryContext(context: CopilotContextPayload) {
  return {
    scope: context.scope,
    provider: context.provider
      ? {
          npi: context.provider.npi,
          label: context.provider.label,
          specialty: context.provider.specialty ?? undefined,
          state: context.provider.state ?? undefined,
          trustScore: context.provider.trustScore,
          trustBand: context.provider.trustBand,
          trustConfidence: context.provider.trustConfidence ?? undefined,
          activeFindings: context.provider.activeFindings ?? undefined,
        }
      : undefined,
    finding: context.finding
      ? {
          id: context.finding.id,
          findingType: context.finding.findingType,
          title: context.finding.title,
          severity: context.finding.severity,
          status: context.finding.status,
          summary: context.finding.summary,
          explanation: context.finding.explanation,
          confidence: context.finding.confidence,
          priorityScore: context.finding.priorityScore,
          evidence: context.finding.evidence,
          storylineId: context.finding.storylineId ?? undefined,
          storylineTitle: context.finding.storylineTitle ?? undefined,
          npis: context.finding.npis,
        }
      : undefined,
    storyline: context.storyline
      ? {
          id: context.storyline.id,
          title: context.storyline.title,
          storylineType: context.storyline.storylineType,
          severity: context.storyline.severity,
          status: context.storyline.status,
          narrative: context.storyline.narrative ?? undefined,
          whyItMatters: context.storyline.whyItMatters,
          findingCount: context.storyline.findingCount ?? undefined,
          entityCount: context.storyline.entityCount ?? undefined,
          confidence: context.storyline.confidence,
          progressionScore: context.storyline.progressionScore ?? undefined,
          recommendedActions: context.storyline.recommendedActions,
          lastActivityAt: context.storyline.lastActivityAt ?? undefined,
          evidence: context.storyline.evidence,
        }
      : undefined,
    graph: context.graph
      ? {
          focusNodeId: context.graph.focusNodeId ?? undefined,
          selectedNodeId: context.graph.selectedNodeId ?? undefined,
          neighborNodeIds: context.graph.neighborNodeIds,
          neighborEdgeIds: context.graph.neighborEdgeIds,
        }
      : undefined,
    recentFindings: context.recentFindings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      summary: finding.summary,
      severity: finding.severity ?? 'unknown',
      priorityScore: finding.priorityScore ?? undefined,
      href: finding.href ?? undefined,
    })),
    evidenceSummary: context.evidenceSummary,
    riskSummary: context.riskSummary ?? undefined,
  };
}

function describeCurrentScope(context: CopilotContextPayload): string {
  if (context.finding?.title) {
    return `Finding ${context.finding.title}`;
  }

  if (context.storyline?.title) {
    return `Storyline ${context.storyline.title}`;
  }

  if (context.provider?.label) {
    return `Provider ${context.provider.label}`;
  }

  if (context.provider?.npi) {
    return `Provider NPI ${context.provider.npi}`;
  }

  if (context.graph?.selectedNodeId) {
    return `Graph node ${context.graph.selectedNodeId}`;
  }

  if (context.graph?.focusNodeId) {
    return `Graph node ${context.graph.focusNodeId}`;
  }

  if (context.recentFindings.length > 0) {
    return `${context.recentFindings.length} recent findings`;
  }

  return 'Current investigation scope';
}

function groundedFallbackSuggestions(context: CopilotContextPayload): string[] {
  const suggestions: string[] = [];

  if (context.finding?.title) {
    suggestions.push(`Open the evidence chain for ${context.finding.title}`);
    suggestions.push(`Trace the storyline linked to ${context.finding.title}`);
  }

  if (context.provider?.npi) {
    const providerLabel = context.provider.label ?? `NPI ${context.provider.npi}`;
    suggestions.push(`Review live findings for ${providerLabel}`);
    suggestions.push(`Focus the graph around ${providerLabel}`);
  }

  if (context.storyline?.title) {
    suggestions.push(`Summarize storyline ${context.storyline.title}`);
    suggestions.push(`Inspect the findings tied to ${context.storyline.title}`);
  }

  if (context.graph?.selectedNodeId || context.graph?.focusNodeId) {
    suggestions.push('Highlight the current graph neighborhood');
  }

  if (suggestions.length === 0) {
    suggestions.push('Open an investigation');
    suggestions.push('Review recent findings');
    suggestions.push('Focus the trust graph');
  }

  return [...new Set(suggestions)].slice(0, 4);
}

function buildContextualLimitedEntry(
  context: CopilotContextPayload,
  input: {
    query: string;
    title: string;
    message: string;
    suggestions: string[];
    mode?: CopilotMode;
    source?: string;
  },
): CopilotSessionEntry {
  const payload: CopilotQueryPayload = {
    status: 'limited',
    title: input.title,
    message: input.message,
    suggestions: input.suggestions,
    results: [],
    explanations: [],
    graphInsights: [],
  };
  const document = buildDocumentFromQueryPayload(payload, context);
  document.mode = input.mode ?? document.mode;

  return buildSessionEntry({
    query: input.query,
    title: input.title,
    status: 'limited',
    suggestions: input.suggestions,
    document,
    message: input.message,
    source: input.source,
  });
}

function buildSessionEntry(input: {
  query: string;
  title: string;
  status: CopilotSessionEntry['status'];
  suggestions: string[];
  document: CopilotDocument;
  message?: string | null;
  actions?: CopilotSessionAction[];
  source?: string;
}): CopilotSessionEntry {
  return {
    id: createId('copilot-entry'),
    createdAt: new Date().toISOString(),
    query: input.query,
    title: input.title,
    status: input.status,
    suggestions: input.suggestions,
    document: input.document,
    message: input.message ?? null,
    actions: input.actions,
    mode: input.document.mode,
    meta: input.source ? { source: input.source } : undefined,
  };
}

function normalizeQueryPayload(rawValue: unknown): CopilotQueryPayload {
  const payload = rawValue && typeof rawValue === 'object'
    ? rawValue as Record<string, unknown>
    : {};

  if (payload.status === 'ok' || payload.status === 'limited') {
    return payload as unknown as CopilotQueryPayload;
  }

  const title = compactText(payload.title) ?? (compactText(payload.type) === 'system_response' ? 'Copilot needs more investigation context' : null);
  const message = compactText(payload.message);
  if (title && message) {
    return {
      status: 'limited',
      title,
      message,
      suggestions: Array.isArray(payload.suggestions)
        ? payload.suggestions.filter((entry): entry is string => typeof entry === 'string')
        : [],
      document: payload.document as CopilotDocument | undefined,
      results: Array.isArray(payload.results) ? payload.results as CopilotQueryPayload['results'] : [],
      explanations: Array.isArray(payload.explanations) ? payload.explanations as CopilotQueryPayload['explanations'] : [],
      graphInsights: Array.isArray(payload.graphInsights) ? payload.graphInsights as CopilotQueryPayload['graphInsights'] : [],
      parsedQuery: payload.parsedQuery,
    };
  }

  return {
    status: 'limited',
    title: 'Copilot needs more investigation context',
    message: message ?? 'Copilot could not build a trustworthy response for this request.',
    suggestions: Array.isArray(payload.suggestions)
      ? payload.suggestions.filter((entry): entry is string => typeof entry === 'string')
      : ['Open an investigation', 'Select a finding', 'Focus the graph'],
    document: undefined,
    results: Array.isArray(payload.results) ? payload.results as CopilotQueryPayload['results'] : [],
    explanations: Array.isArray(payload.explanations) ? payload.explanations as CopilotQueryPayload['explanations'] : [],
    graphInsights: Array.isArray(payload.graphInsights) ? payload.graphInsights as CopilotQueryPayload['graphInsights'] : [],
    parsedQuery: payload.parsedQuery,
  };
}

function buildCheckDocument(title: string, summary: string, lines: string[]): CopilotDocument {
  return {
    mode: 'check',
    sections: [
      {
        id: 'summary',
        title: 'SUMMARY',
        summary,
        items: lines.slice(0, 1).map((line, index) => ({
          id: `check:summary:${index}`,
          label: title,
          detail: line,
        })),
      },
      {
        id: 'evidence',
        title: 'EVIDENCE',
        items: [],
        availability: 'unavailable',
        collapsedByDefault: true,
      },
      {
        id: 'signals',
        title: 'SIGNALS',
        items: lines.map((line, index) => ({
          id: `check:signal:${index}`,
          label: `Signal ${index + 1}`,
          detail: line,
        })),
        collapsedByDefault: true,
        availability: lines.length > 0 ? 'ready' : 'unavailable',
      },
      {
        id: 'network_context',
        title: 'NETWORK CONTEXT',
        items: [],
        availability: 'unavailable',
        collapsedByDefault: true,
      },
      {
        id: 'recommended_action',
        title: 'RECOMMENDED ACTION',
        items: [{
          id: 'check:action',
          label: 'Next action',
          detail: summary,
        }],
      },
      {
        id: 'follow_up_questions',
        title: 'FOLLOW-UP QUESTIONS',
        items: [
          {
            id: 'check:follow-up:0',
            label: 'Run another targeted check',
          },
        ],
      },
    ],
  };
}

function buildCompareDocument(payload: CompareResponse): CopilotDocument {
  const ranking = payload.comparison?.ranking ?? [];
  const commonGaps = payload.comparison?.commonGaps ?? [];
  const recommendations = payload.recommendations ?? [];
  return {
    mode: 'compare',
    sections: [
      {
        id: 'summary',
        title: 'SUMMARY',
        summary: ranking.length > 0 ? `${ranking.length} provider profiles compared.` : 'Comparison completed.',
        items: ranking.map((entry) => ({
          id: `compare:${entry.npi}`,
          label: `NPI ${entry.npi}`,
          detail: `${entry.score} points · ${entry.band}`,
          entities: [{
            id: `provider:${entry.npi}`,
            kind: 'provider',
            label: `NPI ${entry.npi}`,
            value: entry.npi,
          }],
        })),
      },
      {
        id: 'evidence',
        title: 'EVIDENCE',
        items: commonGaps.map((gap, index) => ({
          id: `compare:gap:${index}`,
          label: 'Common gap',
          detail: gap,
        })),
        collapsedByDefault: true,
        availability: commonGaps.length > 0 ? 'ready' : 'unavailable',
      },
      {
        id: 'signals',
        title: 'SIGNALS',
        items: (payload.comparison?.strengthDelta ?? []).map((entry, index) => ({
          id: `compare:delta:${index}`,
          label: entry.dimension,
          detail: `${entry.spread} point spread led by NPI ${entry.leader}`,
        })),
        collapsedByDefault: true,
        availability: (payload.comparison?.strengthDelta?.length ?? 0) > 0 ? 'ready' : 'unavailable',
      },
      {
        id: 'network_context',
        title: 'NETWORK CONTEXT',
        items: [],
        collapsedByDefault: true,
        availability: 'unavailable',
      },
      {
        id: 'recommended_action',
        title: 'RECOMMENDED ACTION',
        items: recommendations.slice(0, 2).map((recommendation, index) => ({
          id: `compare:recommendation:${index}`,
          label: 'Recommendation',
          detail: recommendation,
        })),
        availability: recommendations.length > 0 ? 'ready' : 'limited',
      },
      {
        id: 'follow_up_questions',
        title: 'FOLLOW-UP QUESTIONS',
        items: [
          { id: 'compare:follow-up:0', label: 'Run /summarize on the current provider' },
        ],
      },
    ],
  };
}

function buildNetworkDocument(payload: NetworkResponse): CopilotDocument {
  const network = payload.network;
  const collaborators = network?.collaborators ?? [];
  const institutions = network?.institutions ?? [];
  const stats = network?.networkStats;
  return {
    mode: 'network',
    sections: [
      {
        id: 'summary',
        title: 'SUMMARY',
        summary: stats
          ? `${stats.totalNodes} nodes and ${stats.totalEdges} edges in the current network slice.`
          : 'Network analysis completed.',
        items: stats ? [
          {
            id: 'network:stats',
            label: 'Visible network',
            detail: `${stats.clinicianCount} clinicians · ${stats.institutionCount} institutions · ${stats.isolatedNodes} isolated nodes`,
          },
        ] : [],
      },
      {
        id: 'evidence',
        title: 'EVIDENCE',
        items: collaborators.slice(0, 5).map((entry) => ({
          id: `network:collaborator:${entry.nodeId}`,
          label: entry.label,
          detail: `${entry.sharedEdges} shared edge(s) · ${entry.edgeTypes.join(', ')}`,
          graphAction: {
            kind: 'highlight-neighborhood',
            nodeId: entry.nodeId,
          },
        })),
        collapsedByDefault: true,
        availability: collaborators.length > 0 ? 'ready' : 'unavailable',
      },
      {
        id: 'signals',
        title: 'SIGNALS',
        items: institutions.slice(0, 5).map((entry) => ({
          id: `network:institution:${entry.institutionId}`,
          label: entry.name,
          detail: `${entry.memberCount} linked member(s)`,
        })),
        collapsedByDefault: true,
        availability: institutions.length > 0 ? 'ready' : 'unavailable',
      },
      {
        id: 'network_context',
        title: 'NETWORK CONTEXT',
        items: (payload.recommendations ?? []).map((recommendation, index) => ({
          id: `network:recommendation:${index}`,
          label: `Network signal ${index + 1}`,
          detail: recommendation,
        })),
        collapsedByDefault: true,
        availability: (payload.recommendations?.length ?? 0) > 0 ? 'ready' : 'unavailable',
      },
      {
        id: 'recommended_action',
        title: 'RECOMMENDED ACTION',
        items: [{
          id: 'network:action',
          label: 'Next action',
          detail: payload.recommendations?.[0] ?? 'Focus the strongest collaborator or institution cluster next.',
        }],
      },
      {
        id: 'follow_up_questions',
        title: 'FOLLOW-UP QUESTIONS',
        items: [
          { id: 'network:follow-up:0', label: 'Highlight this provider’s neighborhood' },
        ],
      },
    ],
  };
}

function buildVerifyDocument(payload: VerifyProfessionalResponse): CopilotDocument {
  const checks = Object.entries(payload.checks ?? {});
  return buildCheckDocument(
    payload.authorization?.verdict ?? 'Provider verification',
    payload.authorization?.summary ?? 'Provider verification completed.',
    [
      ...(payload.authorization?.reasons ?? []),
      ...checks.map(([, value]) => `${value.label ?? 'Check'}: ${value.status ?? 'UNKNOWN'}${value.detail ? ` — ${value.detail}` : ''}`),
      ...payload.blockingIssues ?? [],
      ...payload.warnings ?? [],
    ],
  );
}

function buildOigDocument(payload: OigCheckResponse): CopilotDocument {
  const status = payload.excluded ? 'Sanction flagged' : 'No sanctions detected';
  const summary = payload.excluded
    ? `OIG/LEIE reported a ${payload.matchType ?? 'MATCH'} result for NPI ${payload.npi ?? 'unknown'}.`
    : `OIG/LEIE exclusion check is clear for NPI ${payload.npi ?? 'unknown'}.`;

  return buildCheckDocument(status, summary, [
    `${payload.firstName ?? 'Unknown'} ${payload.lastName ?? ''}`.trim(),
    payload.detail ?? payload.matchType ?? status,
  ].filter((value): value is string => value.trim().length > 0));
}

function commandSuggestions(context: CopilotContextPayload): string[] {
  if (context.scope === 'finding' && context.finding) {
    return [
      `Explain ${context.finding.title}`,
      'What evidence is strongest here?',
      '/investigate',
    ];
  }

  if (context.scope === 'storyline' && context.storyline) {
    return [
      `Explain ${context.storyline.title}`,
      '/plan',
      'Show related entities',
    ];
  }

  if (context.provider) {
    return [
      `Summarize this provider’s current risk`,
      'What should I do next?',
      '/check oig',
    ];
  }

  return [
    'Summarize the current operator scope',
    '/investigate',
    'Show related entities',
  ];
}

export function useCopilotSession(input: UseCopilotSessionInput) {
  const { context, host, sessionId } = input;
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<CopilotSessionEntry[]>([]);
  const [events, setEvents] = useState<CopilotHistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const pendingPlansRef = useRef<Map<string, PendingPlanState>>(new Map());

  const quickSuggestions = useMemo(() => commandSuggestions(context), [context]);

  const recordEvent = useCallback((label: string, detail?: string | null) => {
    setEvents((current) => [
      ...current,
      {
        id: createId('copilot-event'),
        createdAt: new Date().toISOString(),
        label,
        detail: detail ?? null,
      },
    ]);
  }, []);

  const appendEntry = useCallback((entry: CopilotSessionEntry) => {
    setEntries((current) => [...current, entry]);
  }, []);

  const resolveProviderNpi = useCallback(async (value: string | null | undefined): Promise<string | null> => {
    const direct = extractNpi(value);
    if (direct) {
      return direct;
    }

    const query = compactText(value);
    if (!query) {
      return null;
    }

    const response = await fetch(`/api/intelligence/providers?q=${encodeURIComponent(query)}&limit=1`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null) as { providers?: Array<{ npi: string }> } | null;
    const npi = payload?.providers?.[0]?.npi;
    return typeof npi === 'string' ? npi : null;
  }, []);

  const handleEntity = useCallback((value: string) => {
    const npi = extractNpi(value);
    if (npi && host.onNavigateToNpi) {
      host.onNavigateToNpi(npi);
      return;
    }

    if (value.startsWith('finding:') && host.onSelectFinding) {
      host.onSelectFinding(value.replace(/^finding:/, ''));
      return;
    }

    if (value.startsWith('storyline:') && host.onSelectStoryline) {
      host.onSelectStoryline(value.replace(/^storyline:/, ''));
    }
  }, [host]);

  const handleCitation = useCallback((findingId: string | null | undefined, evidenceIndex: number | null | undefined) => {
    if (findingId && host.onSelectFinding) {
      host.onSelectFinding(findingId);
    }
    if (findingId && host.onOpenEvidence) {
      host.onOpenEvidence(findingId, evidenceIndex ?? null);
    }
  }, [host]);

  const handleGraphAction = useCallback((action: CopilotGraphAction | null | undefined) => {
    if (!action) {
      return;
    }

    if (action.kind === 'navigate-provider' && action.npi && host.onNavigateToNpi) {
      host.onNavigateToNpi(action.npi);
      return;
    }

    if (action.kind === 'focus-node' && action.nodeId && host.onFocusGraphNode) {
      host.onFocusGraphNode(action.nodeId);
      return;
    }

    if (action.kind === 'highlight-neighborhood' && action.nodeId && host.onHighlightGraphNode) {
      host.onHighlightGraphNode(action.nodeId);
    }
  }, [host]);

  const runSupportedPlanChecks = useCallback(async (plan: PendingPlanState) => {
    const providerNpi = context.provider?.npi ?? context.finding?.providerNpi ?? context.storyline?.providerNpi ?? null;
    if (!providerNpi) {
      appendEntry(buildContextualLimitedEntry(context, {
        query: plan.query,
        title: 'Investigation checks are unavailable',
        message: `This plan currently resolves to ${describeCurrentScope(context)}, but not yet to a provider-backed check set.`,
        suggestions: [
          ...groundedFallbackSuggestions(context),
          'Retry /investigate after anchoring the workbench.',
        ].slice(0, 4),
        mode: 'plan',
        source: 'plan-runner',
      }));
      return;
    }

    const checks: Array<{ label: string; run: () => Promise<CopilotDocument> }> = [
      {
        label: 'Run provider verification',
        run: async () => {
          const response = await fetch(`/api/verify-professional/${providerNpi}?live=false`, { cache: 'no-store' });
          const payload = await response.json().catch(() => null) as VerifyProfessionalResponse | null;
          if (!response.ok || !payload) {
            throw new Error('Provider verification unavailable');
          }
          return buildVerifyDocument(payload);
        },
      },
      {
        label: 'Run OIG/LEIE check',
        run: async () => {
          const response = await fetch(`/api/psv/oig/check/${providerNpi}`, { cache: 'no-store' });
          const payload = await response.json().catch(() => null) as OigCheckResponse | null;
          if (!response.ok || !payload) {
            throw new Error('OIG check unavailable');
          }
          return buildOigDocument(payload);
        },
      },
      {
        label: 'Load network analysis',
        run: async () => {
          const response = await fetch(`/api/investigation/network/${providerNpi}?depth=2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ depth: 2 }),
          });
          const payload = await response.json().catch(() => null) as NetworkResponse | null;
          if (!response.ok || !payload) {
            throw new Error('Network analysis unavailable');
          }
          return buildNetworkDocument(payload);
        },
      },
    ];

    recordEvent('Investigation approved', plan.payload.objective);
    for (const check of checks) {
      recordEvent('Check started', check.label);
      try {
        const document = await check.run();
        appendEntry(buildSessionEntry({
          query: check.label,
          title: check.label,
          status: 'ok',
          suggestions: ['Run /history', 'Ask for a follow-up summary'],
          document,
          source: 'plan-check',
        }));
        recordEvent('Check completed', check.label);
      } catch (error) {
        appendEntry(buildContextualLimitedEntry(context, {
          query: check.label,
          title: 'Check unavailable',
          message: `${error instanceof Error ? error.message : 'The requested check could not complete.'} ${describeCurrentScope(context)} remains available locally.`,
          suggestions: [
            ...groundedFallbackSuggestions(context),
            'Run /history',
          ].slice(0, 4),
          mode: 'check',
          source: 'plan-check',
        }));
        recordEvent('Check limited', check.label);
      }
    }
  }, [appendEntry, context, recordEvent]);

  const runAction = useCallback(async (action: CopilotSessionAction) => {
    if (action.kind === 'reuse-prompt' && action.prompt) {
      setDraft(action.prompt);
      return;
    }

    if (action.kind === 'approve-plan') {
      const pendingPlan = pendingPlansRef.current.get(action.id);
      if (!pendingPlan) {
        return;
      }
      pendingPlansRef.current.delete(action.id);
      setLoading(true);
      try {
        await runSupportedPlanChecks(pendingPlan);
      } finally {
        setLoading(false);
      }
    }
  }, [runSupportedPlanChecks]);

  const submitPrompt = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 3 || loading) {
      return;
    }

    const command = parseCommand(trimmed);
    setLoading(true);
    recordEvent('Prompt submitted', trimmed);

    try {
      if (command?.name === 'history') {
        const document = buildDocumentFromHistory(entries, events);
        appendEntry(buildSessionEntry({
          query: trimmed,
          title: 'Session history',
          status: 'ok',
          suggestions: ['Run /investigate', 'Ask for a summary'],
          document,
          source: 'history',
        }));
        return;
      }

      if (command?.name === 'investigate' || command?.name === 'plan') {
        const providerId = await resolveProviderNpi(command.argument)
          ?? context.provider?.npi
          ?? context.finding?.providerNpi
          ?? context.storyline?.providerNpi
          ?? null;
        const storylineId = context.scope === 'storyline'
          ? context.storyline?.id ?? context.finding?.storylineId ?? null
          : context.finding?.storylineId ?? context.storyline?.id ?? null;

        if (!providerId && !storylineId) {
          appendEntry(buildContextualLimitedEntry(context, {
            query: trimmed,
            title: 'Copilot needs more investigation context',
            message: `This request currently resolves to ${describeCurrentScope(context)}, but not yet to a provider or storyline anchor.`,
            suggestions: [
              ...groundedFallbackSuggestions(context),
              'Retry /investigate after anchoring the workbench.',
            ].slice(0, 4),
            mode: 'plan',
            source: 'plan',
          }));
          return;
        }

        const response = await fetch('/api/copilot/investigation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            storylineId,
            objective: command.argument && extractNpi(command.argument) === null ? command.argument : undefined,
          }),
        });
        const payload = await response.json().catch(() => null) as CopilotPlanPayload | null;
        if (!response.ok || !payload) {
          throw new Error('Investigation plan unavailable');
        }

        const actions: CopilotSessionAction[] = [
          {
            id: createId('reuse-prompt'),
            label: 'Edit objective in prompt',
            kind: 'reuse-prompt',
            prompt: `/investigate ${payload.objective}`,
          },
        ];

        if (command.name === 'investigate') {
          const approveActionId = createId('approve-plan');
          actions.unshift({
            id: approveActionId,
            label: 'Approve plan',
            kind: 'approve-plan',
          });
          pendingPlansRef.current.set(approveActionId, {
            entryId: approveActionId,
            query: trimmed,
            payload,
          });
        }

        appendEntry(buildSessionEntry({
          query: trimmed,
          title: command.name === 'investigate' ? 'Investigation plan ready' : 'Plan ready',
          status: 'ok',
          suggestions: payload.followUpQueries,
          document: buildDocumentFromPlanPayload(payload),
          actions,
          source: 'plan',
        }));
        recordEvent('Plan generated', payload.objective);
        return;
      }

      if (command?.name === 'compare') {
        const currentNpi = context.provider?.npi ?? context.finding?.providerNpi ?? context.storyline?.providerNpi ?? null;
        const compareNpi = await resolveProviderNpi(command.argument);
        if (!currentNpi || !compareNpi || currentNpi === compareNpi) {
          appendEntry(buildContextualLimitedEntry(context, {
            query: trimmed,
            title: 'Comparison needs two providers',
            message: `The current scope is ${describeCurrentScope(context)}, but a second provider could not be resolved cleanly.`,
            suggestions: [
              ...groundedFallbackSuggestions(context),
              'Use /compare <provider name or NPI>.',
            ].slice(0, 4),
            mode: 'compare',
            source: 'compare',
          }));
          return;
        }

        const response = await fetch('/api/investigation/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npis: [currentNpi, compareNpi] }),
        });
        const payload = await response.json().catch(() => null) as CompareResponse | null;
        if (!response.ok || !payload) {
          throw new Error('Comparison unavailable');
        }

        appendEntry(buildSessionEntry({
          query: trimmed,
          title: 'Comparison completed',
          status: 'ok',
          suggestions: ['Run /history', 'Ask for a summary of the stronger profile'],
          document: buildCompareDocument(payload),
          source: 'compare',
        }));
        return;
      }

      if (command?.name === 'network') {
        const resolvedArgumentNpi = await resolveProviderNpi(command.argument);
        if (command.argument && !resolvedArgumentNpi) {
          appendEntry(buildContextualLimitedEntry(context, {
            query: trimmed,
            title: 'Network path needs a provider-backed entity',
            message: `The requested network entity does not resolve cleanly, while ${describeCurrentScope(context)} remains in scope.`,
            suggestions: [
              ...groundedFallbackSuggestions(context),
              'Use /network <provider name or NPI>.',
            ].slice(0, 4),
            mode: 'network',
            source: 'network',
          }));
          return;
        }

        const npi = resolvedArgumentNpi
          ?? context.provider?.npi
          ?? context.finding?.providerNpi
          ?? context.storyline?.providerNpi
          ?? null;
        if (!npi) {
          appendEntry(buildContextualLimitedEntry(context, {
            query: trimmed,
            title: 'Network analysis needs a provider anchor',
            message: `Network analysis could not resolve a provider anchor for ${describeCurrentScope(context)}.`,
            suggestions: [
              ...groundedFallbackSuggestions(context),
              'Use /network <provider name or NPI>.',
            ].slice(0, 4),
            mode: 'network',
            source: 'network',
          }));
          return;
        }

        const response = await fetch(`/api/investigation/network/${npi}?depth=2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ depth: 2 }),
        });
        const payload = await response.json().catch(() => null) as NetworkResponse | null;
        if (!response.ok || !payload) {
          throw new Error('Network analysis unavailable');
        }

        appendEntry(buildSessionEntry({
          query: trimmed,
          title: 'Network analysis completed',
          status: 'ok',
          suggestions: ['Highlight this provider’s neighborhood', 'Explain the strongest collaborator'],
          document: buildNetworkDocument(payload),
          source: 'network',
        }));
        return;
      }

      if (command?.name === 'check') {
        const npi = await resolveProviderNpi(command.argument)
          ?? context.provider?.npi
          ?? context.finding?.providerNpi
          ?? context.storyline?.providerNpi
          ?? null;

        if (!npi) {
          appendEntry(buildContextualLimitedEntry(context, {
            query: trimmed,
            title: 'Targeted check needs a provider',
            message: `Supported checks require a resolved provider NPI for ${describeCurrentScope(context)}.`,
            suggestions: [
              ...groundedFallbackSuggestions(context),
              'Use /check with a provider name or NPI.',
            ].slice(0, 4),
            mode: 'check',
            source: 'check',
          }));
          return;
        }

        const lowerArgument = (command.argument ?? trimmed).toLowerCase();
        if (/(network|graph|relationship|path)/.test(lowerArgument)) {
          const response = await fetch(`/api/investigation/network/${npi}?depth=2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ depth: 2 }),
          });
          const payload = await response.json().catch(() => null) as NetworkResponse | null;
          if (!response.ok || !payload) {
            throw new Error('Network analysis unavailable');
          }
          appendEntry(buildSessionEntry({
            query: trimmed,
            title: 'Network signal check completed',
            status: 'ok',
            suggestions: ['Run /history', 'Explain the strongest collaborator'],
            document: buildNetworkDocument(payload),
            source: 'check',
          }));
          return;
        }

        if (/(oig|leie|sanction|exclusion)/.test(lowerArgument)) {
          const response = await fetch(`/api/psv/oig/check/${npi}`, { cache: 'no-store' });
          const payload = await response.json().catch(() => null) as OigCheckResponse | null;
          if (!response.ok || !payload) {
            throw new Error('OIG check unavailable');
          }
          appendEntry(buildSessionEntry({
            query: trimmed,
            title: 'OIG/LEIE check completed',
            status: 'ok',
            suggestions: ['Run /history', 'Check provider verification next'],
            document: buildOigDocument(payload),
            source: 'check',
          }));
          return;
        }

        const response = await fetch(`/api/verify-professional/${npi}?live=false`, { cache: 'no-store' });
        const payload = await response.json().catch(() => null) as VerifyProfessionalResponse | null;
        if (!response.ok || !payload) {
          throw new Error('Provider verification unavailable');
        }

        appendEntry(buildSessionEntry({
          query: trimmed,
          title: 'Provider verification completed',
          status: 'ok',
          suggestions: ['Run /history', 'Check sanctions with /check oig'],
          document: buildVerifyDocument(payload),
          source: 'check',
        }));
        return;
      }

      const response = await fetch('/api/copilot/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: command?.name === 'summarize' && command.argument ? command.argument : trimmed,
          sessionId,
          context: buildQueryContext(context),
          command: command ? {
            name: command.name,
            argument: command.argument,
            raw: trimmed,
          } : undefined,
        }),
      });
      const payload = normalizeQueryPayload(await response.json().catch(() => null));
      const displayPayload = payload.status === 'limited' && /requires authentication|requires organization context|source unavailable|needs more investigation context|could not safely continue|could not build a trustworthy response|invalid response/i.test(
        `${payload.title} ${payload.message}`,
      )
        ? {
            ...payload,
            title: `${describeCurrentScope(context)} · limited response`,
            message: `Live Copilot sources are unavailable right now, but ${describeCurrentScope(context)} is still available locally.`,
            suggestions: payload.suggestions.length > 0 ? payload.suggestions : groundedFallbackSuggestions(context),
          }
        : payload;
      const document = buildDocumentFromQueryPayload(displayPayload, context);
      appendEntry(buildSessionEntry({
        query: trimmed,
        title: displayPayload.status === 'limited' ? displayPayload.title : 'Copilot response',
        status: displayPayload.status,
        suggestions: displayPayload.suggestions ?? [],
        document,
        message: displayPayload.status === 'limited' ? displayPayload.message : null,
        source: 'query',
      }));
    } catch (error) {
      appendEntry(buildContextualLimitedEntry(context, {
        query: trimmed,
        title: 'Copilot needs more investigation context',
        message: `${error instanceof Error ? error.message : 'Copilot could not complete this request.'} ${describeCurrentScope(context)} remains available locally.`,
        suggestions: groundedFallbackSuggestions(context),
        source: 'fallback',
      }));
    } finally {
      setLoading(false);
    }
  }, [appendEntry, context, entries, events, loading, recordEvent, resolveProviderNpi, sessionId]);

  const submitDraft = useCallback(async () => {
    await submitPrompt(draft);
  }, [draft, submitPrompt]);

  return {
    draft,
    setDraft,
    loading,
    entries,
    events,
    quickSuggestions,
    submitDraft,
    submitPrompt,
    runAction,
    handleEntity,
    handleCitation,
    handleGraphAction,
  };
}
