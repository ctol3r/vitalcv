'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSystemHealth } from '@/hooks/useSystemHealth';

interface HealthCountPayload {
  providers?: unknown;
  findings?: unknown;
  storylines?: unknown;
}

interface HealthTickerSource {
  incidents?: Array<{
    title: string;
    summary: string;
  }>;
  cards?: Array<{
    id: string;
    summary?: string;
    detail?: string;
    label?: string;
  }>;
}

interface HealthTrafficCounts {
  providerCount: number | null;
  findingCount: number | null;
  storylineCount: number | null;
}

function parseCountValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string') {
    const normalized = Number.parseInt(value.replace(/,/g, ''), 10);
    return Number.isFinite(normalized) ? Math.max(0, normalized) : null;
  }

  return null;
}

function parseCountFromText(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d[\d,]*)/);
  if (!match) {
    return null;
  }

  const normalized = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(normalized) ? Math.max(0, normalized) : null;
}

function resolveHealthTrafficCounts(
  health: (HealthCountPayload & HealthTickerSource & { cards?: unknown }) | null,
): HealthTrafficCounts {
  const providerFromPayload = parseCountValue(health?.providers);
  const findingFromPayload = parseCountValue(health?.findings);
  const storylineFromPayload = parseCountValue(health?.storylines);
  const cards = Array.isArray(health?.cards) ? health.cards as Array<{ id: string; summary?: string; detail?: string }> : [];
  const providerCard = cards.find((card) => card.id === 'providers');
  const findingCard = cards.find((card) => card.id === 'findings');
  const storylineCard = cards.find((card) => card.id === 'storylines');

  return {
    providerCount: providerFromPayload
      ?? parseCountFromText(providerCard?.summary)
      ?? parseCountFromText(providerCard?.detail),
    findingCount: findingFromPayload
      ?? parseCountFromText(findingCard?.summary)
      ?? parseCountFromText(findingCard?.detail),
    storylineCount: storylineFromPayload
      ?? parseCountFromText(storylineCard?.summary)
      ?? parseCountFromText(storylineCard?.detail),
  };
}

function resolveHealthReadiness(counts: HealthTrafficCounts): {
  label: 'HEALTHY' | 'WARMING';
  tone: 'success' | 'warning';
} {
  const providerCount = counts.providerCount ?? 0;
  const findingCount = counts.findingCount ?? 0;
  const storylineCount = counts.storylineCount ?? 0;

  return (
    providerCount > 0 && findingCount > 0 && storylineCount > 0
      ? { label: 'HEALTHY', tone: 'success' }
      : { label: 'WARMING', tone: 'warning' }
  );
}

function buildHealthTickerMessages(
  health: HealthTickerSource | null,
  counts: HealthTrafficCounts,
): string[] {
  if (!health) {
    return ['Waiting for system health telemetry to return.'];
  }

  const providersLabel = counts.providerCount === null ? 'n/a' : `${counts.providerCount} providers`;
  const findingLabel = counts.findingCount === null ? 'n/a' : `${counts.findingCount} findings`;
  const storylineLabel = counts.storylineCount === null ? 'n/a' : `${counts.storylineCount} storylines`;

  const messages: string[] = [
    `Provider network: ${providersLabel}`,
    `Finding stream: ${findingLabel}`,
    `Storyline stream: ${storylineLabel}`,
  ];

  const cards = Array.isArray(health.cards) ? health.cards : [];
  const verificationCard = cards.find((card) => card.id === 'verification');
  if (verificationCard?.summary) {
    messages.push(verificationCard.summary);
  }

  if (Array.isArray(health.incidents) && health.incidents.length > 0) {
    const firstIncident = health.incidents[0];
    if (firstIncident?.title) {
      messages.push(firstIncident.title);
    }
  }

  if (messages.length === 0) {
    messages.push('System health telemetry is online and has no high-priority activity.');
  }

  return messages.slice(0, 6);
}

function formatLastUpdatedLabel(lastUpdated: string | null): string {
  if (!lastUpdated) {
    return 'No updates yet';
  }

  const timestamp = Date.parse(lastUpdated);
  if (!Number.isFinite(timestamp)) {
    return 'No updates yet';
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (ageSeconds < 60) {
    return `${ageSeconds} sec ago`;
  }

  const ageMinutes = Math.max(1, Math.floor(ageSeconds / 60));
  return `${ageMinutes} min ago`;
}

export function LiveSignalsIndicator() {
  const health = useSystemHealth(30_000);
  const [tickerIndex, setTickerIndex] = useState(0);
  const counts = resolveHealthTrafficCounts((health.data ?? null) as (HealthCountPayload & HealthTickerSource) | null);
  const readiness = resolveHealthReadiness(counts);
  const messages = useMemo(
    () => buildHealthTickerMessages(health.data ? { incidents: health.data.incidents, cards: health.data.cards } : null, counts),
    [health.data, counts],
  );
  const messageSignature = messages.join('|');
  const lastUpdatedLabel = formatLastUpdatedLabel(health.lastUpdated ?? health.data?.generatedAt ?? null);

  useEffect(() => {
    setTickerIndex(0);
  }, [messageSignature]);

  useEffect(() => {
    if (messages.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setTickerIndex((current) => (current + 1) % messages.length);
    }, 6500);

    return () => window.clearInterval(interval);
  }, [messages.length, messageSignature]);

  return (
    <div className="space-y-2 rounded-lg border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
        <span className="flex items-center gap-2 font-semibold text-[var(--vt-text-2)]">
          <span className={`h-2 w-2 rounded-full ${
            health.error && !health.data
              ? 'bg-red-500'
              : health.error
                ? 'bg-amber-400 animate-pulse'
                : 'bg-emerald-400 animate-pulse'
          }`} />
          {health.error && !health.data
            ? 'SIGNALS UNAVAILABLE'
            : 'LIVE SIGNALS ACTIVE'}
        </span>
        <span className={`rounded-full px-2 py-0.5 ${readiness.tone === 'success' ? 'text-emerald-300' : 'text-amber-300'}`}>
          {readiness.label}
        </span>
      </div>
      <p className="text-xs text-[var(--vt-text-2)]">{messages[tickerIndex % Math.max(1, messages.length)]}</p>
      <p className="text-[10px] text-[var(--vt-text-3)]">Last updated {lastUpdatedLabel}</p>
    </div>
  );
}
