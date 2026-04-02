/**
 * /interview — Interview Mode
 *
 * M3: No synthetic proof cards shown to pilots.
 *
 * Data flow:
 *   ?entityId=<id> or ?npi=<npi> → fetch real passport → show real readiness rows
 *   No entityId / npi            → show explicit "enter NPI first" state
 *
 * Design rule: green is used ONLY on the "Share with employer" CTA button.
 * Status is conveyed through opacity, not color.
 */

import type { PassportData } from '@/lib/trust/passport-contract';
import {
  getStatusDisplayLabel,
  getTrustStatusLabel,
} from '@/lib/trust/status-language';
import InterviewClient from './InterviewClient';
import InterviewBlockedState from './InterviewBlockedState';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

async function fetchPassport(entityId: string): Promise<PassportData | null> {
  try {
    const res = await fetch(`${B}/api/passport/entity/${entityId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json() as PassportData;
  } catch { return null; }
}

async function fetchPassportByNpi(npi: string): Promise<PassportData | null> {
  try {
    const res = await fetch(`${B}/api/passport/npi/${npi}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json() as PassportData;
  } catch { return null; }
}

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; npi?: string; contextId?: string }>;
}) {
  const { entityId, npi, contextId } = await searchParams;
  const checkedLabel = getTrustStatusLabel('checked');
  const pendingLabel = getTrustStatusLabel('pending');
  const unavailableLabel = getTrustStatusLabel('unavailable');
  const previewOnlyLabel = getStatusDisplayLabel('preview_only', 'Preview');

  if (!entityId && !npi) {
    return (
      <InterviewBlockedState
        title="Start with an NPI to open this view."
        description="Enter your NPI from the passport page to get a real readiness snapshot first, then continue here once source checks are visible."
        telemetryReason="missing_npi_context"
        primaryHref="/passport"
        primaryLabel="Go to passport"
      />
    );
  }

  const passport = entityId
    ? await fetchPassport(entityId)
    : npi
      ? await fetchPassportByNpi(npi)
      : null;

  if (!passport) {
    return (
      <InterviewBlockedState
        title="VitalCV could not load a source-backed passport for that NPI yet."
        description={`Run the homepage lookup again to confirm which sections are ${checkedLabel}, ${pendingLabel}, ${unavailableLabel}, or ${previewOnlyLabel} before you continue.`}
      />
    );
  }

  return <InterviewClient entityId={passport.entityId} passport={passport} contextId={contextId} />;
}
