import Link from 'next/link';
import PassportWallet from '@/components/passport/PassportWallet';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import type { PassportData } from '@/lib/trust/passport-contract';

export const dynamic = 'force-dynamic';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchPassport(entityId: string): Promise<PassportData | null> {
  try {
    const res = await fetch(`${B}/api/passport/entity/${entityId}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json() as PassportData;
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PassportEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const passport = await fetchPassport(id);

  if (!passport) {
    return (
      <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm animate-fade-in-up">
          <TrustStateCard
            eyebrow="Passport"
            title="Passport not ready yet"
            description="Your NPI was checked but hasn't been fully indexed. Complete NPI verification to activate your passport."
            centered
            actions={(
              <div className="flex flex-col gap-2 w-full">
                <Button asChild variant="default" className="h-11 w-full rounded-full">
                  <Link href="/onboarding">Verify my NPI</Link>
                </Button>
                <Button asChild variant="outline" className="h-11 w-full rounded-full border-white/10 bg-white/4 text-white/70 hover:border-white/20 hover:bg-white/8 hover:text-white">
                  <Link href="/passport">Try a different NPI</Link>
                </Button>
              </div>
            )}
          />
        </div>
      </main>
    );
  }

  return <PassportWallet passport={passport} />;
}
