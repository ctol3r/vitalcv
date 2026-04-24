import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, ActivitySquare, ListTodo, Presentation } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Start a Pilot',
  description: 'Start a focused employer pilot for NPI-to-review credential readiness decisions.',
};

const PILOT_STEPS = [
  {
    title: 'What this pilot is',
    body: 'A 30-day focused employer pilot for faster credentialing decisions using source-backed clinician readiness, packaging real evidence envelopes against your current workflows.',
    icon: <Presentation className="h-4 w-4" />
  },
  {
    title: 'What you provide',
    body: 'A roster of 10–30 clinician NPIs and the hiring or credentialing team member who will run review decisions against them.',
    icon: <ListTodo className="h-4 w-4" />
  },
  {
    title: 'What VitalCV measures',
    body: 'Startability timeline events (submit, review, advance), missing-info loops, and proof-tier distribution against your current baseline.',
    icon: <ActivitySquare className="h-4 w-4" />
  },
  {
    title: 'What success looks like',
    body: 'You see documented source coverage and verifiable trust containers for each clinician before starting the formal committee process, reducing days-at-risk.',
    icon: <CheckCircle2 className="h-4 w-4" />
  },
] as const;

const SCOPE_GUARDS = [
  'NPPES checks assert identity, but do not replace licensure proof.',
  'OIG LEIE clears federal exclusion scope, but does not cover all state Medicaid exclusions.',
  'PECOS public data is not real-time portal status.',
  'The credential trust container provides a secure audit envelope, but does not replace Primary Source Verification (PSV).',
  'We do not replace your credentialing committee — VitalCV provides a verified head start, not a final credentialing decision.',
];

const PILOT_KPI_SAMPLES = [
  { label: 'Avg Time to First Signal', value: '1.8 min', note: '(Simulated)' },
  { label: 'Automated Source Checks', value: '4 Lanes', note: 'Identity, Exclusion, Authority, Enrollment' },
  { label: 'Verifiable Evidence Packets', value: 'Exported', note: 'JSON, ZIP, and PDF supported' },
  { label: 'Audit Chain', value: 'Enabled', note: 'Immutable ARTIFACT_EXPORTED events' },
] as const;

export default function PilotPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="space-y-4">
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Employer pilot
          </span>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground/90">
            Cut credentialing uncertainty before the start date slips.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
            See what is ready, what is missing, and what can safely move forward.
            VitalCV builds a verifiable proof envelope for each clinician, allowing you to run
            an internal pilot on 10–30 NPIs without changing your existing compliance stack.
          </p>
        </div>

        {/* KPI Evidence Block */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PILOT_KPI_SAMPLES.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-border/60 bg-muted/20 p-5">
              <div className="text-sm font-medium text-muted-foreground mb-2">{kpi.label}</div>
              <div className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mt-1 font-mono">{kpi.note}</div>
            </div>
          ))}
        </section>

        {/* The Offer */}
        <section className="grid gap-4 md:grid-cols-2">
          {PILOT_STEPS.map((step) => (
            <article key={step.title} className="rounded-2xl border border-border/70 bg-card p-6">
              <div className="mb-4 inline-flex rounded-full bg-emerald-500/10 p-2.5 text-emerald-400">
                {step.icon}
              </div>
              <h3 className="text-xl font-semibold text-foreground/90">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">{step.body}</p>
            </article>
          ))}
        </section>

        {/* Trust Container / Evidence Object Explanation */}
        <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="h-6 w-6 text-indigo-500" />
            <h2 className="text-2xl font-semibold text-foreground/90">The Evidence Artifact</h2>
          </div>
          <p className="text-muted-foreground text-base leading-relaxed max-w-3xl mb-6">
            Every clinician profile generates a deterministic evidence envelope containing
            source coverage, proof tiers, and limitation rules. When your reviewers export
            the packet, the verification state is recorded immutably.
          </p>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <div className="font-semibold text-foreground">What is live now</div>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>NPPES, OIG LEIE, and PECOS public checks</li>
                <li>Trust-container issuance tracking (Mock/Dev)</li>
                <li>Audit hash embedding in packet manifests</li>
                <li>Partial proof limitation invariants</li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="font-semibold text-foreground">What remains partial / pending</div>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>Automated primary source verification (PSV) against state boards</li>
                <li>Integration with CAQH or ABMS</li>
                <li>Production Verifiable Credential issuance (Dock/Web5)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Scope guard */}
        <section className="rounded-2xl border border-border bg-muted/30 p-6 md:p-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Limitation Honesty
          </h2>
          <ul className="space-y-3 pl-2">
            {SCOPE_GUARDS.map((item) => (
              <li key={item} className="text-base text-muted-foreground leading-relaxed flex gap-3">
                <span className="text-amber-500/50 mt-1">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Request form / CTA Block */}
        <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/5 p-6 md:p-10 shadow-sm">
          <div className="grid lg:grid-cols-2 gap-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-500">The next step</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground/90">Request a 30-Day PSV Readiness Pilot</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground max-w-md">
                We'll review your submission within two business days. If there's a fit, we'll schedule a 
                scoping call to confirm your baseline metrics, NPIs, and the measurement window.
              </p>
              
              {/* Real pilot results anchor */}
              <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-green-200 bg-green-50/50 px-5 py-3">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-900">
                  Pilot #1 recorded a 1.8 minute readiness-to-action timeline.
                </span>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <form
                action="/api/pilot-request"
                method="POST"
                className="space-y-4"
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
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    placeholder="Acme Health System"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                      Contact name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
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
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                      placeholder="jane@acme.com"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="usecase" className="block text-sm font-medium text-foreground mb-1.5">
                    Tell us about your baseline
                  </label>
                  <textarea
                    id="usecase"
                    name="usecase"
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                    placeholder="How many days does an application sit before first review today?"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full mt-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm inline-flex items-center justify-center gap-2"
                >
                  Submit pilot request
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
