'use client';

/**
 * Mobile Preview Page — Wave 64
 *
 * Route: /mobile
 * Desktop preview of the mobile credential wallet with
 * CRS ring, credential cards, QR share, and revocation alerts.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

// ── Demo Data ─────────────────────────────────────────────────────────────

const DEMO_CREDENTIALS = [
  { id: '1', source: 'Medical License', level: 'L3', color: 'border-emerald-500/20 bg-emerald-500/5', badge: 'text-emerald-400' },
  { id: '2', source: 'DEA Registration', level: 'L2', color: 'border-amber-500/20 bg-amber-500/5', badge: 'text-amber-400' },
  { id: '3', source: 'Board Certification', level: 'L3', color: 'border-emerald-500/20 bg-emerald-500/5', badge: 'text-emerald-400' },
  { id: '4', source: 'Hospital Privileges', level: 'L2', color: 'border-amber-500/20 bg-amber-500/5', badge: 'text-amber-400' },
];

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── Component ─────────────────────────────────────────────────────────────

export default function MobilePreviewPage() {
  const [showQr, setShowQr] = useState(false);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — Description */}
          <motion.div {...fadeUp}>
            <h1 className="text-3xl font-bold mb-3">Mobile Credential Wallet</h1>
            <p className="text-sm text-zinc-500 mb-6 max-w-md">
              Carry your verified credentials everywhere. Share proof instantly
              via QR code or deep link. Get notified when credentials expire or
              are revoked.
            </p>
            <div className="flex gap-3">
              <Link href="/mobile/wallet"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors">
                Open Wallet
              </Link>
              <Link href="/demo/run"
                className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg text-sm text-zinc-300 transition-colors">
                Try Demo
              </Link>
            </div>
          </motion.div>

          {/* Right — Phone Mockup */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="flex justify-center">
            <div className="w-72 bg-zinc-900 rounded-3xl border border-zinc-800 p-4 shadow-2xl">
              {/* Status Bar */}
              <div className="flex items-center justify-between px-2 py-1 mb-3">
                <span className="text-[9px] text-zinc-500">9:41</span>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" />
                  <span className="text-[9px] text-zinc-600">VitalCV</span>
                </div>
              </div>

              {/* CRS Ring */}
              <div className="text-center mb-4">
                <div className="relative w-24 h-24 mx-auto">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <motion.circle cx="50" cy="50" r="40" fill="none"
                      stroke="#34D399" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 40}
                      initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - 0.87) }}
                      transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-emerald-400">87</span>
                    <span className="text-[7px] text-zinc-500">CRS</span>
                  </div>
                </div>
              </div>

              {/* Credential Cards */}
              <div className="space-y-1.5 mb-4">
                {DEMO_CREDENTIALS.map((cred, i) => (
                  <motion.div key={cred.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border ${cred.color}`}>
                    <span className="text-[10px] text-zinc-300">{cred.source}</span>
                    <span className={`text-[9px] font-bold ${cred.badge}`}>{cred.level}</span>
                  </motion.div>
                ))}
              </div>

              {/* Share Button */}
              <button onClick={() => setShowQr(!showQr)}
                className="w-full py-2 bg-emerald-600/80 rounded-xl text-[11px] font-semibold">
                {showQr ? 'Hide QR' : 'Share Proof'}
              </button>

              {/* QR Placeholder */}
              {showQr && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  className="mt-3 bg-white rounded-lg p-3">
                  <div className="w-full aspect-square bg-zinc-100 rounded grid grid-cols-7 grid-rows-7 gap-0.5 p-2">
                    {Array.from({ length: 49 }, (_, i) => (
                      <div key={i} className={`rounded-sm ${(i + Math.floor(i / 7)) % 3 === 0 ? 'bg-zinc-800' : 'bg-white'}`} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Alert */}
              <div className="mt-3 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/15">
                <p className="text-[9px] text-amber-400">⏰ DEA expires in 28 days</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
