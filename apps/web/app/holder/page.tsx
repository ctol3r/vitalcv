'use client';

/**
 * Holder Page — Clinician Trust Passport
 *
 * Loads the logged-in clinician's real NPI from their workspace profile.
 * If no NPI is set up yet, shows an onboarding empty state → /get-ready.
 *
 * State: LOADING → HAS_NPI (show passport) | NO_NPI (show setup prompt)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ChevronRight, Loader2, AlertCircle, Upload } from 'lucide-react';
import { WalletPassport } from '@/components/wallet/WalletPassport';
import { CredentialWallet } from '@/components/wallet/CredentialWallet';
import { CredentialPresentationActions } from '@/components/clinician/CredentialPresentationActions';
import ImpactPanel from '@/components/impact/ImpactPanel';

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
            <h1 className="text-2xl font-bold text-white mb-2">Set up your trust passport</h1>
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
          <p className="text-white font-medium">Couldn&apos;t load your profile</p>
          <p className="text-sm text-zinc-400">Try refreshing the page. If it keeps happening, check your connection.</p>
          <button
            onClick={() => { setPhase('loading'); }}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:text-white transition"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ── Has NPI — full passport ── */
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Greeting + Upload CTA */}
      <div className="px-6 pt-8 pb-0 max-w-3xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        {profile?.firstName && (
          <p className="text-sm text-zinc-500">
            Welcome back, <span className="text-zinc-300 font-medium">{profile.firstName}</span>
          </p>
        )}
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 hover:border-emerald-700 hover:bg-emerald-950/30 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-emerald-300 transition"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Credential
        </Link>
      </div>

      {/* Passport */}
      <div className="px-6 py-6 max-w-3xl mx-auto">
        <WalletPassport npi={npi!} pollIntervalMs={30_000} />
      </div>

      {/* Detailed credential view */}
      <div className="px-6 py-4 max-w-5xl mx-auto">
        <details className="group">
          <summary className="text-[10px] text-zinc-600 uppercase tracking-wider cursor-pointer hover:text-zinc-400 transition-colors">
            Detailed Credential View
          </summary>
          <div className="mt-4">
            <CredentialWallet subject={npi!} />
          </div>
        </details>
      </div>

      {/* Presentation actions */}
      <div className="px-6 pb-4 flex justify-end max-w-5xl mx-auto">
        <CredentialPresentationActions holderNpi={npi!} />
      </div>

      <ImpactPanel npi={npi!} />
    </div>
  );
}
