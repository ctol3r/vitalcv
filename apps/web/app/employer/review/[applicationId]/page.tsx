/**
 * WAVE 242A — application-context-aware employer review page.
 *
 * Today, applicationId at this route === bundleId at the backend. We
 * resolve the context server-side via resolveEmployerApplicationContext
 * and render the truthful snapshot summary (proof tier, included vs
 * omitted lanes, limitations, blocker ownership, progress stage).
 *
 * We never duplicate ReviewClient — when a canonical entityId is known,
 * we provide a prominent deep link into the full /review/[entityId]
 * surface where full action affordances live. The stub never silently
 * upgrades a partial packet into a decision-grade one.
 */
import React from 'react';
import Link from 'next/link';
import { ApplicationSnapshotCard } from '@/components/apply/ApplicationSnapshotCard';
import { resolveEmployerApplicationContext } from '@/lib/apply/resolve-employer-application-context';

const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');

interface Props {
  params: Promise<{ applicationId: string }>;
}

export default async function EmployerReviewPage({ params }: Props) {
  const { applicationId } = await params;
  const result = await resolveEmployerApplicationContext({
    applicationId,
    backendUrl: BACKEND,
  });

  if (!result.ok) {
    return <UnresolvedApplicationView applicationId={applicationId} reason={result.reason} />;
  }

  const { context } = result;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Employer review · application context
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground truncate">
              {context.clinicianName}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              NPI {context.npi} · Application {context.applicationId}
            </p>
          </div>
          {context.canonicalReviewHref ? (
            <Link
              href={context.canonicalReviewHref}
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90"
              data-testid="canonical-review-link"
            >
              Open full review surface →
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <ApplicationSnapshotCard
          summary={context.summary}
          eyebrow={`Shared ${formatDate(context.summary.submittedAt)}`}
        />

        <section className="rounded-2xl border border-border bg-[var(--vt-surface-dim)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            What you can do from here
          </p>
          <ul className="space-y-2 text-sm text-foreground">
            <li>
              <span className="font-medium">Read the snapshot above</span> — it
              shows exactly which lanes are covered and which remain the
              employer&apos;s responsibility.
            </li>
            <li>
              {context.canonicalReviewHref ? (
                <>
                  <span className="font-medium">Open the full review surface</span>{' '}
                  to take action (accept, refresh, route to reviewer, pause,
                  reject). Every action writes an audit record.
                </>
              ) : (
                <>
                  <span className="font-medium">Contact the clinician</span> for
                  a newer share — this packet has no canonical passport anchor
                  yet, so no head-start can be recorded against it.
                </>
              )}
            </li>
            <li>
              Packet expires {formatDate(context.expiresAt)}; the clinician can
              re-share at any time.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function UnresolvedApplicationView({
  applicationId,
  reason,
}: {
  applicationId: string;
  reason: 'expired' | 'not_found' | 'error';
}) {
  const copy = {
    expired: {
      title: 'This application link has expired',
      body: 'Apply-with-VitalCV packets are time-boxed. Ask the clinician to share a fresh packet.',
    },
    not_found: {
      title: 'Application not found',
      body: 'This applicationId does not resolve to an active share. The link may have been revoked.',
    },
    error: {
      title: 'We could not load this application',
      body: 'The backend did not respond in time. Try again in a moment — no review action has been recorded.',
    },
  }[reason];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center space-y-3">
        <p
          data-testid="unresolved-reason"
          className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
        >
          {reason}
        </p>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        <p className="pt-3 text-xs text-muted-foreground/70 font-mono">
          Application ID: {applicationId}
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
