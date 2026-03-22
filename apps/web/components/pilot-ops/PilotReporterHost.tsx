'use client';

import { useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useRoleContext } from '@/components/auth/RoleContext';
import {
  currentPilotContext,
  inferPilotEntity,
  pilotReporterOpenEventName,
  submitPilotFeedback,
  type PilotReporterKind,
  type PilotReporterOpenOptions,
  type PilotReporterType,
} from '@/lib/pilot-ops/client';

const SCORE_LABELS: Record<number, string> = {
  0: 'Terrible',
  1: 'Very bad',
  2: 'Bad',
  3: 'Poor',
  4: 'Below average',
  5: 'Average',
  6: 'Okay',
  7: 'Good',
  8: 'Great',
  9: 'Very good',
  10: 'Excellent',
};

function defaultType(kind: PilotReporterKind): PilotReporterType {
  if (kind === 'feedback') {
    return 'nps';
  }
  return 'bug';
}

function requiresMessage(kind: PilotReporterKind, type: PilotReporterType): boolean {
  return kind !== 'feedback' || type !== 'nps';
}

function scoreTone(score: number): string {
  if (score <= 3) {
    return 'bg-rose-500 text-white';
  }
  if (score <= 6) {
    return 'bg-amber-400 text-black';
  }
  return 'bg-emerald-500 text-white';
}

function modalTitle(kind: PilotReporterKind, customTitle: string | null | undefined): string {
  if (customTitle && customTitle.trim().length > 0) {
    return customTitle;
  }
  if (kind === 'support') {
    return 'Contact support';
  }
  if (kind === 'issue') {
    return 'Report an issue';
  }
  return 'Send feedback';
}

function submitLabel(kind: PilotReporterKind): string {
  if (kind === 'support') {
    return 'Send support request';
  }
  if (kind === 'issue') {
    return 'Report issue';
  }
  return 'Submit feedback';
}

function pathSegment(pathname: string, index: number): string | null {
  const segments = pathname.split('/').filter(Boolean);
  return segments[index] ?? null;
}

export function PilotReporterHost() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const roleContext = useRoleContext();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PilotReporterKind>('feedback');
  const [type, setType] = useState<PilotReporterType>('nps');
  const [score, setScore] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [entityOverride, setEntityOverride] = useState<PilotReporterOpenOptions['entity']>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const entity = useMemo(
    () => entityOverride ?? inferPilotEntity(pathname, searchParams),
    [entityOverride, pathname, searchParams],
  );

  useEffect(() => {
    const defaultEmail = user?.primaryEmailAddress?.emailAddress ?? '';
    if (defaultEmail && email.length === 0) {
      setEmail(defaultEmail);
    }
  }, [email.length, user?.primaryEmailAddress?.emailAddress]);

  useEffect(() => {
    function handleOpen(event: Event) {
      const detail = (event as CustomEvent<PilotReporterOpenOptions>).detail ?? {};
      const nextKind = detail.kind ?? 'feedback';
      const nextType = detail.type ?? defaultType(nextKind);

      setKind(nextKind);
      setType(nextType);
      setScore(null);
      setMessage(detail.messagePrefill ?? '');
      setTitle(detail.title ?? null);
      setDetails(detail.details ?? null);
      setEntityOverride(detail.entity ?? null);
      setSubmitted(false);
      setSubmitting(false);
      setOpen(true);
    }

    window.addEventListener(pilotReporterOpenEventName(), handleOpen);
    return () => {
      window.removeEventListener(pilotReporterOpenEventName(), handleOpen);
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requiresMessage(kind, type) && message.trim().length === 0) {
      return;
    }

    const context = currentPilotContext();
    const search = searchParams.toString();
    const selectedOpportunityId = searchParams.get('apply')
      ?? searchParams.get('opportunityId')
      ?? (pathname.startsWith('/opportunities/') ? pathSegment(pathname, 1) : null)
      ?? (pathname.startsWith('/apply/') ? pathSegment(pathname, 1) : null);
    const selectedProviderNpi = searchParams.get('npi') ?? searchParams.get('provider');
    const selectedStorylineId = searchParams.get('storylineId');
    const selectedFindingId = searchParams.get('findingId');
    const selectedCaseId = searchParams.get('caseId');
    const organizationSlug = searchParams.get('organizationSlug')
      ?? (pathname.startsWith('/employers/') ? pathSegment(pathname, 1) : null);
    setSubmitting(true);

    await submitPilotFeedback({
      kind,
      type,
      route: context.route,
      message: message.trim(),
      email: email.trim(),
      score: type === 'nps' ? score : null,
      entity,
      details: {
        reporterTitle: title,
        path: pathname,
        search: search ? `?${search}` : '',
        selectedOpportunityId,
        selectedProviderNpi,
        selectedStorylineId,
        selectedFindingId,
        selectedCaseId,
        organizationSlug,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null,
        roleHint: roleContext.role,
        persona: roleContext.persona,
        ...details,
      },
    });

    setSubmitted(true);
    setSubmitting(false);
    window.setTimeout(() => {
      setOpen(false);
    }, 1600);
  }

  function closeReporter() {
    setOpen(false);
    setSubmitting(false);
  }

  const resolvedTitle = modalTitle(kind, title);
  const routeContext = currentPilotContext().route;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close feedback modal"
            onClick={closeReporter}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="fixed bottom-6 right-6 z-[71] w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pilot-reporter-title"
          >
            {submitted ? (
              <div className="space-y-2 px-6 py-8 text-center">
                <p className="text-sm font-semibold text-slate-900">Request received</p>
                <p className="text-sm text-slate-500">
                  We attached your current route context so the pilot team can triage it quickly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 id="pilot-reporter-title" className="text-sm font-semibold text-slate-900">
                      {resolvedTitle}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Current route: <span className="font-mono text-slate-700">{routeContext}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeReporter}
                    className="rounded-full px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <div className="flex gap-2">
                    {([
                      ['feedback', 'Feedback'],
                      ['issue', 'Issue'],
                      ['support', 'Support'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setKind(value);
                          setType(defaultType(value));
                          if (value !== 'feedback') {
                            setScore(null);
                          }
                        }}
                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                          kind === value
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {kind === 'feedback' ? (
                    <div className="flex gap-2">
                      {([
                        ['nps', 'Rate'],
                        ['bug', 'Bug'],
                        ['feature', 'Feature'],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setType(value);
                            if (value !== 'nps') {
                              setScore(null);
                            }
                          }}
                          className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
                            type === value
                              ? 'bg-emerald-500 text-white'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {type === 'nps' ? (
                    <div>
                      <p className="mb-2 text-xs text-slate-500">How likely are you to recommend VitalCV?</p>
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: 11 }, (_, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setScore(index)}
                            className={`h-8 w-8 rounded-lg text-xs font-semibold transition ${
                              score === index ? scoreTone(index) : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {index}
                          </button>
                        ))}
                      </div>
                      {score !== null ? (
                        <p className="mt-1 text-xs text-slate-400">{SCORE_LABELS[score]}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={
                      kind === 'support'
                        ? 'Tell us what blocked you, what you were trying to do, and what should have happened.'
                        : kind === 'issue'
                          ? 'Describe the issue you hit.'
                          : type === 'feature'
                            ? 'What would make this pilot easier to use?'
                            : 'What should we improve?'
                    }
                    required={requiresMessage(kind, type)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email for follow-up (optional)"
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
                  />

                  {entity ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Context attached: {entity.kind ?? 'entity'}
                      {entity.id ? ` · ${entity.id}` : ''}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting || (type === 'nps' && score === null)}
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : submitLabel(kind)}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
