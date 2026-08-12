'use client';

/**
 * Analytics for the search-arrival lane.
 *
 * /directory/[npi] is a server component, and a server component cannot emit a
 * browser analytics event — which is why the five public record surfaces
 * carried no instrumentation at all. These are the two smallest client
 * components that fix that without turning the page itself into one.
 *
 * PAYLOAD RULE: no NPI, in any form. lib/analytics/funnel.ts still exports
 * hashNpi(), but a SHA-256 of a ten-digit number is brute-forceable in seconds,
 * so hashing would not make it anonymous — it would only make it look
 * anonymous. Stage metadata only.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';

/**
 * Fires once per mount. Renders nothing.
 *
 * Deliberately not gated on a session flag: unlike the onboarding surfaces,
 * repeat views of a record page are signal — a clinician coming back to their
 * own record before claiming it is the hesitation this funnel exists to see.
 */
export function RecordViewTracker({
  entityType,
}: {
  entityType: 'individual' | 'organization';
}) {
  const fired = useRef(false);

  useEffect(() => {
    // React 18+ mounts effects twice in development StrictMode. Without this
    // the dev funnel double-counts every record view.
    if (fired.current) return;
    fired.current = true;
    trackFunnelEvent(FUNNEL_EVENTS.RECORD_VIEWED, { entity_type: entityType });
  }, [entityType]);

  return null;
}

/**
 * The claim CTA, as a client component so the click is measurable.
 *
 * Navigation is not conditional on the event: trackFunnelEvent swallows its own
 * failures, and an analytics outage must never be able to stop a clinician
 * claiming their record.
 */
export function ClaimRecordLink({
  npi,
  className,
  style,
  children,
}: {
  npi: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/onboarding?npi=${npi}`}
      className={className}
      style={style}
      data-testid="directory-claim-cta"
      onClick={() => trackFunnelEvent(FUNNEL_EVENTS.CLAIM_CLICKED)}
    >
      {children}
    </Link>
  );
}
