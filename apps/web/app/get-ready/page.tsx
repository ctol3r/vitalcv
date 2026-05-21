/**
 * /get-ready -- Canonical entry point for the institutional flow.
 *
 * Single calm landing surface. One primary signal, one primary
 * action. The clinician sees this first; from here they continue
 * to /passport. The receiving institution sees this surface when a
 * pilot brief is being prepared.
 *
 * Read-only. No backend writes, no external API calls. The page
 * exists to give the canonical nav's "Get Ready" item a resolving
 * destination; it does NOT initiate a real exchange.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Get ready · VitalCV',
  description:
    'Start your VitalCV readiness. Federal-source resolution against NPPES, OIG/LEIE, and PECOS. State medical board verification, committee review, and privileging decisions remain institution-owned.',
};

export default function GetReadyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-900 bg-slate-950 px-5 py-6 text-slate-100">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          Step 1 of the canonical flow · Get ready
        </div>
        <h1 className="mt-1 text-2xl font-semibold">Get ready in about two minutes.</h1>
        <p className="mt-3 max-w-[62ch] text-sm text-slate-200">
          Verify your NPI and we resolve federal-source lanes (NPPES,
          OIG / LEIE, PECOS) against the public registries. State
          medical board verification, credentialing committee review,
          and privileging decisions remain on your receiving
          institution&apos;s own cadence.
        </p>
      </header>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
        <section
          data-slot="get-ready-primary-action"
          className="overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-900 text-slate-100"
        >
          <Link
            href="/passport"
            className="flex items-center justify-between gap-4 px-5 py-5 hover:bg-slate-800"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Primary action
              </div>
              <div className="mt-1 text-lg font-semibold">Continue to your passport</div>
              <div className="mt-1 max-w-[52ch] text-sm text-slate-300">
                Your passport carries your federal-source resolution
                and a portable replay envelope per lane.
              </div>
            </div>
            <div aria-hidden className="font-mono text-sm text-slate-300">
              →
            </div>
          </Link>
        </section>

        <section
          data-slot="get-ready-what-happens-next"
          className="overflow-hidden rounded-2xl border border-slate-900 bg-white"
        >
          <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
              What happens next
            </div>
          </header>
          <ul className="list-disc space-y-1 px-8 py-3 text-sm text-slate-700">
            <li>You verify your NPI and we resolve the federal-source lanes.</li>
            <li>
              Your passport shows the lane state plus an operator note
              that travels with each lane.
            </li>
            <li>
              The receiving institution reviews your passport on its
              own credential and cadence.
            </li>
          </ul>
        </section>

        <section
          data-slot="get-ready-institution-owned"
          className="overflow-hidden rounded-2xl border border-slate-900 bg-slate-50"
        >
          <header className="border-b border-slate-900 bg-white px-4 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
              Institution-owned · does not change with this step
            </div>
          </header>
          <ul className="list-disc space-y-1 px-8 py-3 text-sm text-slate-700">
            <li>State medical board verification (the institution&apos;s CVO channel).</li>
            <li>Credentialing committee scheduling and review.</li>
            <li>Privileging decisions.</li>
            <li>Final acceptance for deployment.</li>
          </ul>
        </section>

        <footer className="border-t border-dashed border-slate-300 pt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Canonical flow · Get ready · Passport · Review · Verify · Status
        </footer>
      </div>
    </main>
  );
}
