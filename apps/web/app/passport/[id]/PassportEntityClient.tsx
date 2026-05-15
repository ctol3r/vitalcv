'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PassportWallet from '@/components/passport/PassportWallet';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { fetchPassportEntity } from '@/lib/api';
import type { PassportData } from '@/lib/trust/passport-contract';
import { KnowledgeInboxPanel } from '@/components/knowledge-inbox/KnowledgeInboxPanel';
import type { KnowledgeInboxItem } from '@/lib/knowledge-inbox/types';
import { LaneHealthMount } from '@/components/source-health/LaneHealthMount';

// ── Replay Continuity ────────────────────────────────────────────────────────

/**
 * Deterministically derives a short run_id from NPI + checkedAt timestamp.
 * Survives refresh — same inputs → same id.
 */
function deriveRunId(npi: string, checkedAt: string): string {
  // Simple deterministic hash: djb2-style on the combined string
  const input = `${npi}:${checkedAt}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0').slice(0, 8);
}

/**
 * Formats a unix-ms or ISO timestamp as "YYYY-MM-DD HH:mm:ss UTC".
 */
function formatUtcTimestamp(ts: string | number | null | undefined): string {
  if (ts == null) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
  );
}

/**
 * Returns true if the timestamp is older than 24 hours.
 */
function isStale(ts: string | null | undefined): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  return !isNaN(d.getTime()) && Date.now() - d.getTime() > 24 * 60 * 60 * 1000;
}

function postureTone(status?: string): string {
  switch (status) {
    case 'verified':
      return 'border-border bg-background text-[var(--vt-status-resolved)]';
    case 'degraded':
      return 'border-border bg-background text-[var(--vt-risk-medium)]';
    case 'pending':
      return 'border-blue-100 bg-blue-50/40 text-blue-700';   // intentional / in-progress
    case 'unavailable':
      return 'border-border bg-background text-muted-foreground';  // gray / absent
    case 'unverifiable':
      return 'border-border bg-background text-muted-foreground';
    default:
      return 'border-border bg-background text-muted-foreground';
  }
}

function runtimeStatusLabel(status: string): string {
  switch (status) {
    case 'verified':      return 'Confirmed';
    case 'degraded':      return 'Partial';
    case 'pending':       return 'Checking';
    case 'unavailable':   return 'Not checked';
    case 'unverifiable':  return 'Not available';
    default:              return status;
  }
}

function humanizeLineageKey(key: string | null): string | null {
  if (!key) return null;
  const [source] = key.split(':');
  const labels: Record<string, string> = {
    NPPES_API: 'Identity',
    OIG_LEIE: 'Exclusion check',
    PECOS_PUBLIC: 'Medicare enrollment',
    nppes_identity: 'Identity',
    oig_exclusions: 'Exclusion check',
    state_license: 'State license',
    employment_history: 'Employment',
    board_cert: 'Board certification',
    pecos_enrollment: 'Medicare enrollment',
  };
  return labels[source] ?? key;
}

interface ReplayHeaderProps {
  passport: PassportData;
}

function ReplayHeader({ passport }: ReplayHeaderProps) {
  const npi = passport.npi ?? passport.identity.npi ?? passport.entityId;
  const checkedAt = passport.lastCheckedAt ?? passport.checkedAt ?? null;
  const runId = checkedAt ? deriveRunId(npi, checkedAt) : null;
  const lineageKey = passport.lineageKey ?? null;

  // Source count + latest check time
  const laneChecks = (passport.sourceCoverage?.checks ?? []).filter(
    (c) => typeof c.checkedAt === 'string' && c.checkedAt,
  );
  const sourceCount = laneChecks.length;
  const latestLaneCheck = laneChecks
    .map((c) => new Date(c.checkedAt as string).getTime())
    .sort((a, b) => b - a)[0];
  const latestLaneUtc = latestLaneCheck
    ? new Date(latestLaneCheck).toISOString().slice(11, 16) + ' UTC'
    : null;

  const stale = isStale(checkedAt);

  // Build compact strip parts
  const parts: string[] = [];
  if (runId) parts.push(`ref:${runId}`);
  if (checkedAt) parts.push(formatUtcTimestamp(checkedAt));
  if (lineageKey) {
    const label = humanizeLineageKey(lineageKey);
    if (label) parts.push(label);
  }

  return (
    <div
      className="mx-auto w-full max-w-3xl px-4"
      data-testid="replay-header"
    >
      <p className="text-[11px] text-muted-foreground/50 mb-1">
        Verification record
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] text-muted-foreground/60">
          {parts.join(' · ') || '—'}
        </span>
        {stale && (
          <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-[var(--vt-risk-medium)]">
            STALE
          </span>
        )}
        {sourceCount > 0 && (
          <span className="text-[11px] text-muted-foreground/50">
            {sourceCount} source{sourceCount !== 1 ? 's' : ''}
            {latestLaneUtc ? ` · ${latestLaneUtc}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

interface PassportEntityClientProps {
  entityId: string;
}

export default function PassportEntityClient({ entityId }: PassportEntityClientProps) {
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [degradedMode, setDegradedMode] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setDegradedMode(false);
      const result = await fetchPassportEntity(entityId);
      if (cancelled) return;

      if (result.ok && result.body) {
        // Canonical App Router path now returns either hydrated or degraded
        // passport truth directly, without relying on a backend proxy.
        setPassport(result.body);
        setDegradedMode(Boolean((result.body as PassportData & { _degraded?: boolean })._degraded));
      } else {
        setPassport(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId, retryCount]);

  if (loading) {
    return <PassportWallet loading />;
  }

  if (!passport) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <TrustStateCard
            eyebrow="Passport"
            title="Passport not available"
            description="This passport hasn't been generated yet. Run a readiness check to open the source-backed snapshot."
            centered
            actions={(
              <div className="flex w-full flex-col gap-2">
                <Button asChild variant="default" className="h-11 w-full rounded-full">
                  <Link href="/passport">Check readiness</Link>
                </Button>
                <Button asChild variant="outline" className="h-11 w-full rounded-full border-border bg-card text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground">
                  <Link href="/">Return home</Link>
                </Button>
              </div>
            )}
          />
        </div>
      </main>
    );
  }

  // GOD-3: Inbox is mounted here as a UI surface. Real items arrive
  // once a backend endpoint provides them; until then the panel
  // renders its empty state. We never synthesize fake items and we
  // never auto-mark anything verified. No external model calls happen
  // in classification — see lib/knowledge-inbox/classifyInboxItem.ts.
  const inboxItems: KnowledgeInboxItem[] = [];

  return (
    <div className="flex flex-col gap-10 bg-background pb-16">
      {degradedMode && (
        <div className="mx-auto w-full max-w-3xl px-4">
          <div
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-foreground sm:flex-row sm:items-center"
            role="status"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">Source-backed signals loading</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Primary identity is recognized. Readiness is still moving into view.
              </p>
            </div>
            <button
              onClick={() => {
                setDegradedMode(false);
                setLoading(true);
                setRetryCount(c => c + 1);
              }}
              className="self-start rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:self-center"
            >
              Check again
            </button>
          </div>
        </div>
      )}
      <PassportWallet passport={passport} />
      <div className="mx-auto w-full max-w-3xl space-y-10 px-4">
        <section
          aria-label="Source health"
          className="border-t border-border/40 pt-6"
          data-testid="passport-lane-health-mount"
        >
          <LaneHealthMount heading="Source health" />
        </section>
        <ReplayHeader passport={passport} />
        {inboxItems.length > 0 && (
          <section
            className="rounded-2xl border border-border bg-card p-4 shadow-none sm:p-5"
            aria-label="Knowledge Inbox"
            data-testid="passport-knowledge-inbox-mount"
          >
            <header className="mb-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Captured evidence
              </p>
              <h3 className="text-base font-semibold text-foreground">
                Pending verification
              </h3>
              <p className="text-xs text-muted-foreground/80">
                Items here are staged, not yet source-verified.
              </p>
            </header>
            <KnowledgeInboxPanel items={inboxItems} />
          </section>
        )}
      </div>
    </div>
  );
}
