import Link from 'next/link';
import { ShieldCheck, Clock, Building2, FileCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Verify Once',
    description:
      'Primary source verification runs against authoritative databases. License status, sanctions, education — checked at the source.',
  },
  {
    number: '02',
    title: 'Trust Propagates',
    description:
      'Verification results produce cryptographic receipts. Each employer inherits proof without re-running checks.',
  },
  {
    number: '03',
    title: 'Start with Confidence',
    description:
      'The canonical path (Recognition, Acceptance, Start) enforces that no clinician begins work without complete verification.',
  },
];

const complianceItems = [
  'NCQA credentialing standards',
  'CMS Conditions of Participation',
  'Joint Commission requirements',
  'State medical board regulations',
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-700" />
            <span className="text-lg font-bold text-slate-900">VitalCV</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/holder"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Clinician Lookup
            </Link>
            <Link
              href="/sign-in"
              className="text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/verifier"
              className="text-sm font-semibold bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors"
            >
              Verifier Console
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl leading-tight">
            Clinician credentialing that verifies once and trusts everywhere
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-2xl sm:text-xl sm:leading-relaxed">
            VitalCV replaces redundant verification cycles with
            cryptographic proof. One primary source check creates a
            reusable trust signal across every employer in the network.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <Link
              href="/verifier"
              className="inline-flex items-center gap-2 bg-blue-700 text-white font-semibold px-6 py-3 rounded-md hover:bg-blue-800 transition-colors"
            >
              Open Verifier Console
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/holder"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-500 transition-colors"
            >
              Check a clinician
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Time Saved</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">Days to Hours</p>
            <p className="text-sm text-slate-500">Per credentialing cycle</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Portability</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">Verify Once</p>
            <p className="text-sm text-slate-500">Reuse across employers</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <FileCheck className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Audit Trail</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">Every Event</p>
            <p className="text-sm text-slate-500">Timestamped and hashed</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Trust Decay</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">Automatic</p>
            <p className="text-sm text-slate-500">Expired credentials flagged</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          How it works
        </h2>
        <p className="mt-4 text-lg text-slate-500 max-w-2xl">
          Three steps from initial verification to employment start. Each transition is
          enforced, audited, and irreversible.
        </p>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <span className="text-5xl font-bold text-slate-100">{step.number}</span>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-3 text-base text-slate-500 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Built for compliance
              </h2>
              <p className="mt-4 text-lg text-slate-300 leading-relaxed">
                VitalCV enforces the canonical path required by accreditation
                bodies. No credential is accepted without primary source
                verification. No clinician starts without employer attestation.
              </p>
            </div>
            <div>
              <ul className="space-y-4">
                {complianceItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Ready to eliminate redundant credentialing?
        </h2>
        <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
          Start verifying clinicians today. No integration required for
          your first lookup.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/verifier"
            className="inline-flex items-center gap-2 bg-blue-700 text-white font-semibold px-6 py-3 rounded-md hover:bg-blue-800 transition-colors"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-500">VitalCV</span>
          </div>
          <p className="text-xs text-slate-400">
            Trust infrastructure for healthcare credentialing
          </p>
        </div>
      </footer>
    </main>
  );
}
