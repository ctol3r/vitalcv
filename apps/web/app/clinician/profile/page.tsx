import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PROVENANCE_META, type ProfileProvenance } from '@/lib/profile/provenance';

export const metadata: Metadata = {
  title: 'Clinician Profile · VitalCV',
  description:
    'Your clinician profile. User-entered information is not verified until source-backed evidence is attached.',
};

interface SectionDef {
  key: string;
  title: string;
  fields: ReadonlyArray<{ label: string; provenance: ProfileProvenance; placeholder: string }>;
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
      { label: 'Institution', provenance: 'USER_ENTERED', placeholder: 'School name' },
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
      { label: 'Organization', provenance: 'USER_ENTERED', placeholder: 'Hospital, society, etc.' },
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
  // Preview-only surface: the page enumerates the planned profile
  // sections and the provenance class each field will carry once
  // editing ships. It has no form state, no submit handler, no fetch,
  // and no localStorage. Read-only display rows replace the editable
  // form chrome that used to live here so the page cannot be
  // mistaken for an editable record.
  const totalFields = SECTIONS.reduce((s, sec) => s + sec.fields.length, 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Clinician profile
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Your credential record
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>User-entered information is not verified until source-backed
          evidence is attached.</strong> Provenance badges show the class each
          field will carry once editing ships.
        </p>

        <aside
          role="status"
          data-testid="clinician-profile-preview-banner"
          aria-labelledby="profile-preview-banner-heading"
          className="mt-5 rounded-xl border border-amber-200/60 bg-amber-50 p-4 text-amber-900 sm:p-5"
        >
          <h2 id="profile-preview-banner-heading" className="text-sm font-semibold">
            Preview only
          </h2>
          <p className="mt-1 text-sm">
            Profile editing is not enabled on this preview page yet. Use
            onboarding to start a readiness preview.
          </p>
          <p className="mt-2 text-sm">
            <Link
              href="/clinician/onboarding"
              className="font-medium underline underline-offset-2"
              data-testid="clinician-profile-onboarding-link"
            >
              Go to clinician onboarding →
            </Link>
          </p>
        </aside>

        <section
          aria-labelledby="profile-shape-heading"
          className="mt-5 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
        >
          <h2 id="profile-shape-heading" className="text-sm font-semibold">
            Profile shape
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Sections</dt>
              <dd className="mt-1 font-mono">{SECTIONS.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Planned fields</dt>
              <dd className="mt-1 font-mono">{totalFields}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Editable here</dt>
              <dd className="mt-1 text-muted-foreground">None — use onboarding.</dd>
            </div>
          </dl>
        </section>
      </header>

      <div className="space-y-5">
        {SECTIONS.map((section) => (
          <section
            key={section.key}
            aria-labelledby={`section-${section.key}-heading`}
            className="rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
          >
            <h2 id={`section-${section.key}-heading`} className="text-base font-semibold sm:text-lg">
              {section.title}
            </h2>
            <dl className="mt-3 space-y-3">
              {section.fields.map((field) => {
                const fieldId = `${section.key}-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                return (
                  <div
                    key={fieldId}
                    data-testid="clinician-profile-field-row"
                    className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="flex flex-1 items-center gap-2">
                      <dt className="text-sm font-medium" id={`${fieldId}-label`}>
                        {field.label}
                      </dt>
                      <ProvenanceBadge provenance={field.provenance} />
                    </div>
                    <dd className="flex-1" aria-labelledby={`${fieldId}-label`}>
                      <p className="text-sm italic text-muted-foreground">
                        {field.placeholder}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
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
        This is the preview shell. Editing flow, source-backed import wiring,
        and verification gating ship in subsequent waves. <strong>User-entered
        information is not verified until source-backed evidence is attached.</strong>
      </p>
    </main>
  );
}
