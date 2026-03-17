'use client';

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, Network, Fingerprint, ShieldAlert, ArrowRight } from 'lucide-react';

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    let index = 0;
    setDisplayed('');
    const intervalId = setInterval(() => {
      setDisplayed(text.substring(0, index + 1));
      index++;
      if (index >= text.length) clearInterval(intervalId);
    }, 8);
    return () => clearInterval(intervalId);
  }, [text]);

  return <span>{displayed}</span>;
}
import type { IntelligenceProvider } from '@/lib/intelligence/contracts';
import { SectionFrame, SurfaceState } from './shared';
import { DecisionCard } from '@/components/decision/DecisionCard';

interface CopilotDecision {
  id: string;
  action: string;
  entity: string;
  priority: "urgent" | "high" | "medium" | "low";
  confidence: number;
  rationale: string;
  signalCount: number;
  timing: string;
}

interface CopilotResult {
  id: string;
  title: string;
  summary: string;
  trustScore?: number;
  sourceCoverage?: string[];
  decisions?: CopilotDecision[];
}

interface CopilotInsight {
  summary: string;
}

interface CopilotSeed {
  query: string;
  token: number;
}

interface CopilotPanelProps {
  provider: IntelligenceProvider | null;
  seed?: CopilotSeed | null;
}

export function CopilotPanel({ provider, seed = null }: CopilotPanelProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CopilotResult[]>([]);
  const [insights, setInsights] = useState<CopilotInsight[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!provider || seed?.query) {
      return;
    }

    startTransition(() => {
      setQuery(`Summarize the trust posture for ${provider.name} (${provider.npi}).`);
    });
  }, [provider, seed?.query]);

  const suggestions = provider
    ? [
      `Summarize the trust posture for ${provider.name} (${provider.npi}).`,
      `What findings matter most for ${provider.name}?`,
      `What follow-up action should operations run next for ${provider.name}?`,
    ]
    : [
      'Summarize the current trust network posture.',
      'Which providers are most ready for launch review?',
      'What investigations need attention first?',
    ];

  const runCopilot = useCallback(async (input = query) => {
    const trimmed = input.trim();
    if (trimmed.length < 3) {
      setError('Copilot queries must be at least 3 characters.');
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/copilot/query', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmed,
          limit: 4,
          providerId: provider?.npi,
        }),
      });

      const payload = await response.json().catch(() => ({})) as {
        status?: 'ok' | 'limited';
        title?: string;
        message?: string;
        suggestions?: string[];
        results?: CopilotResult[];
        graphInsights?: CopilotInsight[];
      };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Copilot source unavailable.');
      }

      if (payload.status === 'limited' && (payload.results?.length ?? 0) === 0) {
        setResults([
          {
            id: 'copilot-limited',
            title: payload.title ?? 'Copilot needs more investigation context',
            summary: payload.message ?? 'Copilot could not safely complete this request with the current live sources.',
            sourceCoverage: payload.suggestions ?? [],
          },
        ]);
      } else {
        setResults(payload.results ?? []);
      }
      setInsights(payload.graphInsights ?? []);
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }
      setError(requestError instanceof Error ? requestError.message : 'Copilot source unavailable.');
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [provider?.npi, query]);

  useEffect(() => {
    if (!seed?.query) {
      return;
    }

    setQuery(seed.query);
    void runCopilot(seed.query);
  }, [runCopilot, seed]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const showLoadingSkeleton = loading && results.length === 0 && insights.length === 0;

  return (
    <SectionFrame
      eyebrow="Copilot"
      title={provider ? `Ask about ${provider.name.split(' ')[0]}` : 'Ask Copilot'}
      detail={provider
        ? `Context-scoped to ${provider.name} (NPI ${provider.npi}). Ask about trust posture, findings, or next actions.`
        : 'Ask the trust engine for synthesized explanations without leaving the current scope.'}
      action={<Bot className="h-4 w-4 text-fuchsia-300" />}
    >
      <div className="grid gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 transition focus-within:border-fuchsia-300/30">
          <Sparkles className="h-4 w-4 shrink-0 text-fuchsia-300/60" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void runCopilot();
              }
            }}
            className="flex-1 bg-transparent py-1 text-sm text-[var(--vt-text-1)] outline-none placeholder:text-[var(--vt-text-3)]"
            placeholder="Ask about trust posture, findings, or next actions…"
          />
          <button
            type="button"
            onClick={() => void runCopilot()}
            disabled={loading || query.trim().length < 3}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-200 transition hover:bg-fuchsia-300/20 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">
          <span>{provider ? 'Scoped to current provider' : 'Global operator scope'}</span>
          <span className={loading ? 'text-fuchsia-200/80' : ''}>
            {loading ? 'Refreshing response' : 'Ready'}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          {suggestions.slice(0, 3).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuery(suggestion);
                setError(null);
                void runCopilot(suggestion);
              }}
              className="truncate rounded-xl border border-transparent px-3 py-1.5 text-left text-xs text-[var(--vt-text-3)] transition hover:border-[var(--vt-border)] hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-2)]"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <SurfaceState
          loading={showLoadingSkeleton}
          error={error}
          empty={!loading && results.length === 0 && insights.length === 0}
          emptyTitle="Copilot is ready"
          emptyCopy="Run a query to get a synthesized trust summary, evidence coverage, and graph insights."
        >
          <div className="grid gap-3">
            {results.map((result) => (
              <article key={result.id} className="flex flex-col gap-4 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-medium text-[var(--vt-text-1)]">{result.title}</h3>
                      {typeof result.trustScore === 'number' ? (
                        <span className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          {Math.round(result.trustScore)}% Confidence
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm leading-relaxed text-[var(--vt-text-2)]">
                      <TypewriterText text={result.summary} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-[var(--vt-border)] pt-3">
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {result.sourceCoverage?.map((source) => (
                      <span
                        key={`${result.id}-${source}`}
                        className="rounded border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2 py-0.5 text-[10px] text-[var(--vt-text-3)]"
                      >
                        {source}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button className="flex items-center gap-1.5 rounded-md bg-[var(--vt-surface-2)] border border-[var(--vt-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--vt-text-2)] hover:text-[var(--vt-text-1)] hover:bg-[var(--vt-surface-3)] transition-colors">
                      <Bot className="h-3 w-3" />
                      Investigate
                    </button>
                    <button className="flex items-center gap-1.5 rounded-md bg-[var(--vt-surface-2)] border border-[var(--vt-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--vt-text-2)] hover:text-[var(--vt-text-1)] hover:bg-[var(--vt-surface-3)] transition-colors">
                      <Network className="h-3 w-3" />
                      Open Graph
                    </button>
                  </div>
                </div>

                {result.decisions && result.decisions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-3)] mt-2">Recommended Actions</h4>
                    {result.decisions.map(decision => (
                      <DecisionCard
                        key={decision.id}
                        id={decision.id}
                        action={decision.action}
                        entity={decision.entity}
                        priority={decision.priority}
                        confidence={decision.confidence}
                        rationale={decision.rationale}
                        signalCount={decision.signalCount}
                        timing={decision.timing}
                      />
                    ))}
                  </div>
                )}
              </article>
            ))}

            {insights.map((insight, index) => (
              <div key={`${insight.summary}-${index}`} className="flex items-start gap-3 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3 text-sm text-[var(--vt-text-2)] relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--vt-text-3)] opacity-20" />
                <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-[var(--vt-text-3)]" />
                <p className="leading-relaxed"><TypewriterText text={insight.summary} /></p>
              </div>
            ))}
          </div>
        </SurfaceState>
      </div>
    </SectionFrame>
  );
}
