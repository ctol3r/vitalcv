'use client';

/**
 * EmployerGetStartedClient — employer onboarding:
 *
 *   enter org NPI → NPPES lookup → confirm the org + its website
 *     → REQUEST access (sign in) → granted, or refused with the reason.
 *
 * Employers carry an organizational **Type-2 NPI** (NPPES enumerates orgs as
 * Type 2, individuals as Type 1). We reuse the same public lookup the clinician
 * flow uses (`/api/identity/bootstrap/{npi}`) and require Type 2 — a Type-1
 * (individual) NPI is redirected to the clinician flow.
 *
 * Truth contract: resolving a Type 2 NPI in NPPES establishes WHICH
 * organization is meant. It is never authority to act for it, so this surface
 * asks for access rather than announcing a claim, and the server decides
 * (`resolveOrganizationAuthority`: a work email at the organization's own
 * domain, else manual review).
 *
 * The website field is REQUIRED for that reason, not for decoration. The
 * authority check compares the account's email domain against the
 * organization's domain, which is derived from the website — so a payload
 * without one resolved `no_org_domain` and this flow refused EVERY new
 * organization with "add the organization's website", a field it never asked
 * for. NPPES does not publish organization websites, so the operator supplies
 * it and the server, not this form, decides whether it grants anything.
 */

import { useState } from 'react';
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';

type Phase = 'idle' | 'looking_up' | 'confirm' | 'requesting' | 'done' | 'error';

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

function orgNameOf(r: NpiLookupResult): string {
  return [r.firstName, r.lastName].filter(Boolean).join(' ').trim();
}

export function EmployerGetStartedClient() {
  const [npi, setNpi] = useState('');
  const [website, setWebsite] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<NpiLookupResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(npi)) {
      setErrorMsg('An organization NPI is exactly 10 digits.');
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

      if (data.npiType !== 'TYPE_2') {
        // Individual (Type 1) NPI — that's a clinician, not an employer org.
        setErrorMsg(
          'That is an individual (Type 1) NPI. Employers use their organization’s Type 2 NPI. ' +
          'If you are a clinician, start at /get-ready instead.',
        );
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

  async function handleRequestAccess() {
    if (!result) return;
    const trimmedWebsite = website.trim();
    if (!trimmedWebsite) {
      setErrorMsg('Enter the organization’s website so we can check it against your work email.');
      return;
    }
    setErrorMsg('');
    setPhase('requesting');
    try {
      const res = await fetch('/api/employer/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgNameOf(result) || `Organization ${result.npi}`,
          npi: result.npi,
          website: trimmedWebsite,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        if (res.status === 401) {
          setErrorMsg('Sign in first, then return here to request access to your organization.');
        } else {
          // 403 = the authority gate refused. Its message already explains the
          // next step (work email at the org domain, or manual review), so show
          // it verbatim rather than a generic failure.
          setErrorMsg(data.error ?? `Access request failed (${res.status}).`);
        }
        setPhase('error');
        return;
      }
      setPhase('done');
    } catch {
      setErrorMsg('Network error while requesting access. Try again.');
      setPhase('error');
    }
  }

  function reset() {
    setNpi('');
    setWebsite('');
    setPhase('idle');
    setResult(null);
    setErrorMsg('');
  }

  /* ── Done ── */
  if (phase === 'done' && result) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-base font-semibold">
            Access granted — {orgNameOf(result) || `Organization ${result.npi}`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your work email matched this organization&rsquo;s domain, so your workspace is linked to org NPI{' '}
            {result.npi}.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          A domain match establishes that you control an address at that domain. NPPES resolves the organization
          identifier. Neither is legal proof of authority over the organization. Your workspace can now review clinician
          passports.
        </p>
        <a
          href="/employer/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-6 text-sm font-medium text-background hover:opacity-90"
        >
          Open your employer workspace
        </a>
      </div>
    );
  }

  /* ── Confirm ── */
  if (phase === 'confirm' && result) {
    const name = orgNameOf(result) || 'Unknown organization';
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Confirm your organization</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            NPPES returned the following for NPI {result.npi}. Confirm this is the organization you mean, then request
            access. The NPI lookup resolves which organization this is — it is not authority to act for it.
          </p>
        </div>

        <dl className="space-y-2.5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted-foreground">Organization</dt>
            <dd className="text-right font-medium">{name}</dd>
          </div>
          {result.state && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">State</dt>
              <dd className="text-right">{result.state}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted-foreground">Type</dt>
            <dd className="text-right">Organization (Type 2)</dd>
          </div>
        </dl>

        {result.alreadyRegistered && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            This organization NPI is already registered to a VitalCV organization. Requesting access sends it for
            review — it does not transfer the existing organization to you.
          </p>
        )}

        {/* The website is what the server's authority check actually compares
            against the account's email domain. Without it the request resolves
            `no_org_domain` and is refused every time — which is precisely what
            this flow did before, while never asking for it. */}
        <div>
          <label htmlFor="org-website-input" className="mb-1.5 block text-sm font-medium">
            Organization website
          </label>
          <input
            id="org-website-input"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="example-health.org"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            NPPES does not publish websites, so we ask. Your work email is checked against this domain.
          </p>
        </div>

        {/* Honest framing: this is a REQUEST, not a grant. Finding an
            organization in NPPES proves it exists — never that you may act for
            it. Access is granted only on a work email at the organization's own
            domain; anything else goes to a VitalCV reviewer. */}
        <p className="rounded-lg border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-3 py-2 text-xs text-[var(--vt-text-secondary)]">
          Access is granted when your work email matches this organization&rsquo;s domain. Otherwise a VitalCV reviewer
          verifies your authority first.
        </p>

        {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => void handleRequestAccess()}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background hover:opacity-90"
          >
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Request organization access
          </button>
          <button onClick={reset} className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-muted">
            Try another
          </button>
        </div>
      </div>
    );
  }

  /* ── Requesting ── */
  if (phase === 'requesting') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Checking your authority for this organization…</p>
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
        <button onClick={reset} className="h-10 w-full rounded-lg border border-border text-sm hover:bg-muted">
          Try again
        </button>
      </div>
    );
  }

  /* ── Idle / Looking up ── */
  return (
    <form onSubmit={(e) => void handleLookup(e)} className="space-y-4">
      <div>
        <label htmlFor="org-npi-input" className="mb-1.5 block text-sm font-medium">
          Organization NPI (Type 2)
        </label>
        <input
          id="org-npi-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          value={npi}
          onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit organization NPI"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={phase === 'looking_up'}
        />
        {errorMsg && <p className="mt-1.5 text-xs text-destructive">{errorMsg}</p>}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        We look up your organization&rsquo;s Type 2 NPI in NPPES (the federal source of record) to establish which
        organization you mean. That resolves the organization identifier — it is not authority to act for it, so the
        next step is a request for access, not a claim.
      </p>

      <button
        type="submit"
        disabled={phase === 'looking_up' || npi.length !== 10}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {phase === 'looking_up' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking up…
          </>
        ) : (
          <>
            <Building2 className="h-4 w-4" />
            Look up organization
          </>
        )}
      </button>
    </form>
  );
}
