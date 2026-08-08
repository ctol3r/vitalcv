'use client';

import Link from 'next/link';
import { ArrowRight, LifeBuoy } from 'lucide-react';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';

export function ClinicianSupportCard({
  topic,
  detail,
  primaryHref,
  primaryLabel,
}: {
  topic: string;
  detail: string;
  primaryHref?: string;
  primaryLabel?: string;
}) {
  return (
    <section className="mz mz-card mz-card-pad">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className="mz-inset inline-flex h-10 w-10 items-center justify-center rounded-[8px]"
            style={{ color: 'var(--ink-600)' }}
          >
            <LifeBuoy className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mz-h2 mt-4">Need help?</h2>
          <p className="mt-2 max-w-2xl mz-body">
            {detail}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {primaryHref && primaryLabel ? (
          <Link
            href={primaryHref}
            className="mz-btn min-h-12 justify-center"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        <SupportActionButton
          label="Contact support"
          title={`Pilot support · ${topic}`}
          messagePrefill={detail}
          className="mz-btn mz-btn-ghost min-h-12 justify-center"
        />
      </div>
    </section>
  );
}
