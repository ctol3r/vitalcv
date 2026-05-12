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

interface ReplayHeaderProps {
  passport: PassportData;
}

function ReplayHeader({ passport }: ReplayHeaderProps) {
  const npi = passport.npi ?? passport.identity.npi ?? passport.entityId;
  const checkedAt = passport.lastCheckedAt ?? null;
  const runId = checkedAt ? deriveRunId(npi, checkedAt) : null;

  // Prior run_id — use trustContainer issuedAt as alternate epoch when available
  const priorCheckedAt = passport.trustContainer?.issuedAt ?? null;
  const priorRunId =
    priorCheckedAt && priorCheckedAt !== checkedAt
      ? deriveRunId(npi, priorCheckedAt)
      : null;

  // Per-lane check timestamps (chronologically ordered)
  const laneTimestamps: Array<{ sourceId: string; checkedAt: string }> = (
    passport.sourceCoverage?.checks ?? []
  )
    .filter((c) => typeof c.checkedAt === 'string' && c.checkedAt)
    .map((c) => ({ sourceId: c.sourceId, checkedAt: c.checkedAt as string }))
    .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());

  const stale = isStale(checkedAt);

  return (
    <div
      className="mx-auto max-w-[480px] sm:max-w-[640px] md:max-w-3xl lg:max-w-4xl px-4 w-full"
      data-testid="replay-header"
    >
      <div className="rounded-2xl border border-border bg-background/60 p-4 sm:p-5 space-y-3">
        {/* Eyebrow */}
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
          Replay continuity
        </p>

        {/* checked_at + STALE badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Checked at:</span>
          <span className="text-xs font-mono text-foreground/80">
            {checkedAt ? formatUtcTimestamp(checkedAt) : '—'}
          </span>
          {stale && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">
              STALE
            </span>
          )}
        </div>

        {/* run_id */}
        {runId && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Run ID:</span>
            <span className="text-xs font-mono text-foreground/90 bg-muted px-1.5 py-0.5 rounded">
              {runId}
            </span>
          </div>
        )}

        {/* Replay lineage chain */}
        {priorRunId && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">↳ replays run_id:</span>
            <span className="text-xs font-mono text-foreground/70 bg-muted px-1.5 py-0.5 rounded">
              {priorRunId}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              ({formatUtcTimestamp(priorCheckedAt)})
            </span>
          </div>
        )}

        {/* Per-lane check timestamps */}
        {laneTimestamps.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-[10px] text-muted-foreground/70 uppercase tracking-widest select-none">
              Lane chronology ({laneTimestamps.length})
            </summary>
            <ol className="mt-2 space-y-1 pl-2 border-l border-border">
              {laneTimestamps.map((lt) => (
                <li key={lt.sourceId} className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground/70 w-28 shrink-0 font-mono">
                    {lt.sourceId}
                  </span>
                  <span className="text-foreground/70 font-mono">
                    {formatUtcTimestamp(lt.checkedAt)}
                  </span>
                </li>
              ))}
            </ol>
          </details>
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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      const result = await fetchPassportEntity(entityId);
      if (cancelled) {
        return;
      }

      setPassport(result.ok ? result.body : null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  if (loading) {
    return <PassportWallet loading />;
  }

  if (!passport) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm animate-fade-in-up">
          <TrustStateCard
            eyebrow="Passport"
            title="Passport not available"
            description="This passport hasn't been generated yet. Run a readiness check first to create a source-backed passport."
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
    <div className="flex flex-col gap-8 pb-16">
      <PassportWallet passport={passport} />
      <ReplayHeader passport={passport} />
      <div className="mx-auto max-w-[480px] sm:max-w-[640px] md:max-w-3xl lg:max-w-4xl px-4 w-full space-y-8">
        <section
          aria-label="Source health"
          data-testid="passport-lane-health-mount"
        >
          <LaneHealthMount heading="Source health" />
        </section>
        <section
          className="rounded-2xl border border-border bg-background/60 p-5 sm:p-6"
          aria-label="Knowledge Inbox"
          data-testid="passport-knowledge-inbox-mount"
        >
          <header className="mb-4 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
              Knowledge Inbox
            </p>
            <h3 className="text-base font-semibold text-foreground">
              Captured but not yet source-verified
            </h3>
            <p className="text-xs text-muted-foreground/80">
              The inbox is where new clinician-supplied evidence is staged.
              Items here are user-entered or inferred; nothing is
              automatically marked verified, and classification runs
              deterministically without external model calls.
            </p>
          </header>
          <KnowledgeInboxPanel items={inboxItems} />
        </section>
      </div>
    </div>
  );
}
