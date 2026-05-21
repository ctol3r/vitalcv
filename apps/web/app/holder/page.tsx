'use client';

/**
 * Holder Page -- Clinician readiness surface
 *
 * Wave 23 compression: the surface now leads with ONE primary
 * operational signal (Confirmed / Pending / Attention needed /
 * Recently reviewed / Requires follow-up) and ONE primary action
 * ("Review readiness"). Deeper detail (passport, wallet, evidence
 * upload, presentation actions) is preserved verbatim but moved
 * inside a single ProgressiveTechnicalDisclosure so the first read
 * is a single action, not a wall of equal-weight panels.
 *
 * State machine: LOADING -> HAS_NPI | NO_NPI | ERROR. The NO_NPI
 * and ERROR states are unchanged.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ChevronRight, Loader2, AlertCircle, Upload } from 'lucide-react';
import { WalletPassport } from '@/components/wallet/WalletPassport';
import { CredentialWallet } from '@/components/wallet/CredentialWallet';
import { CredentialPresentationActions } from '@/components/clinician/CredentialPresentationActions';
import EvidenceUploadPanel from '@/components/mobile/EvidenceUploadPanel';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { TrustStatePanel } from '@/components/trust-state/TrustStatePanel';
import {
  PrimaryOperationalSignal,
  InstitutionalPrimaryAction,
  ProgressiveTechnicalDisclosure,
} from '@/components/signals';

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

  /* ── No NPI -- prompt setup ── */
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
              VitalCV pulls your credentials directly from public registries -- no document uploads required to get started.
            </p>
          </div>
          <Link
            href="/get-ready"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-7 py-3.5 text-sm font-semibold text-black transition w-full justify-center"
          >
            Verify my NPI <ChevronRight className="h-4 w-4" />
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
            Upload a credential document
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

  /* ── Has NPI -- single primary signal + primary action; detail disclosed ── */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {/* Greeting */}
        {profile?.firstName ? (
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Welcome back, {profile.firstName}
          </div>
        ) : null}

        {/* ── Primary operational signal ──────────────────────────────── */}
        <PrimaryOperationalSignal
          state="recently_reviewed"
          headline="Your readiness is recorded."
          summary="The receiving institution still owns its review on its own cadence. The next operator step is to review readiness; sharing continuity is available from there."
        />

        {/* ── One primary action ──────────────────────────────────────── */}
        <InstitutionalPrimaryAction
          label="Review readiness"
          href="/holder/readiness"
          context="Open your readiness surface to see source lanes, limitations, and the next institution-owned step."
        />

        {/* ── Progressive technical disclosure ────────────────────────── */}
        <ProgressiveTechnicalDisclosure
          summaryLabel="Show passport, wallet, and credential detail"
          closedCaption="Trust state panel, passport, credential wallet, evidence upload, and presentation actions."
        >
          <div className="space-y-4">
            <TrustStatePanel npi={npi!} />

            <WalletPassport npi={npi!} pollIntervalMs={30_000} />

            <details className="group rounded border border-slate-200 bg-white">
              <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-xs uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700">
                Detailed credential view
              </summary>
              <div className="mt-2 px-3 pb-3">
                <CredentialWallet subject={npi!} />
              </div>
            </details>

            <div className="hidden justify-end sm:flex">
              <CredentialPresentationActions holderNpi={npi!} />
            </div>

            <EvidenceUploadPanel
              heading="Upload credential evidence"
              description="Attach a license, certificate, or supporting document here if readiness or an active application requests more evidence. Upload attaches immediately, and verification can complete asynchronously."
              returnToHref="/holder"
              returnToLabel="Return to your readiness"
            />

            <ClinicianSupportCard
              topic="trust-passport"
              detail="If your passport, trust facts, or credential wallet do not match your latest state, refresh once and then contact support with your NPI and the stale section."
              primaryHref="/holder/readiness"
              primaryLabel="Review readiness"
            />

            <Link
              href="/documents"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-700 hover:bg-slate-100 sm:w-auto"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload credential
            </Link>
          </div>
        </ProgressiveTechnicalDisclosure>

        <footer className="border-t border-dashed border-slate-300 pt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          One operational signal · one primary action · technical detail progressively disclosed
        </footer>
      </div>
    </div>
  );
}
