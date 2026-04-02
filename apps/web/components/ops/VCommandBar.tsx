'use client';

import { buildCommandContext, findMatchingCommands } from '@/lib/command/commands';
import { buildParsePreview, extractNpiFromValue, resolveCommandInput } from '@/lib/command/parser';
import type { VCommandActionDefinition, VCommandInput, VCommandResultItem, VSavedQuery } from '@/lib/command/types';
import type { IntelligenceProvider, ProvidersResponse } from '@/lib/intelligence/contracts';
import { useFindings } from '@/hooks/useFindings';
import { useGraph } from '@/hooks/useGraph';
import { useProvider } from '@/hooks/useIntelligenceDetail';
import { ProviderCard } from '@/design-system/components/ProviderCard';
import { RiskScoreBadge } from '@/design-system/components/RiskScoreBadge';
import type {
  CopilotExplanation,
  CopilotGraphInsight,
  CopilotQueryResponse,
  CopilotResult,
} from '../../../../core/copilot/copilotEngine';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bookmark,
  Bot,
  ChevronRight,
  Command,
  ExternalLink,
  FileOutput,
  Loader2,
  Search,
  Sparkles,
  TerminalSquare,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useState } from 'react';

const STORAGE_KEY = 'vitalcv.command.saved-queries.v1';
const MAX_SAVED_QUERIES = 8;
const MAX_RESULTS = 12;

type CopilotPreviewState = {
  parsedQuery: CopilotQueryResponse['parsedQuery'] | null;
  explanations: CopilotExplanation[];
  graphInsights: CopilotGraphInsight[];
};

type CopilotRuntimeResponse = CopilotQueryResponse & {
  status?: 'ok' | 'limited';
  title?: string;
  message?: string;
  suggestions?: string[];
};

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

function openHref(router: ReturnType<typeof useRouter>, href: string | null) {
  if (!href) {
    return;
  }

  if (href.startsWith('/api/')) {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }

  router.push(href);
}

function buildProviderResult(provider: IntelligenceProvider): VCommandResultItem {
  return {
    id: `provider:${provider.npi}`,
    kind: 'provider',
    title: provider.name,
    subtitle: provider.npi,
    summary: provider.summary || 'Provider directory result',
    badges: [
      provider.credentialHealth,
      ...provider.specialties.slice(0, 2),
    ],
    href: `/providers/${encodeURIComponent(provider.npi)}`,
    graphHref: `/graph?npi=${encodeURIComponent(provider.npi)}`,
    npi: provider.npi,
    trustScore: provider.trustScore,
  };
}

function buildCommandResult(
  definition: VCommandActionDefinition,
  input: VCommandInput,
  selectedNpi: string | null,
): VCommandResultItem {
  const context = buildCommandContext(input, selectedNpi);

  return {
    id: `command:${definition.id}`,
    kind: 'command',
    title: definition.label,
    subtitle: definition.group,
    summary: definition.description,
    badges: [
      definition.group,
      ...(definition.requiresProvider ? ['provider-context'] : []),
    ],
    href: definition.buildHref(context),
    graphHref: definition.buildGraphHref?.(context) ?? null,
    npi: context.npi,
    commandId: definition.id,
    query: context.query,
    mode: input.mode,
  };
}

function buildSavedQueryResult(savedQuery: VSavedQuery): VCommandResultItem {
  return {
    id: `saved:${savedQuery.id}`,
    kind: 'saved-query',
    title: savedQuery.query,
    subtitle: savedQuery.mode === 'copilot' ? 'Saved copilot query' : 'Saved provider search',
    summary: `Saved ${new Date(savedQuery.createdAt).toLocaleString()}`,
    badges: [savedQuery.mode, 'saved'],
    href: null,
    graphHref: null,
    npi: extractNpiFromValue(savedQuery.query),
    query: savedQuery.query,
    mode: savedQuery.mode,
  };
}

function buildCopilotResults(query: string, results: CopilotResult[], explanations: CopilotExplanation[]): VCommandResultItem[] {
  const explanationByResultId = new Map(explanations.map((explanation) => [explanation.resultId, explanation]));

  return results.map((result) => {
    const npi = extractNpiFromValue(result.id);
    const subtitleParts = [result.type, result.specialty, result.state, result.institution].filter(Boolean) as string[];

    return {
      id: `copilot:${result.id}`,
      kind: 'copilot',
      title: result.title,
      subtitle: subtitleParts.join(' • '),
      summary: result.summary,
      badges: [
        `#${result.rank}`,
        ...(result.trustBand ? [result.trustBand] : []),
        ...result.sourceCoverage.slice(0, 2),
      ],
      href: npi ? `/providers/${encodeURIComponent(npi)}` : '/graph',
      graphHref: npi
        ? `/graph?npi=${encodeURIComponent(npi)}`
        : `/graph?q=${encodeURIComponent(query)}`,
      npi,
      rank: result.rank,
      trustScore: result.trustScore ?? null,
      explanation: explanationByResultId.get(result.id)?.summary ?? null,
      sourceCoverage: result.sourceCoverage,
    };
  });
}

function buildGraphNeighborPreview(
  nodes: Array<{ id: string; label: string }>,
  edges: Array<{ id: string; source: string; target: string; type: string }>,
  focusNodeId: string | null,
) {
  if (!focusNodeId) {
    return [];
  }

  const labelById = new Map(nodes.map((node) => [node.id, node.label]));

  return edges
    .filter((edge) => edge.source === focusNodeId || edge.target === focusNodeId)
    .slice(0, 5)
    .map((edge) => {
      const neighborId = edge.source === focusNodeId ? edge.target : edge.source;
      return {
        id: edge.id,
        title: labelById.get(neighborId) ?? neighborId,
        detail: edge.type.replace(/_/g, ' '),
      };
    });
}

function parseStoredQueries(rawValue: string | null): VSavedQuery[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is VSavedQuery => {
        return (
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as VSavedQuery).id === 'string' &&
          typeof (entry as VSavedQuery).query === 'string' &&
          ((entry as VSavedQuery).mode === 'search' || (entry as VSavedQuery).mode === 'copilot') &&
          typeof (entry as VSavedQuery).createdAt === 'string'
        );
      })
      .slice(0, MAX_SAVED_QUERIES);
  } catch {
    return [];
  }
}

export default function VCommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<VCommandResultItem[]>([]);
  const [savedQueries, setSavedQueries] = useState<VSavedQuery[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copilotPreview, setCopilotPreview] = useState<CopilotPreviewState>({
    parsedQuery: null,
    explanations: [],
    graphInsights: [],
  });

  const deferredQuery = useDeferredValue(query);
  const input = resolveCommandInput(deferredQuery);

  useEffect(() => {
    const stored = parseStoredQueries(window.localStorage.getItem(STORAGE_KEY));
    setSavedQueries(stored);
  }, []);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveMessage(null), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !open &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleNavigation(event: KeyboardEvent) {
      const visibleResults = getVisibleResults();
      if (visibleResults.length === 0) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, visibleResults.length - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const selected = visibleResults[selectedIndex];
        if (!selected) {
          return;
        }

        executeSelection(selected);
      }
    }

    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [open, results, savedQueries, selectedIndex, input.mode, input.searchText, input.commandText]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [open, deferredQuery, results.length, savedQueries.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!input.normalized) {
      setLoading(false);
      setError(null);
      setResults([]);
      setCopilotPreview({
        parsedQuery: null,
        explanations: [],
        graphInsights: [],
      });
      return;
    }

    if (input.mode === 'command') {
      const commandResults = findMatchingCommands(input.commandText).map((definition) => (
        buildCommandResult(definition, input, null)
      ));

      setLoading(false);
      setError(null);
      setResults(commandResults);
      setCopilotPreview({
        parsedQuery: null,
        explanations: [],
        graphInsights: [],
      });
      return;
    }

    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);

      try {
        if (input.mode === 'search') {
          const params = new URLSearchParams({
            q: input.searchText,
            limit: String(MAX_RESULTS),
          });
          const response = await fetch(`/api/intelligence/providers?${params.toString()}`, {
            signal: controller.signal,
          });
          const payload = await response.json().catch(() => ({})) as ProvidersResponse & { error?: string };

          if (!response.ok) {
            throw new Error(payload.error ?? 'Provider search failed.');
          }

          setResults((payload.providers ?? []).map(buildProviderResult));
          setCopilotPreview({
            parsedQuery: null,
            explanations: [],
            graphInsights: [],
          });
          return;
        }

        const response = await fetch('/api/copilot/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: input.normalized,
            limit: MAX_RESULTS,
          }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({})) as CopilotRuntimeResponse & { error?: string; message?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? payload.message ?? 'Copilot source unavailable.');
        }

        const copilotResults = buildCopilotResults(input.normalized, payload.results ?? [], payload.explanations ?? []);
        if (payload.status === 'limited' && copilotResults.length === 0) {
          const limitedNpi = extractNpiFromValue(input.normalized);
          setResults([
            {
              id: 'copilot:limited',
              kind: 'copilot',
              title: payload.title ?? 'Copilot needs more investigation context',
              subtitle: 'Limited response',
              summary: payload.message ?? 'Copilot could not safely complete this request with the current live sources.',
              badges: ['limited'],
              href: limitedNpi ? `/providers/${encodeURIComponent(limitedNpi)}` : null,
              graphHref: limitedNpi ? `/graph?npi=${encodeURIComponent(limitedNpi)}` : null,
              npi: limitedNpi,
              sourceCoverage: [],
            },
          ]);
        } else {
          setResults(copilotResults);
        }
        setCopilotPreview({
          parsedQuery: payload.parsedQuery ?? null,
          explanations: payload.explanations ?? [],
          graphInsights: payload.graphInsights ?? [],
        });
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setCopilotPreview({
          parsedQuery: null,
          explanations: [],
          graphInsights: [],
        });
        setError(requestError instanceof Error ? requestError.message : 'Command query failed.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => controller.abort();
  }, [open, input.normalized, input.mode, input.searchText, input.commandText]);

  function getVisibleResults() {
    if (input.normalized) {
      return results;
    }

    return [
      ...savedQueries.map(buildSavedQueryResult),
      ...findMatchingCommands('').map((definition) => buildCommandResult(definition, input, null)),
    ];
  }

  const visibleResults = getVisibleResults();
  const selectedResult = visibleResults[selectedIndex] ?? null;
  const previewNpi = selectedResult?.npi ?? extractNpiFromValue(input.normalized);
  const providerDetail = useProvider(previewNpi, {
    paused: !open || !previewNpi,
  });
  const findingsPreview = useFindings({
    provider: previewNpi,
    limit: 4,
    paused: !open || !previewNpi,
  });
  const graphPreview = useGraph({
    npi: previewNpi,
    limit: 56,
    paused: !open || !previewNpi,
  });

  const graphNeighbors = buildGraphNeighborPreview(
    graphPreview.data?.nodes ?? [],
    graphPreview.data?.edges ?? [],
    graphPreview.data?.focusNodeId ?? previewNpi,
  );

  function persistSavedQueries(nextQueries: VSavedQuery[]) {
    setSavedQueries(nextQueries);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextQueries));
  }

  function saveCurrentQuery() {
    if (!input.normalized || input.mode === 'command') {
      return;
    }

    const nextEntry: VSavedQuery = {
      id: `${input.mode}:${input.normalized.toLowerCase()}`,
      query: input.normalized,
      mode: input.mode,
      createdAt: new Date().toISOString(),
    };

    const nextQueries = [
      nextEntry,
      ...savedQueries.filter((entry) => entry.id !== nextEntry.id),
    ].slice(0, MAX_SAVED_QUERIES);

    persistSavedQueries(nextQueries);
    setSaveMessage('Saved');
  }

  function executeSelection(result: VCommandResultItem) {
    if (result.kind === 'saved-query' && result.query) {
      setQuery(result.query);
      return;
    }

    if (result.href) {
      openHref(router, result.href);
      setOpen(false);
    }
  }

  const parsePreview = buildParsePreview(
    selectedResult?.kind === 'saved-query' && selectedResult.query
      ? resolveCommandInput(selectedResult.query).parseSummary
      : input.parseSummary,
  );
  const selectedCopilotExplanation = selectedResult?.kind === 'copilot'
    ? copilotPreview.explanations.find((explanation) => explanation.resultId === selectedResult.id.replace(/^copilot:/, '')) ?? null
    : null;
  const selectedGraphInsights = selectedResult?.kind === 'copilot'
    ? copilotPreview.graphInsights.filter((insight) => !insight.resultId || insight.resultId === selectedResult.id.replace(/^copilot:/, ''))
    : [];

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="v-command-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[9998] bg-slate-950/78 backdrop-blur-md"
            onClick={() => setOpen(false)}
          />

          <motion.div
            key="v-command-panel"
            initial={{ opacity: 0, scale: 0.98, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -14 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed left-1/2 top-[8vh] z-[9999] w-[min(94vw,78rem)] -translate-x-1/2 overflow-hidden rounded-[28px] border border-border bg-[rgba(8,12,20,0.94)] shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
          >
            <div className="border-b border-border bg-[linear-gradient(180deg,rgba(17,24,39,0.95),rgba(11,15,23,0.82))] px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  <Command className="h-3.5 w-3.5" />
                  VCommandBar
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-slate-300">
                  {input.mode === 'command' ? <TerminalSquare className="h-3.5 w-3.5" /> : null}
                  {input.mode === 'search' ? <Search className="h-3.5 w-3.5" /> : null}
                  {input.mode === 'copilot' ? <Bot className="h-3.5 w-3.5" /> : null}
                  {input.mode}
                </div>
                {saveMessage ? (
                  <span className="text-xs font-medium text-emerald-200">{saveMessage}</span>
                ) : null}
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-[22px] border border-border bg-black/20 px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setError(null);
                  }}
                  placeholder='Search providers, ask Copilot, or run >commands'
                  className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-slate-500"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={saveCurrentQuery}
                  disabled={!input.normalized || input.mode === 'command'}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Save query
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-border p-2 text-slate-400 transition hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid min-h-[34rem] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="border-b border-border lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Results</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {input.normalized
                        ? `${visibleResults.length} ranked result${visibleResults.length === 1 ? '' : 's'}`
                        : savedQueries.length > 0
                          ? 'Saved queries and system commands'
                          : 'System commands'}
                    </p>
                  </div>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : null}
                </div>

                <div className="max-h-[28rem] overflow-y-auto">
                  {error ? (
                    <div className="px-5 py-6 text-sm text-rose-200">{error}</div>
                  ) : null}

                  {!loading && !error && visibleResults.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-slate-400">
                      No matching results. Try a provider name, an NPI, or a broader Copilot query.
                    </div>
                  ) : null}

                  {visibleResults.map((result, index) => {
                    const selected = index === selectedIndex;
                    const Icon = result.kind === 'command'
                      ? TerminalSquare
                      : result.kind === 'copilot'
                        ? Bot
                        : result.kind === 'saved-query'
                          ? Bookmark
                          : Search;

                    return (
                      <button
                        key={result.id}
                        type="button"
                        onMouseEnter={() => setSelectedIndex(index)}
                        onClick={() => executeSelection(result)}
                        className={`flex w-full items-start gap-3 border-b border-white/5 px-5 py-4 text-left transition ${
                          selected ? 'bg-cyan-400/10' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className={`mt-0.5 rounded-2xl border p-2 ${
                          selected ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-border bg-muted text-slate-400'
                        }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`truncate text-sm font-semibold ${selected ? 'text-white' : 'text-slate-100'}`}>
                                {result.title}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-400">{result.subtitle}</p>
                            </div>
                            {typeof result.trustScore === 'number' ? (
                              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                                {Math.round(result.trustScore)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{result.summary}</p>
                          {result.badges.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {result.badges.map((badge) => (
                                <span
                                  key={`${result.id}:${badge}`}
                                  className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-slate-300"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <ChevronRight className={`mt-1 h-4 w-4 shrink-0 ${selected ? 'text-cyan-100' : 'text-slate-500'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="max-h-[34rem] overflow-y-auto px-5 py-5">
                {selectedResult ? (
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-border bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Preview</p>
                          <h2 className="mt-2 text-xl font-semibold text-foreground">{selectedResult.title}</h2>
                          <p className="mt-1 text-sm text-slate-400">{selectedResult.subtitle}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedResult.href ? (
                            <button
                              type="button"
                              onClick={() => executeSelection(selectedResult)}
                              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-muted"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open entity
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {parsePreview ? (
                        <div className="mt-4 rounded-[20px] border border-border bg-slate-950/40 p-4">
                          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            <Sparkles className="h-3.5 w-3.5" />
                            Parsed query
                          </div>
                          <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-slate-200">
{JSON.stringify(parsePreview, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </div>

                    {providerDetail.data ? (
                      <div className="space-y-4">
                        <ProviderCard
                          credentialHealth={providerDetail.data.profile.status}
                          name={providerDetail.data.provider.fullName}
                          specialties={providerDetail.data.provider.specialties.slice(0, 3)}
                          summary={`${providerDetail.data.provider.providerType ?? 'Provider'} • NPI ${providerDetail.data.provider.npi}`}
                          trustScore={providerDetail.data.provider.trustScore}
                          meta={(
                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-2">
                                <RiskScoreBadge score={providerDetail.data.provider.riskScore} />
                                <span className="rounded-full border border-[var(--vt-border)] px-3 py-1 text-xs text-[var(--vt-text-2)]">
                                  {providerDetail.data.provider.findingCount} findings
                                </span>
                                <span className="rounded-full border border-[var(--vt-border)] px-3 py-1 text-xs text-[var(--vt-text-2)]">
                                  {providerDetail.data.provider.activeStorylineCount} storylines
                                </span>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Trust</p>
                                  <p className="mt-1 text-2xl font-semibold text-[var(--vt-text-1)]">
                                    {providerDetail.data.provider.trustScore}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Active credentials</p>
                                  <p className="mt-1 text-2xl font-semibold text-[var(--vt-text-1)]">
                                    {providerDetail.data.provider.activeCredentialCount}/{providerDetail.data.provider.totalCredentialCount}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        />

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <div className="rounded-[24px] border border-border bg-white/[0.03] p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Latest findings</p>
                            <div className="mt-4 space-y-3">
                              {(findingsPreview.data?.findings ?? []).slice(0, 4).map((finding) => (
                                <div key={finding.id} className="rounded-2xl border border-border bg-black/20 px-3 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-foreground">{finding.title}</p>
                                    <span className="rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-300">
                                      {finding.severity}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-slate-300">{finding.summary}</p>
                                </div>
                              ))}
                              {!findingsPreview.data?.findings?.length && !findingsPreview.loading ? (
                                <p className="text-sm text-slate-400">No linked findings returned for this provider.</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="rounded-[24px] border border-border bg-white/[0.03] p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Relationship preview</p>
                            <div className="mt-4 grid gap-3">
                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-2xl border border-border bg-black/20 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Nodes</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{graphPreview.data?.stats.totalNodes ?? 0}</p>
                                </div>
                                <div className="rounded-2xl border border-border bg-black/20 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Edges</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{graphPreview.data?.stats.totalEdges ?? 0}</p>
                                </div>
                                <div className="rounded-2xl border border-border bg-black/20 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">AI links</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{graphPreview.data?.stats.aiSuggestedLinks ?? 0}</p>
                                </div>
                              </div>
                              <div className="space-y-3">
                                {graphNeighbors.map((neighbor) => (
                                  <div key={neighbor.id} className="rounded-2xl border border-border bg-black/20 px-3 py-3">
                                    <p className="text-sm font-semibold text-foreground">{neighbor.title}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{neighbor.detail}</p>
                                  </div>
                                ))}
                                {!graphNeighbors.length && !graphPreview.loading ? (
                                  <p className="text-sm text-slate-400">Relationship neighbors are not available for this scope yet.</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {!providerDetail.data && selectedResult.kind === 'copilot' ? (
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="rounded-[24px] border border-border bg-white/[0.03] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Copilot explanation</p>
                          <p className="mt-4 text-sm leading-7 text-slate-300">
                            {selectedCopilotExplanation?.summary ?? selectedResult.explanation ?? selectedResult.summary}
                          </p>
                          {selectedCopilotExplanation?.because?.length ? (
                            <div className="mt-4 space-y-2">
                              {selectedCopilotExplanation.because.slice(0, 4).map((reason) => (
                                <div key={reason} className="rounded-2xl border border-border bg-black/20 px-3 py-3 text-sm text-slate-200">
                                  {reason}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {selectedResult.sourceCoverage?.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {selectedResult.sourceCoverage.map((source) => (
                                <span key={`${selectedResult.id}:${source}`} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-slate-300">
                                  {source}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[24px] border border-border bg-white/[0.03] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Related insights</p>
                          <div className="mt-4 space-y-3">
                            {selectedGraphInsights.slice(0, 4).map((insight, index) => (
                              <div key={`${insight.summary}-${index}`} className="rounded-2xl border border-border bg-black/20 px-3 py-3">
                                <p className="text-sm font-semibold text-foreground">{insight.summary}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                                  depth {insight.depth} • {insight.type.replace(/_/g, ' ')}
                                </p>
                                {insight.path.length > 0 ? (
                                  <p className="mt-2 text-sm text-slate-300">{insight.path.join(' -> ')}</p>
                                ) : null}
                              </div>
                            ))}
                            {!selectedGraphInsights.length ? (
                              <p className="text-sm text-slate-400">
                                Copilot did not return additional relationship insights for this result.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {selectedResult.kind === 'command' ? (
                      <div className="rounded-[24px] border border-border bg-white/[0.03] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Command behavior</p>
                        <div className="mt-4 grid gap-3">
                          <div className="rounded-2xl border border-border bg-black/20 px-3 py-3">
                            <p className="text-sm font-semibold text-foreground">{selectedResult.title}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-300">{selectedResult.summary}</p>
                          </div>
                          <div className="rounded-2xl border border-border bg-black/20 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Open entity</p>
                            <p className="mt-2 font-mono text-sm text-slate-200">{selectedResult.href ?? 'Unavailable'}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {selectedResult.kind === 'saved-query' && selectedResult.query ? (
                      <div className="rounded-[24px] border border-border bg-white/[0.03] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Saved query</p>
                        <p className="mt-4 text-sm leading-7 text-slate-300">
                          Press Enter to restore this query into the command bar.
                        </p>
                      </div>
                    ) : null}

                    {loading && !visibleResults.length ? (
                      <div className="rounded-[24px] border border-border bg-white/[0.03] px-4 py-6 text-sm text-slate-300">
                        Loading command results...
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-border bg-white/[0.03] p-6 text-sm text-slate-400">
                    Type a provider name, an NPI, a natural-language intelligence query, or an intelligence command.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-black/20 px-5 py-3 text-[11px] text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span>⌘K open</span>
                <span>/ quick launch</span>
                <span>↑↓ navigate</span>
                <span>Enter open entity</span>
                <span>Esc close</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FileOutput className="h-3.5 w-3.5" />
                <span>Operational command surface for provider intelligence</span>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
