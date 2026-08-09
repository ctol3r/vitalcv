import * as React from 'react';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PROVENANCE_META, type ProfileProvenance } from '@/lib/profile/provenance';
import { ProfileHeader } from '@/components/clinician/ProfileHeader';
import { ClinicianRecordDetail } from '@/components/clinician-record/ClinicianRecordDetail';
import { loadOwnerRecord } from '@/lib/clinician-record/ownerRecord';
import { OWNER_CONTEXT_NOTE } from '@/lib/clinician-record/copy';

// The header renders a Clerk-backed avatar/name (useUser), so this page can't
// be statically prerendered (no ClerkProvider runtime at build time). Render at
// request time, inside the root ClerkProvider.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clinician Profile',
  description:
    'Your clinician profile. User-entered information is not verified until source-backed evidence is attached.',
};

interface SectionDef {
  key: string;
  title: string;
  fields: ReadonlyArray<{
    label: string;
    provenance: ProfileProvenance;
    /** Guidance shown in the empty slot — what will belong here once editing ships. */
    placeholder: string;
    /** A state readout (e.g. board certification), rendered as a chip, never as a field. */
    status?: true;
  }>;
}

const SECTIONS: ReadonlyArray<SectionDef> = [
  {
    key: 'identity',
    title: 'Identity, contact, locations',
    fields: [
      { label: 'Legal name', provenance: 'USER_ENTERED', placeholder: 'As it appears on government ID' },
      { label: 'NPI', provenance: 'UNKNOWN', placeholder: '10-digit NPI' },
      { label: 'Primary email', provenance: 'USER_ENTERED', placeholder: 'you@example.org' },
      { label: 'Practice locations', provenance: 'USER_ENTERED', placeholder: 'City, state' },
    ],
  },
  {
    key: 'medical_school',
    title: 'Medical school',
    fields: [
      { label: 'Institution', provenance: 'USER_ENTERED', placeholder: 'Medical school name' },
      { label: 'Degree', provenance: 'USER_ENTERED', placeholder: 'MD, DO, MBBS, …' },
      { label: 'Graduation year', provenance: 'USER_ENTERED', placeholder: 'YYYY' },
    ],
  },
  {
    key: 'residency',
    title: 'Residency',
    fields: [
      { label: 'Institution', provenance: 'USER_ENTERED', placeholder: 'Program name' },
      { label: 'Specialty', provenance: 'USER_ENTERED', placeholder: 'e.g., Internal Medicine' },
      { label: 'Years', provenance: 'USER_ENTERED', placeholder: 'YYYY–YYYY' },
    ],
  },
  {
    key: 'fellowship',
    title: 'Fellowship',
    fields: [
      { label: 'Institution', provenance: 'USER_ENTERED', placeholder: 'Program name' },
      { label: 'Specialty', provenance: 'USER_ENTERED', placeholder: 'Subspecialty area' },
      { label: 'Years', provenance: 'USER_ENTERED', placeholder: 'YYYY–YYYY' },
    ],
  },
  {
    key: 'training_programs',
    title: 'Other training programs',
    fields: [
      { label: 'Program', provenance: 'USER_ENTERED', placeholder: 'Name + institution' },
      { label: 'Years', provenance: 'USER_ENTERED', placeholder: 'YYYY–YYYY' },
    ],
  },
  {
    key: 'specialty',
    title: 'Specialty and subspecialty',
    fields: [
      { label: 'Specialty', provenance: 'INFERRED', placeholder: 'NPPES taxonomy or self-attested' },
      { label: 'Subspecialty', provenance: 'USER_ENTERED', placeholder: 'Free-text' },
      { label: 'Board certified', provenance: 'UNKNOWN', placeholder: 'Pending source-backed check', status: true },
    ],
  },
  {
    key: 'state_licensure',
    // State licensure: numbers are self-attested until a state-board source
    // confirms them. Those lanes are not yet source-integrated, so the status
    // field stays UNKNOWN (never VERIFIED) — honest by construction. Add one
    // row per state; the shell shows a single template row.
    title: 'State licensure',
    fields: [
      { label: 'License state', provenance: 'USER_ENTERED', placeholder: 'e.g., California (add one row per state)' },
      { label: 'License number', provenance: 'USER_ENTERED', placeholder: 'State-issued license #' },
      { label: 'License status', provenance: 'UNKNOWN', placeholder: 'Pending state-board source access', status: true },
      { label: 'Expiration', provenance: 'USER_ENTERED', placeholder: 'YYYY-MM-DD' },
    ],
  },
  {
    key: 'current_employer',
    title: 'Current employer',
    fields: [
      { label: 'Employer', provenance: 'USER_ENTERED', placeholder: 'Organization name' },
      { label: 'Title', provenance: 'USER_ENTERED', placeholder: 'Your role' },
      { label: 'Start date', provenance: 'USER_ENTERED', placeholder: 'YYYY-MM-DD' },
    ],
  },
  {
    key: 'employer_history',
    title: 'Employer history',
    fields: [
      { label: 'Employer', provenance: 'USER_ENTERED', placeholder: 'Prior organization' },
      { label: 'Title', provenance: 'USER_ENTERED', placeholder: 'Role' },
      { label: 'Years', provenance: 'USER_ENTERED', placeholder: 'YYYY–YYYY' },
    ],
  },
  {
    key: 'affiliations',
    title: 'Affiliations',
    fields: [
      { label: 'Organization', provenance: 'USER_ENTERED', placeholder: 'Society, association, or board' },
      { label: 'Type', provenance: 'USER_ENTERED', placeholder: 'Privileges, member, …' },
      { label: 'Years', provenance: 'USER_ENTERED', placeholder: 'YYYY–YYYY' },
    ],
  },
  {
    key: 'research',
    title: 'Research',
    fields: [
      { label: 'Topic', provenance: 'USER_ENTERED', placeholder: 'Area of research' },
      { label: 'Role', provenance: 'USER_ENTERED', placeholder: 'PI, co-author, …' },
    ],
  },
  {
    key: 'publications',
    title: 'Publications',
    fields: [
      { label: 'Title', provenance: 'INFERRED', placeholder: 'PubMed import is candidate-grade until source-backed' },
      { label: 'Journal', provenance: 'INFERRED', placeholder: 'PubMed-derived' },
      { label: 'Year', provenance: 'INFERRED', placeholder: 'YYYY' },
    ],
  },
];

function ProvenanceBadge({ provenance }: { provenance: ProfileProvenance }) {
  const meta = PROVENANCE_META[provenance];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.badgeClass}`}
      aria-label={`Provenance: ${meta.label}`}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}

/**
 * The registry record an employer reads about this clinician.
 *
 * Placed ABOVE the self-entered form on purpose. The form is what the
 * clinician controls; this is what the world already says about them, and it
 * is the thing they cannot fix without first being shown it. Every empty
 * state below names its own cause, because "link your NPI" and "CMS was
 * unreachable" need different actions from the clinician — collapsing them
 * into one blank panel tells them nothing they can act on.
 */
function OwnRegistryRecordPending() {
  return (
    <section
      aria-labelledby="own-registry-record-heading"
      aria-busy="true"
      className="space-y-1 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5"
    >
      <h2 id="own-registry-record-heading" className="mz-h2">
        Reading your registry record
      </h2>
      <p className="text-[12px] leading-relaxed text-[var(--ink-600)]">
        Checking what CMS publishes about you.
      </p>
    </section>
  );
}

async function OwnRegistryRecord() {
  const result = await loadOwnerRecord();

  if (result.state === 'ready') {
    return (
      <section
        aria-labelledby="own-registry-record-heading"
        className="space-y-4 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5"
      >
        <div className="space-y-1">
          <h2 id="own-registry-record-heading" className="mz-h2">
            What employers read about you
          </h2>
          <p className="text-[12px] leading-relaxed text-[var(--ink-600)]">
            {OWNER_CONTEXT_NOTE}
          </p>
        </div>
        <ClinicianRecordDetail record={result.record} mode="owner" />
      </section>
    );
  }

  const { heading, body } =
    result.state === 'no_npi'
      ? {
          heading: 'No NPI linked to this account',
          body: 'Link your NPI and your public CMS record will appear here, exactly as an employer reviewing you would read it.',
        }
      : result.state === 'registry_unavailable'
        ? {
            heading: `CMS had no readable record for NPI ${result.npi}`,
            body: 'This may be a temporary CMS outage, or an NPI that is no longer enumerated. Nothing is being hidden — we could not read the registry just now.',
          }
        : {
            heading: 'Could not check your registry record',
            body: 'We could not reach your workspace to find which NPI is linked to this account. That is our problem, not a finding about your record.',
          };

  return (
    <section
      aria-labelledby="own-registry-record-heading"
      className="space-y-1 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5"
    >
      <h2 id="own-registry-record-heading" className="mz-h2">
        {heading}
      </h2>
      <p className="text-[12px] leading-relaxed text-[var(--ink-600)]">{body}</p>
    </section>
  );
}

export default function ClinicianProfilePage() {
  // Foundation shell: sections render as read-only display rows with
  // provenance badges. No client state, no inputs — an element that looks
  // typeable but drops keystrokes is a defect, not a preview, so nothing
  // here renders as a form control until the editing flow actually ships.
  return (
    <div className="mz mz-paper mz-persona-holder min-h-screen">
      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:py-12">
      <ProfileHeader />

      <div
        role="status"
        className="rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-3 text-sm leading-relaxed text-[var(--vt-text-secondary)]"
      >
        <strong className="text-foreground">This profile is read-only for now.</strong>{' '}
        The sections below show the structure of your record and where each
        field&rsquo;s provenance stands; the editing flow has not shipped yet.
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        <strong>User-entered information is not verified until source-backed
        evidence is attached.</strong> Provenance badges show where each field
        stands today.
      </p>

      <div className="space-y-5">
        {/* What the world already says, before what the clinician types.
            Behind Suspense: this reaches out to CMS, and the clinician's own
            form should paint immediately rather than waiting on a third party
            that may be slow or down. */}
        <Suspense fallback={<OwnRegistryRecordPending />}>
          <OwnRegistryRecord />
        </Suspense>

        {/* The "Profile completion summary" (Filled 0/36, Source-backed 0/36)
            was removed here: both numerators were hardcoded zeros, so the
            panel was a fabricated statistic that also contradicted the real
            5-dimension completeness readout on /holder/home. One completeness
            signal, computed from data, lives there. */}
        {SECTIONS.map((section) => (
          <section
            key={section.key}
            aria-labelledby={`section-${section.key}-heading`}
            className="rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5"
          >
            <h2 id={`section-${section.key}-heading`} className="mz-h2">
              {section.title}
            </h2>
            <dl className="mt-3 space-y-3">
              {section.fields.map((field) => {
                const fieldId = `${section.key}-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                return (
                  <div key={fieldId} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex flex-1 items-center gap-2">
                      <dt>
                        <span className="text-sm font-medium">{field.label}</span>
                      </dt>
                      <ProvenanceBadge provenance={field.provenance} />
                    </div>
                    <dd className="flex-1">
                      {field.status ? (
                        <span
                          id={fieldId}
                          aria-describedby={`${fieldId}-help`}
                          className="inline-flex items-center rounded-full border border-[var(--vt-border)] px-3 py-1 text-xs font-medium text-[var(--vt-text-secondary)]"
                        >
                          {field.placeholder}
                        </span>
                      ) : (
                        <p
                          id={fieldId}
                          aria-describedby={`${fieldId}-help`}
                          className="w-full rounded-[3px] border border-dashed border-[var(--vt-border)] px-3 py-2 text-sm italic text-[var(--vt-text-muted)]"
                        >
                          {field.placeholder}
                        </p>
                      )}
                      <p id={`${fieldId}-help`} className="mt-1 text-[11px] text-muted-foreground">
                        {PROVENANCE_META[field.provenance].description}
                      </p>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        This is the foundation shell. Editing flow, source-backed import wiring,
        and verification gating ship in subsequent waves. <strong>User-entered
        information is not verified until source-backed evidence is attached.</strong>
      </p>
      </main>
    </div>
  );
}
