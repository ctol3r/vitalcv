import { SystemStatusBar } from '@/components/infrastructure/SystemStatusBar';
import { TrustPreviewCard } from '@/components/infrastructure/TrustPreviewCard';
import { NetworkActivityFeed } from '@/components/infrastructure/NetworkActivityFeed';
import { InfrastructureMap } from '@/components/network/InfrastructureMap';

// ── Wave 63: Infrastructure Homepage ────────────────────────
export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      {/* System Status Strip */}
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

      {/* Global Network Map */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="glass rounded-xl overflow-hidden" style={{ height: 320 }}>
          <InfrastructureMap />
        </div>
      </section>
    </main>
  );
}
