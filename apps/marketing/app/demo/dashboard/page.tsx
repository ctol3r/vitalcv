'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { YcDemoBadge } from '../../../components/demo/YcDemoBadge';

type ArtifactData = {
  success: boolean;
  artifact: {
    schema_version: string;
    artifact_version: string;
    artifact_type: string;
    provider: {
      npi: string;
      first_name: string;
      last_name: string;
      primary_taxonomy: string | null;
      enumeration_type: string;
      status: string;
    };
    source: {
      system: string;
      endpoint: string;
      retrieved_at: string;
    };
    raw_capture: {
      payload_sha256: string;
      storage_ref: string;
    };
  };
  artifact_hash: string;
  signature: string | null;
  signing_available: boolean;
  source: 'live' | 'cached';
};

function truncateHash(hash: string, chars = 12): string {
  if (hash.length <= chars * 2) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function ScoreCard({ score }: { score: number }) {
  const band =
    score >= 80 ? 'GREEN' : score >= 50 ? 'YELLOW' : 'RED';
  const bandColor = {
    GREEN: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    YELLOW: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    RED: 'bg-red-500/10 text-red-600 border-red-500/20',
  }[band];
  const bandLabel = {
    GREEN: 'Verified',
    YELLOW: 'Partial',
    RED: 'Incomplete',
  }[band];

  return (
    <div className={`rounded-xl border p-6 ${bandColor}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-60">
        Readiness Score
      </p>
      <p className="mt-2 text-4xl font-bold">{score}</p>
      <p className="mt-1 text-sm font-medium">{bandLabel}</p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <p
          className={`text-lg text-foreground ${mono ? 'font-mono text-sm break-all' : 'font-semibold'}`}
        >
          {value}
        </p>
        {copyable && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const npi = searchParams.get('npi');
  const [data, setData] = useState<ArtifactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!npi) {
      router.replace('/demo');
      return;
    }

    // Try sessionStorage first (came from landing)
    const cached = sessionStorage.getItem('vcv_artifact');
    if (cached) {
      try {
        setData(JSON.parse(cached));
        setLoading(false);
        return;
      } catch {
        // fall through to API
      }
    }

    // Direct link — fetch from API
    fetch('/api/demo/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Verification failed (${r.status})`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [npi, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <p className="mt-4 text-sm text-muted">Fetching credential bundle…</p>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-foreground">
            Verification Failed
          </p>
          <p className="mt-2 text-sm text-muted">
            {error || 'Could not generate credential bundle'}
          </p>
          <button
            onClick={() => router.push('/demo')}
            className="mt-6 rounded-lg border border-border px-6 py-2 text-sm font-medium text-foreground transition-theme hover:bg-surface"
          >
            ← Try another NPI
          </button>
        </div>
      </div>
    );
  }

  const { artifact, artifact_hash, signature, signing_available } = data;
  const provider = artifact.provider;

  // Compute a simple readiness score based on available data
  let score = 0;
  if (provider.npi) score += 25;
  if (provider.status === 'A') score += 25;
  if (artifact_hash) score += 25;
  if (signature || signing_available) score += 25;

  return (
    <div className="min-h-screen bg-background">
      <YcDemoBadge />

      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <a
              href="/demo"
              className="text-sm font-semibold tracking-[0.2em] uppercase text-muted transition-colors hover:text-foreground"
            >
              VitalCV
            </a>
            <span className="text-border">|</span>
            <span className="text-sm text-muted">Dashboard</span>
          </div>
          <button
            onClick={() => router.push('/demo')}
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            ← New lookup
          </button>
        </div>
      </header>

      {/* Provider info */}
      <div className="mx-auto max-w-4xl px-6 pt-8">
        <h1 className="text-2xl font-semibold text-foreground">
          {provider.first_name} {provider.last_name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          NPI {provider.npi} · {provider.primary_taxonomy ?? 'Provider'} ·{' '}
          {provider.enumeration_type === 'NPI-1' ? 'Individual' : 'Organization'}
        </p>
      </div>

      {/* Card Grid */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreCard score={score} />
          <InfoCard
            label="Bundle Hash"
            value={truncateHash(artifact_hash)}
            mono
            copyable
          />
          <InfoCard
            label="Verified At"
            value={`${timeAgo(artifact.source.retrieved_at)} · ${new Date(artifact.source.retrieved_at).toLocaleString()}`}
          />
          <InfoCard
            label="Credential Status"
            value={signature ? '✓ Signed' : signing_available ? '⏳ Signing available' : '○ Unsigned'}
          />
        </div>

        {/* Verify CTA */}
        <div className="mt-8 text-center">
          <button
            onClick={() =>
              router.push(`/demo/verify?artifact=${encodeURIComponent(artifact_hash)}&npi=${npi}`)
            }
            className="rounded-lg bg-foreground px-8 py-3 text-base font-semibold text-background transition-opacity hover:opacity-90"
          >
            Verify This Bundle
          </button>
        </div>
      </div>

      {/* Source info */}
      <div className="mx-auto max-w-4xl px-6 pb-12">
        <p className="text-xs text-muted">
          Source: {artifact.source.system} · Data: {data.source}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
