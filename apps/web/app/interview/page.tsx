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

import Link from 'next/link';
import type { PassportData } from '@/lib/trust/passport-contract';
import InterviewClient from './InterviewClient';

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

  if (!entityId && !npi) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#080e1a' }}>
        <div className="w-full max-w-sm space-y-5 text-center">
          <p className="text-white/50 text-base leading-relaxed">
            Interview Mode shows your real verified readiness to an employer.
          </p>
          <p className="text-white/30 text-sm">
            Enter your NPI first to generate your proof card.
          </p>
          <Link
            href="/"
            className="block w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold py-4 transition-all text-center"
          >
            Start with NPI lookup
          </Link>
          <Link href="/" className="block text-white/20 hover:text-white/40 text-xs transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const passport = entityId
    ? await fetchPassport(entityId)
    : npi
      ? await fetchPassportByNpi(npi)
      : null;

  if (!passport) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#080e1a' }}>
        <div className="w-full max-w-sm space-y-5 text-center">
          <p className="text-white/50 text-base leading-relaxed">
            VitalCV could not build an interview packet from that input yet.
          </p>
          <p className="text-white/30 text-sm">
            Start from your NPI lookup so the packet is anchored to a real passport object.
          </p>
          <Link
            href="/"
            className="block w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold py-4 transition-all text-center"
          >
            Start with NPI lookup
          </Link>
          <Link href="/" className="block text-white/20 hover:text-white/40 text-xs transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return <InterviewClient entityId={passport.entityId} passport={passport} contextId={contextId} />;
}
