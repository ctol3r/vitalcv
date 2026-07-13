'use client';

/**
 * ProfileHeader — LinkedIn/Doximity-style identity header for the clinician
 * profile. The photo + name come from Clerk (the user's real, hosted account
 * avatar — no blob storage needed); specialty / state / NPI come from the
 * clinician workspace (/api/me/workspaces). "Change photo" opens the Clerk
 * account modal where the avatar actually lives.
 *
 * Client component on purpose: the profile page itself is a SYNC server
 * component (a render test mounts it synchronously), so all Clerk/user data is
 * read here, client-side, and degrades to a calm placeholder for signed-out
 * viewers and in tests.
 *
 * Truth contract: identity shown here is self-entered / account-derived, not
 * source-verified. The page keeps the full honesty language and provenance
 * badges below.
 */

import * as React from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { Camera, MapPin, Stethoscope } from 'lucide-react';

interface PersonProfile {
  npi?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  specialty?: string | null;
  stateOfPractice?: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'VC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileHeader() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const [profile, setProfile] = React.useState<PersonProfile | null>(null);

  React.useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/me/workspaces', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setProfile(data?.personProfile ?? null);
      } catch {
        /* best-effort — header still renders from Clerk data */
      }
    })();
    return () => { alive = false; };
  }, [isSignedIn]);

  const clerkName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const profileName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  const name = (profileName || clerkName || '').trim() || 'Your profile';
  const specialty = profile?.specialty?.trim() || null;
  const state = profile?.stateOfPractice?.trim() || null;
  const npi = profile?.npi?.trim() || null;
  const imageUrl = user?.imageUrl && !user.imageUrl.includes('gravatar') ? user.imageUrl : null;

  const headlineParts = [specialty ?? 'Clinician', state ? `${state}` : null].filter(Boolean);

  return (
    <section
      aria-label="Profile header"
      className="overflow-hidden rounded-2xl border border-[var(--vt-border,rgba(0,0,0,0.08))] bg-[var(--vt-surface,white)]"
    >
      {/* cover band */}
      <div
        className="h-24 w-full sm:h-28"
        style={{ background: 'linear-gradient(120deg, var(--vt-brand-soft, #eef1ee), color-mix(in oklab, var(--vt-accent, #4f46e5) 12%, transparent))' }}
        aria-hidden="true"
      />

      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
            {/* avatar */}
            <div className="relative">
              <div className="h-20 w-20 overflow-hidden rounded-full ring-4 ring-[var(--vt-surface,white)] sm:h-24 sm:w-24 bg-[var(--vt-surface-subtle,#eee)]">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--vt-brand-soft,#eef1ee)] text-2xl font-semibold text-[var(--vt-text-secondary,#555)]">
                    {initials(name)}
                  </div>
                )}
              </div>
              {isLoaded && isSignedIn ? (
                <button
                  type="button"
                  onClick={() => clerk.openUserProfile()}
                  title="Change photo"
                  aria-label="Change profile photo"
                  className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--vt-border,rgba(0,0,0,0.1))] bg-[var(--vt-surface,white)] text-[var(--vt-text-secondary,#555)] shadow-sm transition hover:text-[var(--vt-text-primary,#111)]"
                >
                  <Camera size={15} aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {/* name + headline */}
            <div className="pb-1">
              <h1 className="text-xl font-semibold leading-tight text-[var(--vt-text-primary)] sm:text-2xl">{name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--vt-text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <Stethoscope size={14} aria-hidden="true" />
                  {headlineParts[0]}
                </span>
                {state ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} aria-hidden="true" />
                    {state}
                  </span>
                ) : null}
                {npi ? (
                  <span className="font-mono text-xs text-[var(--vt-text-muted,#777)]">NPI {npi}</span>
                ) : null}
              </p>
            </div>
          </div>

          {/* manage-in-account affordance */}
          {isLoaded && isSignedIn ? (
            <button
              type="button"
              onClick={() => clerk.openUserProfile()}
              className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--vt-border,rgba(0,0,0,0.12))] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-secondary)] transition hover:text-[var(--vt-text-primary)] sm:self-auto"
            >
              <Camera size={13} aria-hidden="true" />
              Edit photo &amp; name
            </button>
          ) : null}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-[var(--vt-text-muted,#777)]">
          Photo and name are synced from your account. Everything below is self-entered
          and is <strong>not verified until source-backed evidence is attached.</strong>
        </p>
      </div>
    </section>
  );
}
