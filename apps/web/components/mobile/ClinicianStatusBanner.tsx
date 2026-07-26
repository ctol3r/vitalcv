'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Info, TriangleAlert } from 'lucide-react';

type ClinicianStatusTone = 'error' | 'warning' | 'info';

const TONE_CHIP: Record<ClinicianStatusTone, string> = {
  error: 'mz-chip-p0',
  warning: 'mz-chip-watch',
  info: 'mz-chip-unknown',
};

function StatusIcon({ tone }: { tone: ClinicianStatusTone }) {
  const Icon = tone === 'error' ? AlertTriangle : tone === 'warning' ? TriangleAlert : Info;

  return (
    <span className={`mz-chip ${TONE_CHIP[tone]} mt-0.5 shrink-0`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function ClinicianStatusBanner({
  tone,
  title,
  detail,
  actionHref,
  actionLabel,
  onAction,
  onActionLabel,
}: {
  tone: ClinicianStatusTone;
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
  /** Optional in-place action (e.g. retry) rendered as a button. */
  onAction?: () => void;
  onActionLabel?: string;
}) {
  return (
    <div className="mz mz-inset px-4 py-4" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <StatusIcon tone={tone} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 mz-body">{detail}</p>
          <div className="flex flex-wrap items-center gap-4">
            {onAction && onActionLabel ? (
              <button
                type="button"
                onClick={onAction}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4 transition-opacity hover:opacity-80"
              >
                {onActionLabel}
              </button>
            ) : null}
            {actionHref && actionLabel ? (
              <Link
                href={actionHref}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: 'var(--accent)' }}
              >
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
