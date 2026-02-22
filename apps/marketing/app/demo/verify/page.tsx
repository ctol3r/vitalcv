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

function CheckRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}) {
  const icon = { pass: '✓', fail: '✗', warn: '⚠' }[status];
  const color = {
    pass: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
    fail: 'text-red-600 bg-red-500/10 border-red-500/20',
    warn: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  }[status];

  return (
    <div className={`flex items-start gap-4 rounded-xl border p-5 ${color}`}>
      <span className="mt-0.5 text-xl font-bold">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm opacity-75 break-all">{detail}</p>
      </div>
    </div>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const artifactParam = searchParams.get('artifact');
  const npi = searchParams.get('npi');
  const [data, setData] = useState<ArtifactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!artifactParam && !npi) {
      router.replace('/demo');
      return;
    }

    // Try sessionStorage first
    const cached = sessionStorage.getItem('vcv_artifact');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ArtifactData;
        // Verify hash matches if provided
        if (!artifactParam || parsed.artifact_hash === artifactParam) {
          setData(parsed);
          setLoading(false);
          return;
        }
      } catch {
        // fall through
      }
    }

    // Fetch from API using NPI
    if (npi) {
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
    } else {
      setError('No artifact data available. Please start from the demo page.');
      setLoading(false);
    }
  }, [artifactParam, npi, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <p className="mt-4 text-sm text-muted">Verifying credential bundle…</p>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-foreground">
            Verification Unavailable
          </p>
          <p className="mt-2 text-sm text-muted">{error || 'No bundle data'}</p>
          <button
            onClick={() => router.push('/demo')}
            className="mt-6 rounded-lg border border-border px-6 py-2 text-sm font-medium text-foreground transition-theme hover:bg-surface"
          >
            ← Start over
          </button>
        </div>
      </div>
    );
  }

  const { artifact, artifact_hash, signature, signing_available } = data;
  const provider = artifact.provider;

  // Verification checks
  const hashMatch = artifactParam
    ? artifactParam === artifact_hash
    : true; // no comparison hash provided, trust the data
  const signatureValid = !!signature;
  const retrievedAt = new Date(artifact.source.retrieved_at);
  const ageMs = Date.now() - retrievedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const isFresh = ageHours < 24;

  const allPass = hashMatch && signatureValid && isFresh;

  return (
    <div className="min-h-screen bg-background">
      <YcDemoBadge />

      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <a
              href="/demo"
              className="text-sm font-semibold tracking-[0.2em] uppercase text-muted transition-colors hover:text-foreground"
            >
              VitalCV
            </a>
            <span className="text-border">|</span>
            <span className="text-sm text-muted">Verifier</span>
          </div>
          {npi && (
            <button
              onClick={() => router.push(`/demo/dashboard?npi=${npi}`)}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              ← Dashboard
            </button>
          )}
        </div>
      </header>

      {/* Overall status banner */}
      <div
        className={`border-b py-6 text-center ${
          allPass
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : 'border-red-500/20 bg-red-500/5'
        }`}
      >
        <p
          className={`text-2xl font-bold ${
            allPass ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {allPass ? '✓ VERIFIED' : '✗ UNVERIFIED'}
        </p>
        <p className="mt-1 text-sm text-muted">
          {allPass
            ? 'All verification checks passed'
            : 'One or more checks did not pass'}
        </p>
      </div>

      {/* Provider summary */}
      <div className="mx-auto max-w-3xl px-6 pt-8">
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Provider Summary
          </p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted">Name: </span>
              <span className="font-medium text-foreground">
                {provider.first_name} {provider.last_name}
              </span>
            </div>
            <div>
              <span className="text-muted">NPI: </span>
              <span className="font-mono text-foreground">{provider.npi}</span>
            </div>
            <div>
              <span className="text-muted">Specialty: </span>
              <span className="text-foreground">
                {provider.primary_taxonomy ?? 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted">Source: </span>
              <span className="text-foreground">{artifact.source.system}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Verification checks */}
      <div className="mx-auto max-w-3xl space-y-3 px-6 py-8">
        <CheckRow
          label="Hash Match"
          status={hashMatch ? 'pass' : 'fail'}
          detail={
            hashMatch
              ? `SHA-256: ${artifact_hash.slice(0, 16)}…${artifact_hash.slice(-16)}`
              : `Expected ${artifactParam?.slice(0, 16)}… but got ${artifact_hash.slice(0, 16)}…`
          }
        />
        <CheckRow
          label="Signature"
          status={signatureValid ? 'pass' : signing_available ? 'warn' : 'fail'}
          detail={
            signatureValid
              ? `Signed: ${signature!.slice(0, 24)}…`
              : signing_available
                ? 'Signing capability available but no signature on this bundle'
                : 'No cryptographic signature'
          }
        />
        <CheckRow
          label="Freshness"
          status={isFresh ? 'pass' : 'warn'}
          detail={`Retrieved ${new Date(artifact.source.retrieved_at).toLocaleString()} (${ageHours < 1 ? `${Math.round(ageHours * 60)}m` : `${Math.round(ageHours)}h`} ago)`}
        />
      </div>

      {/* Footer */}
      <div className="mx-auto max-w-3xl px-6 pb-12">
        <p className="text-xs text-muted">
          Schema: {artifact.schema_version} · Version: {artifact.artifact_version} · Type: {artifact.artifact_type}
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
