'use client';

import { startTransition, useEffect, useState } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import type { IntelligenceProvider } from '@/lib/intelligence/contracts';
import { SectionFrame, SurfaceState } from './shared';

interface CopilotResult {
  id: string;
  title: string;
  summary: string;
  trustScore?: number;
  sourceCoverage?: string[];
}

interface CopilotInsight {
  summary: string;
}

interface CopilotPanelProps {
  provider: IntelligenceProvider | null;
}

export function CopilotPanel({ provider }: CopilotPanelProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CopilotResult[]>([]);
  const [insights, setInsights] = useState<CopilotInsight[]>([]);

  useEffect(() => {
    if (!provider) {
      return;
    }

    startTransition(() => {
      setQuery(`Summarize the trust posture for ${provider.name} (${provider.npi}).`);
    });
  }, [provider]);

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

  async function runCopilot() {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setError('Copilot queries must be at least 3 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/copilot/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: trimmed, limit: 4 }),
      });

      const payload = await response.json().catch(() => ({})) as {
        message?: string;
        results?: CopilotResult[];
        graphInsights?: CopilotInsight[];
      };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Copilot query failed.');
      }

      setResults(payload.results ?? []);
      setInsights(payload.graphInsights ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Copilot query failed.');
    } finally {
      setLoading(false);
    }
  }

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
        {/* Input row */}
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 transition focus-within:border-fuchsia-300/30">
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
            className="flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/25"
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

        {/* Contextual suggestions */}
        <div className="flex flex-col gap-1">
          {suggestions.slice(0, 3).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuery(suggestion);
                setError(null);
              }}
              className="truncate rounded-xl border border-transparent px-3 py-1.5 text-left text-xs text-white/50 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-white/80"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <SurfaceState
          loading={loading}
          error={error}
          empty={!loading && results.length === 0 && insights.length === 0}
          emptyTitle="Copilot is ready"
          emptyCopy="Run a query to get a synthesized trust summary, evidence coverage, and graph insights."
        >
          <div className="grid gap-3">
            {results.map((result) => (
              <article key={result.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">{result.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-white/60">{result.summary}</p>
                  </div>
                  {typeof result.trustScore === 'number' ? (
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                      {Math.round(result.trustScore)}
                    </span>
                  ) : null}
                </div>
                {result.sourceCoverage?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.sourceCoverage.map((source) => (
                      <span
                        key={`${result.id}-${source}`}
                        className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/75"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}

            {insights.map((insight, index) => (
              <div key={`${insight.summary}-${index}`} className="rounded-2xl border border-cyan-200/10 bg-cyan-200/[0.08] p-4 text-sm text-cyan-50/90">
                {insight.summary}
              </div>
            ))}
          </div>
        </SurfaceState>
      </div>
    </SectionFrame>
  );
}
