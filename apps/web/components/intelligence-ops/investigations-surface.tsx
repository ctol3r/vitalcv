'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OperationsShell } from './shell';
import { OpsBadge, OpsCard, SurfaceBanner } from './primitives';

export function InvestigationsSurface() {
  const searchParams = useSearchParams();
  const seededNpi = searchParams.get('npi') ?? '';
  const [npi, setNpi] = useState(seededNpi);
  const [activeNpi, setActiveNpi] = useState(seededNpi);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    answer?: string;
    confidence?: number;
    sources?: string[];
  } | null>(null);

  useEffect(() => {
    setNpi(seededNpi);
    setActiveNpi(seededNpi);
  }, [seededNpi]);

  async function investigate(nextNpi: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/copilot/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `investigate ${nextNpi}`,
          sessionId: `investigation_${nextNpi}_${Date.now()}`,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        answer?: string;
        confidence?: number;
        sources?: string[];
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `Investigation failed with ${response.status}`);
      }

      setActiveNpi(nextNpi);
      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Investigation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <OperationsShell
      activeHref="/investigations"
      title="Investigations"
      description="Run a focused operator investigation against a provider NPI, then pivot back into findings, storylines, actions, and the provider detail profile."
      breadcrumbs={[{ label: 'Investigations' }]}
      banner={activeNpi ? (
        <SurfaceBanner tone="info">
          Deep-linking is active for NPI {activeNpi}. This surface is ready to receive context from findings, storylines, actions, and provider detail routes.
        </SurfaceBanner>
      ) : null}
    >
      <OpsCard className="space-y-4">
        <form
          className="flex flex-col gap-3 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (/^\d{10}$/.test(npi.trim())) {
              void investigate(npi.trim());
            }
          }}
        >
          <input
            value={npi}
            onChange={(event) => setNpi(event.target.value)}
            placeholder="Enter provider NPI"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={loading || !/^\d{10}$/.test(npi.trim())}
            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Investigating…' : 'Investigate'}
          </button>
        </form>
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </OpsCard>

      {result?.answer ? (
        <OpsCard className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge label={`NPI ${activeNpi}`} />
            {result.confidence ? <OpsBadge label={`${Math.round(result.confidence * 100)}% confidence`} /> : null}
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-slate-300">
            {result.answer}
          </pre>
          {result.sources && result.sources.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {result.sources.map((source) => (
                <span key={source} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {source}
                </span>
              ))}
            </div>
          ) : null}
        </OpsCard>
      ) : null}
    </OperationsShell>
  );
}
