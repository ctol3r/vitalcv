'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

type Phase = 'idle' | 'looking_up' | 'confirm' | 'claiming' | 'done' | 'error';

interface NpiLookupResult {
  npi: string;
  npiType: 'TYPE_1' | 'TYPE_2';
  inferredPersona: 'CLINICIAN' | 'VERIFIER' | 'UNKNOWN';
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
  alreadyRegistered: boolean;
}

export function GetReadyClient() {
  const [npi, setNpi] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<NpiLookupResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(npi)) {
      setErrorMsg('NPI must be exactly 10 digits.');
      return;
    }
    setErrorMsg('');
    setPhase('looking_up');

    try {
      const res = await fetch(`/api/identity/bootstrap/${npi}`);
      const data = await res.json() as NpiLookupResult & { error?: string };

      if (!res.ok) {
        setErrorMsg(data.error ?? `NPPES lookup failed (${res.status}). Check the NPI and try again.`);
        setPhase('error');
        return;
      }

      setResult(data);
      setPhase('confirm');
    } catch {
      setErrorMsg('Network error. Check your connection and try again.');
      setPhase('error');
    }
  }

  async function handleBind() {
    if (!result) return;
    setPhase('claiming');

    try {
      // 1. Create PersonProfile linked to this user (critical — makes holder page show NPI)
      const profileRes = await fetch('/api/profile/npi/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: result.npi }),
      });

      if (!profileRes.ok) {
        const data = await profileRes.json().catch(() => ({})) as { error?: string };
        const msg = data.error ?? `Profile binding failed (${profileRes.status})`;
        // 401 means not signed in — specific guidance
        if (profileRes.status === 401) {
          setErrorMsg('Sign in first, then return here to bind your NPI.');
        } else {
          setErrorMsg(msg);
        }
        setPhase('error');
        return;
      }

      // 2. Record ownership claim
      const claimRes = await fetch('/api/ownership/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: result.npi }),
      });
      if (!claimRes.ok) {
        const data = await claimRes.json().catch(() => ({})) as { error?: string };
        setErrorMsg(data.error ?? `Ownership claim failed (${claimRes.status})`);
        setPhase('error');
        return;
      }

      // 3. Ingest NPI credentials — best-effort; failure is non-fatal
      await fetch('/api/credentials/ingest-npi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: result.npi }),
      }).catch(() => undefined);

      setPhase('done');
    } catch {
      setErrorMsg('Network error during NPI binding. Try again.');
      setPhase('error');
    }
  }

  function reset() {
    setNpi('');
    setPhase('idle');
    setResult(null);
    setErrorMsg('');
  }

  /* ── Done ── */
  if (phase === 'done' && result) {
    const name = [result.firstName, result.lastName].filter(Boolean).join(' ');
    return (
      <div className="space-y-5 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 mx-auto">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-base font-semibold">NPI {result.npi} bound</h2>
          {name && (
            <p className="mt-1 text-sm text-muted-foreground">{name} · your credential record is building.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Source-backed evidence is separate from this binding. NPI lookup is not government-ID identity proofing.
        </p>
        <a
          href="/holder"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-6 text-sm font-medium text-background hover:opacity-90"
        >
          Open your wallet
        </a>
      </div>
    );
  }

  /* ── Confirm ── */
  if (phase === 'confirm' && result) {
    const name = [result.firstName, result.lastName].filter(Boolean).join(' ') || 'Unknown';
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Confirm this is you</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            NPPES returned the following for NPI {result.npi}. NPI lookup resolves an identifier — it is not
            government-ID identity proofing.
          </p>
        </div>

        <dl className="rounded-xl border border-border bg-muted/40 p-4 text-sm space-y-2.5">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">Name</dt>
            <dd className="font-medium text-right">{name}</dd>
          </div>
          {result.specialty && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground shrink-0">Specialty</dt>
              <dd className="text-right">{result.specialty}</dd>
            </div>
          )}
          {result.state && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground shrink-0">State</dt>
              <dd className="text-right">{result.state}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">Type</dt>
            <dd className="text-right">
              {result.npiType === 'TYPE_1' ? 'Individual (Type 1)' : 'Organization (Type 2)'}
            </dd>
          </div>
        </dl>

        {result.alreadyRegistered && (
          <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            This NPI is already registered. You can still bind it to your account.
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => void handleBind()}
            className="flex-1 inline-flex h-10 items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background hover:opacity-90"
          >
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Yes, bind NPI {result.npi}
          </button>
          <button
            onClick={reset}
            className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-muted"
          >
            Try another
          </button>
        </div>
      </div>
    );
  }

  /* ── Claiming ── */
  if (phase === 'claiming') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Binding NPI to your account…</p>
      </div>
    );
  }

  /* ── Error ── */
  if (phase === 'error') {
    return (
      <div className="space-y-4">
        <div className="flex gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{errorMsg}</p>
        </div>
        <button
          onClick={reset}
          className="w-full h-10 rounded-lg border border-border text-sm hover:bg-muted"
        >
          Try again
        </button>
      </div>
    );
  }

  /* ── Idle / Looking up ── */
  return (
    <form onSubmit={(e) => void handleLookup(e)} className="space-y-4">
      <div>
        <label htmlFor="npi-input" className="block text-sm font-medium mb-1.5">
          National Provider Identifier (NPI)
        </label>
        <input
          id="npi-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          value={npi}
          onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit NPI"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={phase === 'looking_up'}
        />
        {errorMsg && <p className="mt-1.5 text-xs text-destructive">{errorMsg}</p>}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        We look up your NPI in NPPES (the federal source of record). This resolves your identifier and links it to
        your account. It is not government-ID identity proofing.
      </p>

      <button
        type="submit"
        disabled={phase === 'looking_up' || npi.length !== 10}
        className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-medium text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {phase === 'looking_up' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking up…
          </>
        ) : (
          'Look up NPI'
        )}
      </button>
    </form>
  );
}
