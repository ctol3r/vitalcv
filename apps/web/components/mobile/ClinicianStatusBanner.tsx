'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Info, TriangleAlert } from 'lucide-react';

type ClinicianStatusTone = 'error' | 'warning' | 'info';

const TONE_STYLES: Record<ClinicianStatusTone, string> = {
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
  warning: 'border-amber-400/20 bg-amber-400/10 text-amber-50',
  info: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
};

function StatusIcon({ tone }: { tone: ClinicianStatusTone }) {
  if (tone === 'error') {
    return <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />;
  }

  if (tone === 'warning') {
    return <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />;
  }

  return <Info className="mt-0.5 h-5 w-5 shrink-0" />;
}

export function ClinicianStatusBanner({
  tone,
  title,
  detail,
  actionHref,
  actionLabel,
}: {
  tone: ClinicianStatusTone;
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className={`rounded-3xl border px-4 py-4 ${TONE_STYLES[tone]}`}>
      <div className="flex items-start gap-3">
        <StatusIcon tone={tone} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm leading-6">{detail}</p>
          {actionHref && actionLabel ? (
            <Link
              href={actionHref}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-white/80"
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
