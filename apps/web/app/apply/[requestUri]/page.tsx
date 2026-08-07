import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { ApplyBundleView } from '@/components/apply/ApplyBundleView';
import { ApplyIntentComposer } from '@/components/apply/ApplyIntentComposer';
import { isValidBundleId } from '@/lib/apply/bundle-id';
import { loadApplyIntent } from '@/lib/server/applyIntent';

export const dynamic = 'force-dynamic';

interface BundleCredential {
  type: string;
  issuer: string;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

interface IssuerProvenance {
  issuerId: string;
  name: string;
  trustScore: number;
}

interface ApplyBundle {
  bundleId: string;
  entityId?: string | null;
  npi: string;
  clinicianName: string;
  trustState: {
    readiness_level: string;
    readiness_score: number;
    readiness_status: string;
    computed_at: string;
  };
  credentials: BundleCredential[];
  issuerProvenance: IssuerProvenance[];
  monitoringStatus: 'active' | 'inactive' | 'partial';
  profileUrl: string;
  generatedAt: string;
  expiresAt: string;
  signature: string;
}

interface Props {
  params: Promise<{ requestUri: string }>;
}

const BACKEND = (
  process.env.BACKEND_URL
  || process.env.NEXT_PUBLIC_API_BASE
  || process.env.NEXT_PUBLIC_BACKEND_URL
  || 'http://localhost:4000'
).replace(/\/$/, '');

function isApplyIntent(value: string): boolean {
  return /^vai_[A-Za-z0-9_-]{20,80}$/.test(value);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { requestUri } = await params;
  if (isApplyIntent(requestUri)) {
    return {
      title: 'Apply with VitalCV',
      description: 'Review an employer request, choose the career evidence to disclose, and hand off an immutable application packet.',
      robots: { index: false },
    };
  }
  return {
    title: 'Credential Bundle',
    description: `Credential bundle ${requestUri} — powered by VitalCV.`,
    robots: { index: false },
  };
}

type BundleResult =
  | { ok: true; bundle: ApplyBundle }
  | { ok: false; reason: 'expired' | 'not_found' | 'error' };

async function fetchBundle(bundleId: string): Promise<BundleResult> {
  try {
    const response = await fetch(`${BACKEND}/api/apply/bundle/${bundleId}`, {
      cache: 'no-store',
    });
    if (response.status === 410) return { ok: false, reason: 'expired' };
    if (response.status === 404) return { ok: false, reason: 'not_found' };
    if (!response.ok) return { ok: false, reason: 'error' };
    const bundle = await response.json() as ApplyBundle;
    if (new Date(bundle.expiresAt) < new Date()) return { ok: false, reason: 'expired' };
    return { ok: true, bundle };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

function BundleErrorView({ reason, retryHref }: { reason: 'expired' | 'error'; retryHref: string }) {
  const messages = {
    expired: {
      symbol: '⏱',
      title: 'This link has expired',
      body: 'Passport links are valid for 24 hours.',
      primaryLabel: 'Return to your passport',
      primaryHref: '/holder',
      secondaryLabel: 'Start a new NPI lookup',
      secondaryHref: '/onboarding',
    },
    error: {
      symbol: '!',
      title: 'Connection interrupted',
      body: 'We could not load this passport right now. Try again in a moment.',
      primaryLabel: 'Try again',
      primaryHref: retryHref,
      secondaryLabel: 'Start a new NPI lookup',
      secondaryHref: '/onboarding',
    },
  } as const;
  const message = messages[reason];
  return (
    <div className="flex min-h-screen items-center justify-center bg-ops-gradient px-4 text-foreground">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="text-5xl" aria-hidden="true">{message.symbol}</div>
        <h1 className="text-xl font-bold text-foreground">{message.title}</h1>
        <p className="text-sm text-muted-foreground">{message.body}</p>
        <div className="flex flex-col gap-2 pt-2">
          <a href={message.primaryHref} className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-muted px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
            {message.primaryLabel}
          </a>
          <a href={message.secondaryHref} className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/6 px-6 text-sm text-foreground/70 transition-colors hover:text-foreground">
            {message.secondaryLabel}
          </a>
        </div>
      </div>
    </div>
  );
}

async function LegacyBundlePage({ bundleId }: { bundleId: string }) {
  if (!isValidBundleId(bundleId)) notFound();
  const result = await fetchBundle(bundleId);
  if (!result.ok) {
    if (result.reason === 'not_found') notFound();
    return <BundleErrorView reason={result.reason} retryHref={`/apply/${bundleId}`} />;
  }
  return <ApplyBundleView bundle={result.bundle} />;
}

function statusMessage(status: 'used' | 'expired') {
  return status === 'used'
    ? 'This application request has already been used. Open your VitalCV applications to review the submitted packet.'
    : 'This application request has expired. Ask the employer for a fresh Apply with VitalCV link.';
}

async function ApplyIntentPage({ requestUri }: { requestUri: string }) {
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
          <Link href="/" className="mt-6 inline-flex items-center gap-2 font-semibold text-indigo-700">
            Return to VitalCV <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
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
                <Icon name="clock" className="h-4 w-4" aria-hidden="true" /> Expires {new Date(intent.expiresAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Icon name="building" className="h-4 w-4" aria-hidden="true" /> {intent.organization.name}
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
              <Icon name="shield" className="h-6 w-6 text-indigo-700" aria-hidden="true" />
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
              <Icon name="file-key" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
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
            <Link href={`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-800">
              Sign in and review <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
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

export default async function ApplyPage({ params }: Props) {
  const { requestUri } = await params;
  return isApplyIntent(requestUri)
    ? <ApplyIntentPage requestUri={requestUri} />
    : <LegacyBundlePage bundleId={requestUri} />;
}
