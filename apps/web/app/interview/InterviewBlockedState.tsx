'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

interface InterviewBlockedStateProps {
  title: string;
  description: string;
  telemetryReason?: string;
  primaryHref?: string;
  primaryLabel?: string;
}

export default function InterviewBlockedState({
  title,
  description,
  telemetryReason,
  primaryHref,
  primaryLabel,
}: InterviewBlockedStateProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!telemetryReason || trackedRef.current) {
      return;
    }

    trackUxEvent({
      event_name: UX_EVENTS.INTERVIEW_BLOCKED_VIEW,
      component_id: 'interview_entry',
      metadata: {
        blocked_reason: telemetryReason,
      },
    });

    trackedRef.current = true;
  }, [telemetryReason]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-vt-surface-ops-base">
      <div className="w-full max-w-sm animate-fade-in-up space-y-5 text-center">
        <p className="text-white/58 text-base leading-relaxed">{title}</p>
        <p className="text-white/32 text-sm leading-relaxed">{description}</p>
        <Link
          href={primaryHref ?? PUBLIC_WEDGE_ROUTE_TARGETS.homepageLookup}
          className="block w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-foreground text-sm font-semibold py-4 transition-all text-center"
        >
          {primaryLabel ?? 'Start with NPI lookup'}
        </Link>
      </div>
    </div>
  );
}
