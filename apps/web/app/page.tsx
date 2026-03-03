import { Hero } from '@/components/marketing/Hero';
import { LedgerTicker } from '@/components/marketing/LedgerTicker';
import { BentoGrid } from '@/components/marketing/BentoGrid';

// ── Wave 44: Palantir-Grade Marketing Shell ────────────────
export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      <Hero />
      <LedgerTicker />
      <BentoGrid />
    </main>
  );
}
