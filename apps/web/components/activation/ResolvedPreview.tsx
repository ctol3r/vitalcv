'use client';

/**
 * The anonymous resolved preview — Wave 1076 B1, step one.
 *
 * A clinician gets something useful before being asked for anything. They type
 * an NPI, VitalCV shows what the public registry returned, and only then does
 * signing in have an obvious point: to keep it and correct it.
 *
 * Four things this surface must say, and does:
 *   - what VitalCV found;
 *   - that it came from a public source;
 *   - that finding an NPI does not prove the person looking owns it;
 *   - that they can review and correct it after they claim it.
 *
 * What it must NOT do is show anything private. Everything here comes from the
 * public bootstrap endpoint — the same information anyone can read at
 * npiregistry.cms.hhs.gov. No draft, no correction, no holding, and nothing
 * belonging to whoever may already have claimed this NPI.
 */

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TruthBadge } from '@/components/activation/TruthBadge';
import {
  buildPreview,
  PREVIEW_DISCLOSURES,
  type PreviewBootstrap,
  type PreviewOutcome,
} from '@/lib/activation/preview';
import { ACTIVATION_PATH, rememberPendingNpi, signInHref } from '@/lib/activation/pendingNpi';

type Phase = 'idle' | 'resolving' | 'done' | 'error';

export function ResolvedPreview({ initialNpi }: { initialNpi: string | null }) {
  const [raw, setRaw] = useState(initialNpi ?? '');
  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<PreviewOutcome | null>(null);
  const [resolvedNpi, setResolvedNpi] = useState<string | null>(null);

  const digits = raw.replace(/\D/g, '').slice(0, 10);

  const resolve = useCallback(async (npi: string) => {
    setPhase('resolving');
    setOutcome(null);
    try {
      const res = await fetch(`/api/identity/bootstrap/${npi}`, { cache: 'no-store' });
      if (!res.ok) {
        setPhase('error');
        return;
      }
      const boot = (await res.json()) as PreviewBootstrap;
      setOutcome(buildPreview(npi, boot));
      setResolvedNpi(npi);
      setPhase('done');
      // Remembered as soon as there is something worth keeping, so the NPI
      // survives the trip through sign-in even if the return URL loses it.
      rememberPendingNpi(npi);
    } catch {
      setPhase('error');
    }
  }, []);

  // An NPI that arrived in the URL resolves without a second click — the
  // clinician already asked for it once, on whatever surface sent them here.
  useEffect(() => {
    if (initialNpi && /^\d{10}$/.test(initialNpi)) void resolve(initialNpi);
  }, [initialNpi, resolve]);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16" data-activation-stage="preview">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Start with your NPI.
      </h1>
      <p className="text-muted-foreground mt-3 text-base sm:text-lg">
        VitalCV looks up what public sources already know, so you are not filling in a blank form.
        Free, and no account needed to look.
      </p>

      <form
        className="mt-8 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (digits.length === 10) void resolve(digits);
        }}
      >
        <div className="flex-1">
          <Label htmlFor="activate-npi" className="sr-only">
            Your 10-digit NPI
          </Label>
          <Input
            id="activate-npi"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Your 10-digit NPI"
            className="h-12 text-base"
            value={digits}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12"
          disabled={digits.length !== 10 || phase === 'resolving'}
        >
          {phase === 'resolving' ? 'Checking the registry…' : 'Look it up'}
        </Button>
      </form>
      <p className="text-muted-foreground mt-2 text-sm" aria-live="polite">
        {digits.length}/10 digits · free, no account needed to preview
      </p>

      {phase === 'error' && (
        <p className="mt-6 text-sm" role="status">
          The lookup could not run. That is a system state, not a finding about this NPI — try
          again.
        </p>
      )}

      {phase === 'done' && outcome?.kind === 'organization' && (
        <p className="mt-6 text-sm" role="status">
          That NPI belongs to an organization, not a person. A clinician profile starts from your
          own individual (Type&nbsp;1) NPI.
        </p>
      )}

      {phase === 'done' && outcome?.kind === 'no_answer' && (
        <p className="mt-6 text-sm" role="status">
          The registry did not return information for that number right now. Nothing was recorded,
          and nothing about you was found or not found — the lookup simply did not answer.
        </p>
      )}

      {phase === 'done' && outcome?.kind === 'individual' && resolvedNpi && (
        <section className="mt-8" aria-label="What VitalCV found">
          <div className="rounded-2xl border p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">VitalCV found this professional profile</h2>
              <TruthBadge truthClass="public_source" source={outcome.source} />
            </div>

            <dl className="mt-5 space-y-4">
              {outcome.items.map((item) => (
                <div key={item.label} className="border-t pt-4 first:border-t-0 first:pt-0">
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-base font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>

            <ul className="text-muted-foreground mt-6 space-y-2 text-sm">
              {PREVIEW_DISCLOSURES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-12">
              <a href={signInHref(resolvedNpi)} data-activation-claim-cta="">
                Sign in to keep and control this profile
              </a>
            </Button>
            <a
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
              href={ACTIVATION_PATH}
            >
              Not you? Check a different NPI
            </a>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            Signing in is how VitalCV knows the profile is yours to keep. Nothing here is shared
            with anyone until you choose to share it.
          </p>
        </section>
      )}
    </div>
  );
}
