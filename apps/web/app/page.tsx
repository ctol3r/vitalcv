import Navbar from '@/components/marketing/Navbar';
import { HeroSection } from '@/components/marketing/HeroSection';
import NetworkBackground from '@/components/marketing/NetworkBackground';
import { ImpactPanel } from '@/components/marketing/ImpactPanel';
import { ProductBento } from '@/components/marketing/ProductBento';
import { SystemStatus } from '@/components/marketing/SystemStatus';

// ── Page ────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-[var(--cloud-dancer)] text-[var(--warm-charcoal)] overflow-x-hidden">
      <NetworkBackground />
      <Navbar />
      <HeroSection />
      <ProductBento />
      <SystemStatus />
      <ImpactPanel />
    </main>
  );
}
