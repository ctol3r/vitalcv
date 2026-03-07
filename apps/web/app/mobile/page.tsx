import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'VitalCV on Mobile',
  description: 'Portable credential verification for healthcare professionals.',
};

const FEATURES = [
  {
    icon: '⚡',
    title: 'Instant Verification',
    desc: 'Verify credentials in seconds from any device — no desktop required.',
  },
  {
    icon: '🔐',
    title: 'Credential Wallet',
    desc: 'Carry your verified credentials securely on your phone with hardware-backed storage.',
  },
  {
    icon: '🔔',
    title: 'Real-time Alerts',
    desc: 'Get notified instantly when credentials are updated, expiring, or revoked.',
  },
  {
    icon: '📡',
    title: 'Offline Support',
    desc: 'Access cached credentials and verification receipts even without connectivity.',
  },
] as const;

export default function MobilePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="mx-auto max-w-3xl px-6 py-16 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">VitalCV on Mobile</h1>
          <p className="text-zinc-400 max-w-lg mx-auto">
            Portable credentialing for healthcare professionals. Verify, carry, and present
            your credentials anywhere.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-2"
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <p className="text-xs uppercase tracking-widest text-violet-400 font-mono">Coming Soon</p>
          <Link
            href="/intake"
            className="inline-block rounded-lg bg-violet-600 px-6 py-3 text-sm font-medium hover:bg-violet-500 transition-colors"
          >
            Join the Waitlist
          </Link>
        </div>
      </main>
    </div>
  );
}
