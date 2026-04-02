import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Start a Pilot — VitalCV',
  description:
    'Start a VitalCV pilot. Source-backed credential verification, employer decision surfaces, and credential readiness scoring for healthcare organizations.',
};

const INCLUDES = [
  'Source-backed verification from NPPES, OIG/LEIE, and PECOS',
  'Employer review decision surface with audit trail',
  'Credential Readiness Score (CRS) — 0–100, deterministic, explainable',
  'Operator diagnostics and source health monitoring',
];

const SCOPE_GUARDS = [
  'We do not claim universal state board coverage — licensure lanes are configured per pilot geography',
  'We do not claim real-time Nursys or FSMB access — institutional agreements are required before activation',
  'We do not replace your credentialing committee — VitalCV provides a verified head start, not a final credentialing decision',
];

export default function PilotPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-3xl font-bold text-foreground">
          Start a Pilot
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          VitalCV reduces clinician time-to-start by replacing repeated verification
          with source-backed, reusable trust. We work with payer credential teams
          and staffing vendors in single-tenant deployments.
        </p>

        {/* What's included */}
        <section className="mt-16">
          <h2 className="text-lg font-semibold text-foreground">
            What pilots include
          </h2>
          <ul className="mt-4 space-y-3">
            {INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Scope guard */}
        <section className="mt-12 rounded-lg border border-border bg-muted/40 px-5 py-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4" />
            Scope boundaries
          </h2>
          <ul className="mt-3 space-y-3">
            {SCOPE_GUARDS.map((item) => (
              <li key={item} className="text-sm text-muted-foreground leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Request form */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-foreground">
            Request access
          </h2>
          <form
            action="/api/pilot-request"
            method="POST"
            className="mt-6 space-y-4"
          >
            <div>
              <label htmlFor="org" className="block text-sm font-medium text-foreground mb-1.5">
                Organization
              </label>
              <input
                id="org"
                name="organization"
                type="text"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                placeholder="Acme Health System"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                Contact name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                placeholder="jane@acmehealth.com"
              />
            </div>
            <div>
              <label htmlFor="usecase" className="block text-sm font-medium text-foreground mb-1.5">
                Tell us about your use case
              </label>
              <textarea
                id="usecase"
                name="usecase"
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                placeholder="What does your credentialing workflow look like today? Where are the biggest delays?"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Submit request
            </button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Or reach us directly at{' '}
            <a href="mailto:pilot@vitalcv.com" className="underline underline-offset-2">
              pilot@vitalcv.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
