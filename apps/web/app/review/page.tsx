import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrustStateCard } from '@/components/trust/TrustStateCard';

export default function ReviewLandingPage() {
  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <TrustStateCard
          eyebrow="Employer review"
          title="Open a shared packet preview"
          description={(
            <>
              <span>Employer review opens from a real packet preview link.</span>
              <span className="block pt-2 text-white/30">
                Access required lanes stay attached to the packet itself. Start from NPI lookup, then share when a real packet exists.
              </span>
            </>
          )}
          tone="warning"
          centered
          actions={(
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="outline" className="h-11 rounded-full border-white/10 bg-white/4 text-white/70 hover:border-white/20 hover:bg-white/8 hover:text-white">
                <Link href="/">Start with NPI lookup</Link>
              </Button>
              <Button asChild variant="ghost" className="h-11 rounded-full text-white/45 hover:bg-white/5 hover:text-white/70">
                <Link href="/interview">Packet preview</Link>
              </Button>
            </div>
          )}
        />
      </div>
    </main>
  );
}
