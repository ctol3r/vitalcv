'use client';

import { BriefcaseMedical, Building2, ShieldCheck } from 'lucide-react';
import type { IntelligenceProvider } from '@/lib/intelligence/contracts';
import { ScoreBar, SurfaceState, ToneBadge } from './shared';

interface ProviderCardProps {
  provider?: IntelligenceProvider | null;
  loading?: boolean;
  error?: string | null;
  onSelect?: (provider: IntelligenceProvider) => void;
  actionLabel?: string;
  onRetry?: () => void;
}

export function ProviderCard({
  provider,
  loading,
  error,
  onSelect,
  actionLabel = 'Open profile',
  onRetry,
}: ProviderCardProps) {
  return (
    <SurfaceState
      loading={loading}
      error={error}
      empty={!provider}
      emptyTitle="No provider selected"
      emptyCopy="Pick a provider from the search results or watchlist."
      onRetry={onRetry}
    >
      {provider ? (
        <article className="rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(7,12,22,0.94))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">
                Provider Card
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">{provider.name}</h3>
              <p className="mt-1 text-sm text-white/65">{provider.summary}</p>
            </div>
            <ToneBadge tone={provider.risk} label={`${provider.trustScore} trust`} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Credential health</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-200" />
                <span>{provider.credentialHealth}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Primary issuer</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Building2 className="h-4 w-4 text-blue-200" />
                <span>{provider.primaryIssuer ?? 'Not mapped'}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Credentials</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <BriefcaseMedical className="h-4 w-4 text-fuchsia-200" />
                <span>{provider.activeCredentials}/{provider.credentialCount} active</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Trust score</span>
                <span>{provider.trustScore}</span>
              </div>
              <div className="mt-2">
                <ScoreBar value={provider.trustScore} tone={provider.risk} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {provider.tags.map((tag) => (
                  <span
                    key={`${provider.id}-${tag}`}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/75"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(provider)}
                className="inline-flex items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/[0.12] px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.18]"
              >
                {actionLabel}
              </button>
            ) : null}
          </div>
        </article>
      ) : null}
    </SurfaceState>
  );
}
