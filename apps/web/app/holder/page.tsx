'use client';

/**
 * Holder Page — clinician passport entry
 *
 * Loads the logged-in clinician's real NPI from their workspace profile.
 * If no NPI is set up yet, shows an onboarding empty state → /get-ready.
 *
 * State: LOADING → HAS_NPI (show passport) | NO_NPI (show setup prompt)
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ChevronRight, Loader2, AlertCircle, Upload } from 'lucide-react';
import { WalletPassport } from '@/components/wallet/WalletPassport';
import { CredentialWallet } from '@/components/wallet/CredentialWallet';
import { CredentialPresentationActions } from '@/components/clinician/CredentialPresentationActions';
import EvidenceUploadPanel from '@/components/mobile/EvidenceUploadPanel';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { TrustStatePanel } from '@/components/trust-state/TrustStatePanel';

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
            <h1 className="text-2xl font-bold text-foreground mb-2">Set up your clinician record</h1>
            <p className="text-zinc-400 leading-relaxed text-sm">
              Start with your NPI to create the record that powers your readiness, passport, job applications, and employer shares.
              Then add your CV or credential evidence if you want to strengthen that record before you apply.
            </p>
          </div>
          <Link
            href="/get-ready"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-7 py-3.5 text-sm font-semibold text-black transition w-full justify-center"
          >
            Start with NPI <ChevronRight className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-700">or</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 hover:border-emerald-800 hover:bg-emerald-950/30 px-7 py-3.5 text-sm font-semibold text-zinc-300 hover:text-emerald-300 transition w-full justify-center"
          >
            <Upload className="h-4 w-4" />
            Upload CV or credential
          </Link>
          <ClinicianSupportCard
            topic="passport-setup"
            detail="If your clinician identity cannot be linked yet, start with NPI first. Once that baseline exists, uploads and readiness stay attached to the same record."
            primaryHref="/get-ready"
            primaryLabel="Start with NPI"
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
        <div>
          {profile?.firstName && (
            <p className="text-sm text-zinc-500">
              Welcome back, <span className="text-zinc-300 font-medium">{profile.firstName}</span>
            </p>
          )}
          <p className="mt-1 text-sm text-zinc-400">
            This is the same clinician record that powers your readiness, role fit, applications, and employer shares.
          </p>
        </div>
        <Link
          href="/documents"
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-emerald-700 hover:bg-emerald-950/30 hover:text-emerald-300 sm:w-auto"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload evidence
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-0 pt-4 sm:px-6">
        <section className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Keep this record moving</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-semibold text-white">Your passport, readiness, and applications all stay connected here</h1>
              <p className="mt-2 text-sm leading-6 text-emerald-50/85">
                Review the current passport first, then move into readiness, matched roles, or live applications without re-entering your profile.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Link
              href="/holder/readiness"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
            >
              Open readiness
            </Link>
            <Link
              href="/holder/opportunities"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Explore roles
            </Link>
            <Link
              href="/holder/applications"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              View applications
            </Link>
          </div>
        </section>
      </div>

      {/* Trust State */}
      <div className="mx-auto max-w-3xl px-4 pb-0 pt-4 sm:px-6">
        <TrustStatePanel npi={npi!} />
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
      <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6">
        <EvidenceUploadPanel
          heading="Upload credential evidence"
          description="Attach a license, certificate, verification letter, or supporting document here if readiness or an active application asks for more evidence. The file appears on your profile immediately, then VitalCV shows whether it is only stored, parsed, source-checked, or still missing detail."
          returnToHref="/holder"
          returnToLabel="Return to passport"
        />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <ClinicianSupportCard
          topic="trust-passport"
          detail="If your passport, trust facts, or credential wallet do not match your latest readiness or upload state, refresh once and then contact support with your NPI and the stale section."
          primaryHref="/holder/readiness"
          primaryLabel="Review readiness"
        />
      </div>
    </div>
  );
}
