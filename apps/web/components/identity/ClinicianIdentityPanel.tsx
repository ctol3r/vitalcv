'use client';

/**
 * WAVE-2G — signed-in identity record panel for /clinician/identity.
 *
 * Client island: reads the session + PersonProfile through the same
 * RoleContext the holder surfaces use (no new fetch paths), feeds the
 * pure clinicianIdentitySurface transform, and renders each field with
 * its provenance badge, source label, and change policy. Display-only:
 * no mutations, no auth logic, no new identity flows.
 */

import Link from 'next/link';
import * as React from 'react';
import { useUser } from '@clerk/nextjs';

import { useRoleContext } from '@/components/auth/RoleContext';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import {
  buildClinicianIdentitySurface,
  type ClinicianIdentitySurfaceModel,
  type IdentityChangePolicy,
  type IdentitySurfaceField,
} from '@/lib/identity/clinicianIdentitySurface';
import { PROVENANCE_META } from '@/lib/profile/provenance';
import type { WorkspacePersonProfile } from '@/types/workspace';

const CHANGE_POLICY_LABEL: Record<IdentityChangePolicy, string> = {
  editable_profile: 'You can update this',
  account_managed: 'Managed in account settings',
  source_of_record: 'Requires source-of-record correction',
  not_editable: 'Not editable',
};

function panelClassName(): string {
  return 'mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5';
}

export function ClinicianIdentityPanel() {
  const role = useRoleContext();

  if (!role.isLoaded) {
    return (
      <section aria-busy="true" aria-labelledby="identity-record-heading" className={panelClassName()}>
        <h2 id="identity-record-heading" className="text-base font-semibold sm:text-lg">
          Your identity record
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading your identity record…</p>
      </section>
    );
  }

  const personProfile = role.workspace?.personProfile ?? null;

  if (!CLERK_PROVIDER_ENABLED) {
    return (
      <PanelBody
        isSignedIn={role.isSignedIn}
        accountEmail={null}
        personProfile={personProfile}
        onRefresh={role.refresh}
      />
    );
  }

  return (
    <ClerkEmailBridge
      isSignedIn={role.isSignedIn}
      personProfile={personProfile}
      onRefresh={role.refresh}
    />
  );
}

/**
 * Mounted only when the Clerk provider is enabled, so the useUser hook
 * always runs under ClerkProvider. Supplies the account email; nothing
 * else about auth is read or changed here.
 */
function ClerkEmailBridge(props: {
  isSignedIn: boolean;
  personProfile: WorkspacePersonProfile | null;
  onRefresh: () => Promise<void>;
}) {
  const { user } = useUser();
  return (
    <PanelBody
      isSignedIn={props.isSignedIn}
      accountEmail={user?.primaryEmailAddress?.emailAddress ?? null}
      personProfile={props.personProfile}
      onRefresh={props.onRefresh}
    />
  );
}

/** Exported for static-render tests; not part of the page API. */
export function PanelBody(props: {
  isSignedIn: boolean;
  accountEmail: string | null;
  personProfile: WorkspacePersonProfile | null;
  onRefresh: () => Promise<void>;
}) {
  const model = buildClinicianIdentitySurface({
    isSignedIn: props.isSignedIn,
    accountEmail: props.accountEmail,
    personProfile: props.personProfile,
  });

  if (model.audience === 'signed_out') {
    return (
      <section aria-labelledby="identity-record-heading" className={panelClassName()}>
        <h2 id="identity-record-heading" className="text-base font-semibold sm:text-lg">
          Your identity record
        </h2>
        <GapList model={model} />
        <p className="mt-3 text-xs text-muted-foreground">
          The policy below applies to every account; your own record appears here once you sign in.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="identity-record-heading" className={panelClassName()}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="identity-record-heading" className="text-base font-semibold sm:text-lg">
          Your identity record
        </h2>
        <button
          type="button"
          onClick={() => void props.onRefresh()}
          className="rounded-md border border-[var(--vt-border,_rgba(0,0,0,0.12))] px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          Reload record
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface-muted,_rgba(0,0,0,0.02))] p-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">NPI link status</p>
        <p className="mt-1 font-mono text-sm">{model.bindingStatus}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{model.bindingExplanation}</p>
      </div>

      <GapList model={model} />

      {model.sections.map((section) => (
        <div key={section.id} className="mt-5">
          <h3 className="text-sm font-semibold">{section.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{section.summary}</p>
          <ul className="mt-2 divide-y divide-[var(--vt-border,_rgba(0,0,0,0.06))]">
            {section.fields.map((field) => (
              <FieldRow key={field.id} field={field} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function GapList({ model }: { model: ClinicianIdentitySurfaceModel }) {
  if (model.gaps.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2">
      {model.gaps.map((gap) => (
        <li
          key={gap.id}
          className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm"
        >
          <p className="font-medium">{gap.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{gap.description}</p>
          <Link
            href={gap.href}
            className="mt-2 inline-flex items-center text-xs font-semibold underline underline-offset-4"
          >
            {gap.cta} →
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FieldRow({ field }: { field: IdentitySurfaceField }) {
  const meta = PROVENANCE_META[field.provenance];

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{field.label}</p>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.badgeClass}`}
          aria-label={`Origin: ${meta.label}`}
          title={meta.description}
        >
          {meta.label}
        </span>
      </div>
      <p className="mt-1 font-mono text-sm">{field.value ?? 'Not on file'}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {field.sourceLabel}
        <span className="ml-2 text-muted-foreground/70">({field.confidence})</span>
      </p>
      {field.limitationNote && (
        <p className="mt-1 text-[11px] text-muted-foreground/80">{field.limitationNote}</p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground/80">
        <span className="font-medium">{CHANGE_POLICY_LABEL[field.changePolicy]}.</span>{' '}
        {field.changeNote}
      </p>
    </li>
  );
}
