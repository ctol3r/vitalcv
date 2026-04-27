import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Clinician Onboarding · VitalCV',
  description:
    'Begin your VitalCV profile. User-entered information is not verified until source-backed evidence is attached.',
};

const STEPS: ReadonlyArray<{ key: string; title: string; body: string }> = [
  {
    key: 'npi',
    title: '1. Start with your NPI',
    body: 'Enter your 10-digit NPI. We resolve identity from NPPES (the federal source of record). Identity-proofing — government ID and liveness — is on the roadmap and is not yet shipped.',
  },
  {
    key: 'identity',
    title: '2. Confirm identity, contact, locations',
    body: 'Add the contact details and practice locations you want a credentialing reviewer to see. These are user-entered until you attach source-backed evidence.',
  },
  {
    key: 'training',
    title: '3. Add training: medical school, residency, fellowship',
    body: 'Capture each program with institution and dates. Source-backed verification of training programs is a separate step beyond capture.',
  },
  {
    key: 'specialty',
    title: '4. Specialty and subspecialty',
    body: 'Pick the taxonomy you practice under. NPPES inference may pre-fill a specialty; board certification still needs source-backed evidence.',
  },
  {
    key: 'work',
    title: '5. Current employer and history',
    body: 'List your current role and prior positions. Employer-side confirmation is a separate verification path.',
  },
  {
    key: 'research',
    title: '6. Research and publications',
    body: 'Manually add or import (PubMed, LinkedIn, Doximity). Imported entries remain candidates until a source-of-record check upgrades them.',
  },
];

export default function ClinicianOnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Clinician onboarding
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Build your source-backed credential record
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Onboarding lays out the sections of your profile in order. Filling fields
          improves your dashboard view; verification still requires source-backed
          evidence to be attached. <strong>User-entered information is not verified
          until source-backed evidence is attached.</strong>
        </p>
      </header>

      <ol aria-label="Onboarding steps" className="space-y-4">
        {STEPS.map((step) => (
          <li
            key={step.key}
            className="rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
          >
            <h2 className="text-base font-semibold sm:text-lg">{step.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <nav aria-label="Continue" className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/clinician/profile"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-foreground/10 bg-foreground px-5 text-sm font-medium text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          Open profile
        </Link>
        <Link
          href="/clinician/import"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-foreground/10 px-5 text-sm font-medium hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          Import from existing sources
        </Link>
      </nav>
    </main>
  );
}
