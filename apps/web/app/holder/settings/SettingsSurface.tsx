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
import { PageFrame } from '@/components/layout/PageFrame';

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function SettingsSurface() {
  const { data } = useClinicianMobile();
  const person = data.workspace?.personProfile ?? null;
  const npi = person?.npi ?? null;
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(' ') || null;

  return (
    <PageFrame as="main" mode="product" className="vcv-page-frame--mobile-nav mz mz-paper max-w-3xl flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <div className="mz-inset inline-flex h-11 w-11 items-center justify-center">
          <SettingsIcon className="h-5 w-5" style={{ color: 'var(--ink-700)' }} aria-hidden />
        </div>
        <div>
          <h1 className="mz-h1">Settings</h1>
          <p className="mz-small">Account, identity binding, and sharing.</p>
        </div>
      </header>

      {/* Account (Clerk) */}
      <section aria-labelledby="settings-account" className="mz-card">
        <div className="mz-card-hd">
          <h2 id="settings-account" className="mz-eyebrow">
            Account
          </h2>
        </div>
        <div className="mz-card-pad">
          {clerkEnabled ? <AccountRow /> : (
            <p className="mz-body">
              Account management is unavailable in this environment (auth is not configured).
            </p>
          )}
        </div>
      </section>

      {/* Identity binding */}
      <section aria-labelledby="settings-identity" className="mz-card">
        <div className="mz-card-hd">
          <h2 id="settings-identity" className="mz-eyebrow">
            <IdCard className="h-3.5 w-3.5" aria-hidden />
            Identity binding
          </h2>
        </div>
        <div className="mz-card-pad">
          {npi ? (
            <div className="space-y-2">
              <p className="mz-body">
                This workspace is bound to <span className="mz-mono">NPI {npi}</span>
                {name ? <> ({name})</> : null}.
              </p>
              <p className="mz-small">
                Identity fields come from your NPPES registry record at connect time. NPI binding is
                one-to-one with your account; to move an NPI between accounts, contact support so
                ownership can be resolved deliberately.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="mz-body">No NPI is connected to this workspace yet.</p>
              <Link href="/onboarding" className="mz-btn mz-btn-sm">
                Connect your NPI <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Professional profile */}
      <section aria-labelledby="settings-profile" className="mz-card">
        <div className="mz-card-hd">
          <h2 id="settings-profile" className="mz-eyebrow">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            Professional profile
          </h2>
        </div>
        <div className="mz-card-pad">
          <p className="mz-body">
            Career links, resume link, and work authorization are self-attested fields you manage on
            your profile. User-entered information is not verified until source-backed evidence is
            attached.
          </p>
          <Link href="/clinician/profile" className="mz-btn mz-btn-ghost mz-btn-sm mt-3">
            Open your profile <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Data & sharing */}
      <section aria-labelledby="settings-sharing" className="mz-card">
        <div className="mz-card-hd">
          <h2 id="settings-sharing" className="mz-eyebrow">
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Data &amp; sharing
          </h2>
        </div>
        <div className="mz-card-pad">
          <ul className="mz-body space-y-2">
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
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/holder" className="mz-btn mz-btn-ghost mz-btn-sm">
              Your wallet &amp; sharing <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/holder/readiness" className="mz-btn mz-btn-ghost mz-btn-sm">
              Readiness &amp; receipts <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

function AccountRow() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <p className="mz-small animate-pulse" role="status" aria-live="polite">
        Loading account…
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--ink-900)' }}>
            {user?.fullName ?? 'Your account'}
          </p>
          <p className="mz-small">{user?.primaryEmailAddress?.emailAddress ?? ''}</p>
        </div>
      </div>
      <SignOutButton redirectUrl="/">
        <button type="button" className="mz-btn mz-btn-ghost mz-btn-sm">
          Sign out
        </button>
      </SignOutButton>
    </div>
  );
}
