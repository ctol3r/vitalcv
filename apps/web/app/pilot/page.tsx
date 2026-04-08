import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Start a Pilot',
  description: 'Start a focused employer pilot for NPI-to-review credential readiness decisions.',
  alternates: { canonical: 'https://vitalcv.com/pilot' },
};

const PILOT_STEPS = [
  {
    title: 'What this pilot is',
    body: 'A focused employer pilot for faster credentialing decisions using source-backed clinician readiness and passport review.',
  },
  {
    title: 'What you provide',
    body: 'A real clinician NPI and the hiring or credentialing team member who will run review decisions.',
  },
  {
    title: 'What VitalCV does',
    body: 'Runs NPI-linked readiness checks, assembles the current passport packet, and opens employer review actions with audit context.',
  },
  {
    title: 'What success looks like',
    body: 'Your team can move from NPI to a documented review decision with less manual back-and-forth and no inflated source claims.',
  },
] as const;

const SCOPE_GUARDS = [
  'We do not claim universal state board coverage — licensure lanes are configured per pilot geography',
  'We do not claim real-time Nursys or FSMB access — institutional agreements are required before activation',
  'We do not replace your credentialing committee — VitalCV provides a verified head start, not a final credentialing decision',
];

export default function PilotPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="space-y-4">
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Employer pilot
          </span>
          <h1 className="text-4xl font-semibold tracking-tight">
            Start a focused pilot: NPI to readiness, passport, and review.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            This is the buyer entry for healthcare employers, credentialing teams, and recruiting operators.
            Scope stays narrow to what is shipping today: source-backed readiness where available, explicit
            pending coverage where not, and one review workflow.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {PILOT_STEPS.map((step) => (
            <article key={step.title} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="mb-3 inline-flex rounded-full bg-emerald-500/10 p-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">One next step</p>
          <h2 className="mt-2 text-2xl font-semibold">Request pilot review setup</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Use a clinician NPI to create a review context and start the pilot motion immediately.
            If you already have a shared passport link, you can open employer review directly.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/review/request"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Request review
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/review"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Open review entry
            </Link>
          </div>
        </section>

        {/* Scope guard */}
        <section className="rounded-lg border border-border bg-muted/40 px-5 py-5">
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
        <section>
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
    </main>
  );
}
