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
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-100">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Need help?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            {detail}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {primaryHref && primaryLabel ? (
          <Link
            href={primaryHref}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
        <SupportActionButton
          label="Contact support"
          title={`Pilot support · ${topic}`}
          messagePrefill={detail}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
        />
      </div>
    </section>
  );
}
