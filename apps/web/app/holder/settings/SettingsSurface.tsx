'use client';

/**
 * SettingsSurface — holder settings: account, identity binding, profile,
 * data & sharing.
 *
 * Honesty rule: this surface only exposes controls that are actually wired.
 * Account management and sign-out are Clerk's real flows; identity binding
 * reflects the real workspace PersonProfile; sharing describes the real
 * share surfaces. There are no decorative toggles.
 */

import Link from 'next/link';
import { SignOutButton, UserButton, useUser } from '@clerk/nextjs';
import { ChevronRight, IdCard, Share2, Settings as SettingsIcon, UserRound } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function SettingsSurface() {
  const { data } = useClinicianMobile();
  const person = data.workspace?.personProfile ?? null;
  const npi = person?.npi ?? null;
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(' ') || null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12">
      <header className="flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <SettingsIcon className="h-5 w-5 text-white/70" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-white/55">Account, identity binding, and sharing.</p>
        </div>
      </header>

      {/* Account (Clerk) */}
      <section aria-labelledby="settings-account" className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <h2 id="settings-account" className="text-[11px] uppercase tracking-[0.18em] text-white/45">
          Account
        </h2>
        {clerkEnabled ? <AccountRow /> : (
          <p className="mt-3 text-sm text-white/60">
            Account management is unavailable in this environment (auth is not configured).
          </p>
        )}
      </section>

      {/* Identity binding */}
      <section aria-labelledby="settings-identity" className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2">
          <IdCard className="h-4 w-4 text-white/45" aria-hidden />
          <h2 id="settings-identity" className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Identity binding
          </h2>
        </div>
        {npi ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-white/80">
              This workspace is bound to <span className="font-mono">NPI {npi}</span>
              {name ? <> ({name})</> : null}.
            </p>
            <p className="text-xs leading-relaxed text-white/50">
              Identity fields come from your NPPES registry record at connect time. NPI binding is
              one-to-one with your account; to move an NPI between accounts, contact support so
              ownership can be resolved deliberately.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-white/70">No NPI is connected to this workspace yet.</p>
            <Link
              href="/get-ready"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Connect your NPI <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        )}
      </section>

      {/* Professional profile */}
      <section aria-labelledby="settings-profile" className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-white/45" aria-hidden />
          <h2 id="settings-profile" className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Professional profile
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Career links, resume link, and work authorization are self-attested fields you manage on
          your profile. User-entered information is not verified until source-backed evidence is
          attached.
        </p>
        <Link
          href="/clinician/profile"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
        >
          Open your profile <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>

      {/* Data & sharing */}
      <section aria-labelledby="settings-sharing" className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-white/45" aria-hidden />
          <h2 id="settings-sharing" className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Data &amp; sharing
          </h2>
        </div>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-white/60">
          <li>
            Your passport is shared only through links you create — from your wallet or when you
            apply to a role. Nothing is published without an action you take.
          </li>
          <li>
            Employers you apply to see your readiness packet and the self-attested fields you have
            filled in, each labeled with its provenance.
          </li>
          <li>
            Source checks (NPPES, exclusions, licensure) read public registries; results are
            recorded with receipts you can review on your readiness surface.
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/holder"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
          >
            Your wallet &amp; sharing <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/holder/readiness"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
          >
            Readiness &amp; receipts <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
}

function AccountRow() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <p className="mt-3 animate-pulse text-sm text-white/50" role="status" aria-live="polite">
        Loading account…
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
        <div>
          <p className="text-sm font-medium text-white">{user?.fullName ?? 'Your account'}</p>
          <p className="text-xs text-white/50">{user?.primaryEmailAddress?.emailAddress ?? ''}</p>
        </div>
      </div>
      <SignOutButton redirectUrl="/">
        <button
          type="button"
          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-rose-400/40 hover:text-rose-200"
        >
          Sign out
        </button>
      </SignOutButton>
    </div>
  );
}
