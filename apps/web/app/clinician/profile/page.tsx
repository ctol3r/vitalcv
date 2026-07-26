import * as React from 'react';
import type { Metadata } from 'next';
import { PROVENANCE_META, type ProfileProvenance } from '@/lib/profile/provenance';
import { ProfileHeader } from '@/components/clinician/ProfileHeader';
import { InstitutionAutocomplete } from '@/components/clinician/InstitutionAutocomplete';
import type { InstitutionKind } from '@/lib/institutions/curated';

// The header renders a Clerk-backed avatar/name (useUser), so this page can't
// be statically prerendered (no ClerkProvider runtime at build time). Render at
// request time, inside the root ClerkProvider.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clinician Profile · VitalCV',
  description:
    'Your clinician profile. User-entered information is not verified until source-backed evidence is attached.',
};

interface SectionDef {
  key: string;
  title: string;
  fields: ReadonlyArray<{
    label: string;
    provenance: ProfileProvenance;
    placeholder: string;
    // When set, the field is a typeahead over the curated institution directory
    // (lib/institutions/curated.ts), scoped to these kinds.
    kinds?: InstitutionKind[];
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
      { label: 'Institution', provenance: 'USER_ENTERED', placeholder: 'Search medical schools…', kinds: ['med_school_md', 'med_school_do'] },
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
      { label: 'Board certified', provenance: 'UNKNOWN', placeholder: 'Pending source-backed check' },
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
      { label: 'License status', provenance: 'UNKNOWN', placeholder: 'Pending state-board source access' },
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
      { label: 'Organization', provenance: 'USER_ENTERED', placeholder: 'Search societies, boards, associations…', kinds: ['society', 'association', 'board', 'honor_society'] },
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

export default function ClinicianProfilePage() {
  // Foundation shell: sections render with placeholders and provenance
  // badges. No client state. Filled-ness summary is computed below from
  // the static defs (everything is currently empty / unknown).
  const totalFields = SECTIONS.reduce((s, sec) => s + sec.fields.length, 0);
  const filledFields = 0;
  const sourceBackedFields = 0;
  const completionPercent = totalFields === 0 ? 0 : Math.round((filledFields / totalFields) * 100);

  return (
    <div className="mz mz-paper mz-persona-holder min-h-screen">
      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:py-12">
      <ProfileHeader />

      <p className="text-sm leading-relaxed text-muted-foreground">
        <strong>User-entered information is not verified until source-backed
        evidence is attached.</strong> Provenance badges show where each field
        stands today.
      </p>

      <div className="space-y-5">
        <section
          aria-labelledby="completion-summary-heading"
          className="rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5"
        >
          <h2 id="completion-summary-heading" className="text-sm font-semibold">
            Profile completion summary
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Filled</dt>
              <dd className="mt-1 font-mono">
                {filledFields} / {totalFields} ({completionPercent}%)
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Source-backed</dt>
              <dd className="mt-1 font-mono">{sourceBackedFields} / {totalFields}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Verified credentialing</dt>
              <dd className="mt-1 text-muted-foreground">Not asserted by completion alone.</dd>
            </div>
          </dl>
        </section>

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
                        <label htmlFor={fieldId} className="text-sm font-medium">
                          {field.label}
                        </label>
                      </dt>
                      <ProvenanceBadge provenance={field.provenance} />
                    </div>
                    <dd className="flex-1">
                      {field.kinds ? (
                        <InstitutionAutocomplete
                          id={fieldId}
                          kinds={field.kinds}
                          placeholder={field.placeholder}
                          ariaDescribedBy={`${fieldId}-help`}
                        />
                      ) : (
                        <input
                          id={fieldId}
                          type="text"
                          readOnly
                          placeholder={field.placeholder}
                          aria-describedby={`${fieldId}-help`}
                          className="w-full rounded-[3px] border border-[var(--vt-border)] bg-transparent px-3 py-2 text-sm placeholder:text-[var(--vt-text-muted)] focus:outline-none focus:ring-2 focus:ring-offset-2"
                        />
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
