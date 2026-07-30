import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, Clock3, FileKey2, ShieldCheck } from 'lucide-react';

import { ApplyIntentComposer } from '@/components/apply/ApplyIntentComposer';
import { loadApplyIntent } from '@/lib/server/applyIntent';

export const metadata: Metadata = {
  title: 'Apply with VitalCV',
  description: 'Review an employer request, choose the career evidence to disclose, and hand off an immutable application packet.',
};

export const dynamic = 'force-dynamic';

function statusMessage(status: 'used' | 'expired') {
  return status === 'used'
    ? 'This application request has already been used. Open your VitalCV applications to review the submitted packet.'
    : 'This application request has expired. Ask the employer for a fresh Apply with VitalCV link.';
}

export default async function ApplyIntentPage({
  params,
}: {
  params: Promise<{ requestUri: string }>;
}) {
  const { requestUri } = await params;
  const result = await loadApplyIntent(requestUri);

  if (result.status !== 'ok') {
    return (
      <main className="min-h-screen bg-[#f7f5f0] px-4 py-16 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Apply with VitalCV</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {result.status === 'not_found' ? 'Application request not found' : 'Application request unavailable'}
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {result.status === 'not_found'
              ? 'The link may be incomplete, revoked, or no longer available.'
              : result.message}
          </p>
          <Link href="/explore" className="mt-6 inline-flex items-center gap-2 font-semibold text-indigo-700">
            Explore opportunities <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  const intent = result.data;
  const unavailable = intent.status !== 'ready';
  const redirectPath = `/apply/${encodeURIComponent(requestUri)}`;

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-4 py-8 text-slate-950 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[#ece9e1] px-6 py-4 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Apply with VitalCV</p>
              <p className="flex items-center gap-2 text-xs text-slate-600">
                <Clock3 className="h-4 w-4" aria-hidden="true" /> Expires {new Date(intent.expiresAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Building2 className="h-4 w-4" aria-hidden="true" /> {intent.organization.name}
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
                {intent.opportunity.title}
              </h1>
              <p className="mt-3 text-base text-slate-600">
                {intent.opportunity.specialty} · {intent.opportunity.state}
              </p>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-700">
                {intent.organization.name} is asking you to present selected career evidence for {intent.purpose}. You will see the exact fields, source labels, observation times, and limitations before anything is shared.
              </p>
            </div>
            <aside className="rounded-[26px] border border-indigo-200 bg-indigo-50 p-5">
              <ShieldCheck className="h-6 w-6 text-indigo-700" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold">One consented packet</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Your packet is sealed to this employer, this opportunity version, and your first-class consent grant. Delivery is recorded separately from employer review.
              </p>
            </aside>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Application sequence">
          {[
            ['1', 'Review request', 'See the exact employer, role, purpose, and requested scope.'],
            ['2', 'Choose evidence', 'Keep identity and select the optional sections you authorize.'],
            ['3', 'Receive receipt', 'VitalCV seals the packet and records each handoff attempt.'],
          ].map(([number, title, detail]) => (
            <article key={number} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">{number}</span>
              <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
            </article>
          ))}
        </section>

        {unavailable ? (
          <section className="rounded-[28px] border border-amber-300 bg-amber-50 p-6 text-amber-950">
            <div className="flex items-start gap-3">
              <FileKey2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">This request is no longer open</h2>
                <p className="mt-2 text-sm leading-6">{statusMessage(intent.status as 'used' | 'expired')}</p>
              </div>
            </div>
          </section>
        ) : result.authenticated ? (
          <ApplyIntentComposer requestUri={requestUri} initialIntent={intent} />
        ) : (
          <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Continue securely</p>
            <h2 className="mt-2 text-2xl font-semibold">Sign in to review your evidence</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              The employer request is public to anyone holding this opaque link. Your clinician profile and evidence remain private until a verified session loads your preview.
            </p>
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-800"
            >
              Sign in and review <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        )}

        <footer className="rounded-[24px] border border-slate-200 bg-white/70 p-5 text-sm leading-6 text-slate-600">
          VitalCV does not replace employer credentialing, privileging, hiring decisions, or start authorization. It preserves what you consented to share and gives the employer a source-attributed head start.
        </footer>
      </div>
    </main>
  );
}
