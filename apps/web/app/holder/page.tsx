'use client';

/**
 * Holder Page — Clinician wallet & passport
 *
 * Loads the logged-in clinician's real NPI from their workspace profile.
 * If no NPI is set up yet, shows an onboarding empty state → /get-ready.
 *
 * State: LOADING → HAS_NPI (show passport) | NO_NPI (show setup prompt)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ChevronRight, Loader2, AlertCircle, Upload, UserRound } from 'lucide-react';
import { WalletPassport } from '@/components/wallet/WalletPassport';
import { CredentialWallet } from '@/components/wallet/CredentialWallet';
import { CredentialPresentationActions } from '@/components/clinician/CredentialPresentationActions';
import EvidenceUploadPanel from '@/components/mobile/EvidenceUploadPanel';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { TrustStatePanel } from '@/components/trust-state/TrustStatePanel';
import { RecognitionCard } from '@/components/recognition/RecognitionCard';

type WorkspaceProfile = {
  npi?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type Phase = 'loading' | 'has_npi' | 'no_npi' | 'error';

export default function HolderPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [npi, setNpi] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/me/workspaces');
        if (!res.ok) {
          setPhase('error');
          return;
        }
        const data = await res.json() as { personProfile?: WorkspaceProfile | null };
        const pp = data.personProfile;
        if (pp?.npi) {
          setNpi(pp.npi);
          setProfile(pp);
          setPhase('has_npi');
        } else {
          setPhase('no_npi');
        }
      } catch {
        setPhase('error');
      }
    }
    void loadProfile();
  }, []);

  /* ── Loading ── */
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 text-zinc-500 animate-spin" />
          <p className="text-sm text-zinc-600">Loading your profile…</p>
        </div>
      </div>
    );
  }

  /* ── No NPI — prompt setup ── */
  if (phase === 'no_npi') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 mx-auto">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Set up your readiness</h1>
            <p className="text-zinc-400 leading-relaxed text-sm">
              Verify your NPI to activate your clinician profile. Takes 2 minutes.
              VitalCV pulls your credentials directly from public registries — no document uploads required to get started.
            </p>
          </div>
          <Link
            href="/get-ready"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-7 py-3.5 text-sm font-semibold text-black transition w-full justify-center"
          >
            Verify my NPI <ChevronRight className="h-4 w-4" />
          </Link>
          <ClinicianSupportCard
            topic="passport-setup"
            detail="If your clinician identity cannot be linked yet, start with NPI verification first. Support can help if your public registry record still does not resolve."
            primaryHref="/get-ready"
            primaryLabel="Verify NPI"
          />
          <p className="text-xs text-zinc-700">Free. No credit card. Your data stays yours.</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
          <p className="text-foreground font-medium">Couldn&apos;t load your profile</p>
          <p className="text-sm text-zinc-400">Try refreshing the page. If it keeps happening, check your connection.</p>
          <button
            onClick={() => { setPhase('loading'); }}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:text-foreground transition"
          >
            Try again
          </button>
          <ClinicianSupportCard
            topic="passport-error"
            detail="If your passport still will not load after a retry, open readiness to confirm your trust state or contact support with the error timing."
            primaryHref="/holder/readiness"
            primaryLabel="Open readiness"
          />
        </div>
      </div>
    );
  }

  /* ── Has NPI — full passport ── */
  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      {/* Greeting + Upload CTA */}
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-0 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-8">
        {profile?.firstName && (
          <p className="text-sm text-zinc-500">
            Welcome back, <span className="text-zinc-300 font-medium">{profile.firstName}</span>
          </p>
        )}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/clinician/profile"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-emerald-700 hover:bg-emerald-950/30 hover:text-emerald-300 sm:w-auto"
          >
            <UserRound className="h-3.5 w-3.5" />
            Professional profile
          </Link>
          <a
            href="#evidence-upload"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-emerald-700 hover:bg-emerald-950/30 hover:text-emerald-300 sm:w-auto"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Credential
          </a>
        </div>
      </div>

      {/* Trust State */}
      <div className="mx-auto max-w-3xl px-4 pb-0 pt-4 sm:px-6">
        <TrustStatePanel npi={npi!} />
      </div>

      {/* Recognition — employer acceptance record */}
      <div className="mx-auto max-w-3xl px-4 pb-0 pt-4 sm:px-6">
        <RecognitionCard npi={npi!} />
      </div>

      {/* Passport */}
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <WalletPassport npi={npi!} pollIntervalMs={30_000} />
      </div>

      {/* Detailed credential view */}
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <details className="group">
          <summary className="flex min-h-[44px] items-center text-xs uppercase tracking-wider text-zinc-500 cursor-pointer transition-colors hover:text-zinc-300">
            Detailed Credential View
          </summary>
          <div className="mt-4">
            <CredentialWallet subject={npi!} />
          </div>
        </details>
      </div>

      {/* Presentation actions */}
      <div className="mx-auto hidden max-w-5xl justify-end px-4 pb-4 sm:flex sm:px-6">
        <CredentialPresentationActions holderNpi={npi!} />
      </div>
      <div id="evidence-upload" className="mx-auto max-w-5xl scroll-mt-6 px-4 py-2 sm:px-6">
        <EvidenceUploadPanel
          heading="Upload credential evidence"
          description="Attach a license, certificate, or supporting document here if readiness or an active application requests more evidence. Upload attaches immediately, and verification can complete asynchronously."
          returnToHref="/holder"
          returnToLabel="Return to your readiness"
        />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <ClinicianSupportCard
          topic="trust-passport"
          detail="If your passport, trust facts, or credential wallet do not match your latest state, refresh once and then contact support with your NPI and the stale section."
          primaryHref="/holder/readiness"
          primaryLabel="Review readiness"
        />
      </div>
    </div>
  );
}
