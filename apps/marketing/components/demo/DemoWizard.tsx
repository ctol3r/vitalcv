'use client';

import { useState, useCallback, useRef } from 'react';
import { StepIndicator } from './StepIndicator';
import { ProviderCard } from './ProviderCard';
import { ArtifactCard } from './ArtifactCard';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Provider = {
  npi: string;
  enumeration_type: string;
  status: string;
  first_name: string;
  last_name: string;
  primary_taxonomy: string | null;
};

type ProviderResult = {
  provider: Provider;
  source: 'live' | 'cached';
};

type ArtifactResult = {
  success: boolean;
  artifact: {
    schema_version: string;
    artifact_version: string;
    artifact_type: string;
    provider: {
      npi: string;
      first_name: string;
      last_name: string;
      [key: string]: unknown;
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

/* ------------------------------------------------------------------ */
/*  Sample NPIs — pre-loaded for easy demos                           */
/* ------------------------------------------------------------------ */

const SAMPLE_NPIS = [
  { npi: '1003000126', label: 'Robert Smith — Internal Medicine' },
  { npi: '1497758544', label: 'Mary Johnson — Family Medicine' },
  { npi: '1588667638', label: 'James Williams — Nurse Practitioner' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DemoWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [npi, setNpi] = useState('');
  const [provider, setProvider] = useState<ProviderResult | null>(null);
  const [artifact, setArtifact] = useState<ArtifactResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  /* ── NPI input handler (digit-only, 10 char max) ── */
  const handleNpiChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
      setNpi(digits);
      if (error) setError('');
    },
    [error],
  );

  /* ── Step 1 → 2: Look up provider ── */
  const lookupProvider = useCallback(
    async (npiValue?: string) => {
      const target = npiValue ?? npi;
      if (target.length < 10) {
        setError('NPI must be exactly 10 digits');
        return;
      }
      if (submittingRef.current) return;
      submittingRef.current = true;
      setLoading(true);
      setError('');

      try {
        const res = await fetch(`/api/demo/provider?npi=${target}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? `Lookup failed (${res.status})`);
          return;
        }
        const data: ProviderResult = await res.json();
        setProvider(data);
        setNpi(target);
        setStep(2);
      } catch {
        setError('Network error — please try again');
      } finally {
        setLoading(false);
        submittingRef.current = false;
      }
    },
    [npi],
  );

  /* ── Step 2 → 3: Generate credential ── */
  const generateCredential = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/demo/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Verification failed (${res.status})`);
        return;
      }
      const data: ArtifactResult = await res.json();
      setArtifact(data);
      setStep(3);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [npi]);

  /* ── Reset ── */
  const reset = useCallback(() => {
    setStep(1);
    setNpi('');
    setProvider(null);
    setArtifact(null);
    setError('');
    setLoading(false);
    submittingRef.current = false;
  }, []);

  return (
    <div className="space-y-8">
      <StepIndicator current={step} />

      {/* ── Step 1: Identify ── */}
      {step === 1 && (
        <div className="rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Step 1 — Identify a provider
          </h2>
          <p className="mt-1 text-sm text-muted">
            Enter a 10-digit NPI to look up the provider in the CMS NPPES
            registry, or pick a sample below.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookupProvider();
            }}
            className="mt-5"
          >
            <div className="relative max-w-md">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter 10-digit NPI"
                value={npi}
                onChange={handleNpiChange}
                disabled={loading}
                aria-label="National Provider Identifier"
                aria-describedby={error ? 'demo-error' : undefined}
                aria-invalid={error ? 'true' : undefined}
                className="w-full rounded-lg border border-border bg-transparent px-4 py-3 pr-28 text-base text-foreground placeholder:text-muted outline-none transition-theme focus:border-foreground focus:ring-1 focus:ring-foreground disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || npi.length < 10}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-theme hover:opacity-80 disabled:opacity-50"
              >
                {loading ? 'Looking up…' : 'Look up'}
              </button>
            </div>
          </form>

          {error && (
            <p id="demo-error" role="alert" className="mt-3 text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="mt-5">
            <p className="text-xs uppercase tracking-wide text-muted">
              Try a sample
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAMPLE_NPIS.map((s) => (
                <button
                  key={s.npi}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setNpi(s.npi);
                    void lookupProvider(s.npi);
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-theme hover:bg-surface disabled:opacity-50"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Verify ── */}
      {step === 2 && provider && (
        <div className="space-y-6">
          <ProviderCard provider={provider.provider} source={provider.source} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void generateCredential()}
              className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-theme hover:opacity-80 disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate credential'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-theme hover:bg-surface"
            >
              Start over
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
        </div>
      )}

      {/* ── Step 3: Credential ── */}
      {step === 3 && artifact && (
        <div className="space-y-6">
          <ArtifactCard data={artifact} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-theme hover:opacity-80"
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
