/**
 * /interview — Interview Mode
 *
 * M3: No synthetic proof cards shown to pilots.
 *
 * Data flow:
 *   ?entityId=<id> → fetch real passport → show real readiness rows
 *   No entityId    → show explicit "enter NPI first" state
 *
 * Design rule: green is used ONLY on the "Share with employer" CTA button.
 * Status is conveyed through opacity, not color.
 */

import Link from 'next/link';
import type { PassportData } from '@/app/passport/[id]/page';
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

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string }>;
}) {
  const { entityId } = await searchParams;

  // No entityId → no synthetic card. Send to NPI lookup first.
  if (!entityId) {
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
            href="/passport"
            className="block w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold py-4 transition-all text-center"
          >
            Look up my NPI
          </Link>
          <Link href="/" className="block text-white/20 hover:text-white/40 text-xs transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const passport = await fetchPassport(entityId);

  return <InterviewClient entityId={entityId} passport={passport} />;
}
