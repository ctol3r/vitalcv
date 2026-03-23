import Link from 'next/link';
import ReviewClient from '@/components/review/ReviewClient';
import type { PassportData } from '@/app/passport/[id]/page';

export const dynamic = 'force-dynamic';

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

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params:       Promise<{ entityId: string }>;
  searchParams: Promise<{ contextId?: string; from?: string }>;
}) {
  const { entityId }          = await params;
  const { contextId, from }   = await searchParams;
  const passport               = await fetchPassport(entityId);

  if (!passport) {
    return (
      <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
        <p className="text-white/35 text-sm">Provider not found.</p>
        <Link href="/" className="text-white/40 text-xs mt-4 underline underline-offset-2">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <ReviewClient
      passport={passport}
      contextId={contextId}
      sharedBy={from}
    />
  );
}
