'use client';

import { HeartPulse, Network, Shield } from 'lucide-react';
import type { HealthStatusCardData } from '@/lib/intelligence/contracts';
import { SurfaceState, ToneBadge } from './shared';

interface HealthStatusCardProps {
  card?: HealthStatusCardData | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const ICON_BY_ID = {
  pipeline: Shield,
  graph: Network,
  verification: HeartPulse,
  connectivity: Network,
} as const;

export function HealthStatusCard({
  card,
  loading,
  error,
  onRetry,
}: HealthStatusCardProps) {
  const Icon = card ? ICON_BY_ID[card.id as keyof typeof ICON_BY_ID] ?? Shield : Shield;

  return (
    <SurfaceState
      loading={loading}
      error={error}
      empty={!card}
      emptyTitle="No health card available"
      emptyCopy="System health cards populate after the first successful poll."
      onRetry={onRetry}
    >
      {card ? (
        <article className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                Health Status Card
              </p>
              <h3 className="mt-2 text-base font-semibold text-[var(--vt-text-1)]">{card.label}</h3>
            </div>
            <ToneBadge tone={card.tone} label={card.summary} />
          </div>
          <div className="mt-4 flex items-start gap-3">
            <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/50 p-3">
              <Icon className="h-5 w-5 text-cyan-100" />
            </div>
            <p className="text-sm leading-6 text-[var(--vt-text-1)]/65">{card.detail}</p>
          </div>
        </article>
      ) : null}
    </SurfaceState>
  );
}
