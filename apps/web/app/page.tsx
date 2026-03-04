import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SystemStatusBar } from '@/components/infrastructure/SystemStatusBar';
import { TrustPreviewCard } from '@/components/infrastructure/TrustPreviewCard';
import { NetworkActivityFeed } from '@/components/infrastructure/NetworkActivityFeed';
import { MetricsBar } from '@/components/infrastructure/MetricsBar';
import { HomepageCTA } from '@/components/infrastructure/HomepageCTA';
import { InfrastructureMap } from '@/components/network/InfrastructureMap';

// ── Wave 64: Infrastructure Homepage ────────────────────────
export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      <Navbar />
      <SystemStatusBar />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mb-1">
          Trust Infrastructure
        </h1>
        <p className="text-sm text-zinc-500 max-w-xl">
          Real-time credential verification, authority graph navigation, and
          institutional decision intelligence — all in one network.
        </p>
      </section>

      {/* Trust Preview + Activity */}
      <section className="max-w-7xl mx-auto px-6 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrustPreviewCard />
        <NetworkActivityFeed />
      </section>

      {/* Metrics Bar */}
      <section className="max-w-7xl mx-auto px-6 pb-8">
        <MetricsBar />
      </section>

      {/* Global Network Map */}
      <section className="max-w-7xl mx-auto px-6 pb-8">
        <div className="glass rounded-xl overflow-hidden" style={{ height: 320 }}>
          <InfrastructureMap />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <HomepageCTA />
      </section>

      <Footer />
    </main>
  );
}
