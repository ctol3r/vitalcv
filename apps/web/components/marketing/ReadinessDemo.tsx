'use client';

/**
 * ReadinessDemo — "Show, don't tell" demo section.
 *
 * A fully simulated readiness output — no login, no NPI needed.
 * Shows: identity, verified sources, readiness state, missing blockers.
 * Cycles through 3 demo profiles. Auto-advances every 5s.
 *
 * Jobs doctrine: user thinks "oh shit this actually works"
 * Mobile: full-width, stacked, collapsible blockers section.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// ── Demo profiles ─────────────────────────────────────────────

const PROFILES = [
  {
    name: 'Dr. Sarah Chen',
    title: 'Emergency Medicine · MD · California',
    npi: '1234567890',
    score: 84,
    level: 'L3',
    status: 'Interview Ready',
    statusColor: 'text-emerald-400',
    verified: [
      { label: 'CA Medical License',    issuer: 'CA Medical Board',   date: 'Nov 2025' },
      { label: 'DEA Registration',      issuer: 'DEA Office',         date: 'Sep 2025' },
      { label: 'Board Certification',   issuer: 'ABEM',               date: 'Jul 2025' },
      { label: 'NPI Identity',          issuer: 'NPPES',              date: 'Jan 2026' },
    ],
    blockers: [
      { label: 'Malpractice insurance proof pending',  severity: 'medium' },
    ],
    gradient: 'from-emerald-500 to-teal-400',
    ring: 'ring-emerald-500/30',
  },
  {
    name: 'Dr. Marcus Williams',
    title: 'Internal Medicine · MD · Texas',
    npi: '9876543210',
    score: 71,
    level: 'L2',
    status: 'Partially Verified',
    statusColor: 'text-amber-400',
    verified: [
      { label: 'TX Medical License',    issuer: 'TX Medical Board',   date: 'Oct 2025' },
      { label: 'NPI Identity',          issuer: 'NPPES',              date: 'Dec 2025' },
    ],
    blockers: [
      { label: 'Board certification not on file',      severity: 'high'   },
      { label: 'DEA registration expired',             severity: 'high'   },
    ],
    gradient: 'from-amber-500 to-orange-400',
    ring: 'ring-amber-500/30',
  },
  {
    name: 'Dr. Priya Nair',
    title: 'Anesthesiology · MD · New York',
    npi: '1111111111',
    score: 96,
    level: 'L4',
    status: 'Fully Cleared',
    statusColor: 'text-emerald-300',
    verified: [
      { label: 'NY Medical License',    issuer: 'NY State Board',     date: 'Dec 2025' },
      { label: 'DEA Registration',      issuer: 'DEA Office',         date: 'Nov 2025' },
      { label: 'Board Certification',   issuer: 'ABA',                date: 'Aug 2025' },
      { label: 'NPI Identity',          issuer: 'NPPES',              date: 'Jan 2026' },
      { label: 'Hospital Privileges',   issuer: 'NYU Langone',        date: 'Feb 2026' },
    ],
    blockers: [],
    gradient: 'from-emerald-400 to-cyan-400',
    ring: 'ring-emerald-400/30',
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  high:   'text-red-400',
  medium: 'text-amber-400',
  low:    'text-muted-foreground',
};

// ── Component ─────────────────────────────────────────────────

export function ReadinessDemo() {
  const [active, setActive] = useState(0);
  const profile = PROFILES[active];

  useEffect(() => {
    const id = setInterval(() => setActive(p => (p + 1) % PROFILES.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative px-4 sm:px-6 py-16 sm:py-24" style={{ background: '#080e1a' }}>
      {/* Subtle glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #10b981, transparent)' }}
      />

      <div className="relative mx-auto max-w-4xl">

        {/* Label */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/70">Sample output — no login required</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            This is what your profile looks like.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            Illustrative readiness output showing verified sources, scores, and blockers.
          </p>
        </div>

        {/* Profile tabs */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {PROFILES.map((p, i) => (
            <button
              key={p.npi}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active === i
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground/70 hover:border-border'
              }`}
            >
              {p.name.split(' ')[1]} {p.name.split(' ')[2]}
            </button>
          ))}
        </div>

        {/* Main demo card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`rounded-2xl border border-border bg-card overflow-hidden ring-1 ${profile.ring}`}
          >
            {/* Identity header */}
            <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-5 border-b border-white/6 bg-gradient-to-r from-white/4 to-transparent">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${profile.gradient} opacity-20 flex items-center justify-center shrink-0 text-lg font-bold text-foreground`}>
                  {profile.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{profile.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{profile.title}</p>
                </div>
              </div>
              <div className={`shrink-0 flex flex-col items-end text-right ring-1 ${profile.ring} rounded-xl px-3 py-2`}>
                <span className="text-2xl font-bold text-foreground leading-none">{profile.score}</span>
                <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide">{profile.level} · Readiness</span>
              </div>
            </div>

            {/* Score bar */}
            <div className="px-5 sm:px-6 py-3 border-b border-white/6">
              <div className="flex justify-between text-[10px] mb-2">
                <span className="text-muted-foreground/60 uppercase tracking-wide">Readiness score</span>
                <span className={profile.statusColor + ' font-semibold'}>{profile.status}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${profile.score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full bg-gradient-to-r ${profile.gradient}`}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/6">
              {/* Verified sources */}
              <div className="px-5 sm:px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">
                  Verified Sources — {profile.verified.length}
                </p>
                <div className="space-y-2.5">
                  {profile.verified.map(v => (
                    <div key={v.label} className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground/80 truncate">{v.label}</p>
                        <p className="text-[10px] text-muted-foreground/60">{v.issuer} · {v.date}</p>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold shrink-0">✓</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blockers + share */}
              <div className="px-5 sm:px-6 py-4 flex flex-col gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">
                    Blockers — {profile.blockers.length}
                  </p>
                  {profile.blockers.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <p className="text-sm text-emerald-400/70">No blockers — fully cleared</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {profile.blockers.map(b => (
                        <div key={b.label} className="flex items-start gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${b.severity === 'high' ? 'bg-red-400' : 'bg-amber-400'}`} />
                          <p className={`text-sm ${SEVERITY_COLOR[b.severity] ?? 'text-muted-foreground'}`}>{b.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="mt-auto pt-2">
                  <Link
                    href="/onboarding"
                    className="flex items-center justify-center gap-1.5 w-full min-h-[44px] rounded-xl bg-emerald-500/90 hover:bg-emerald-500 text-sm font-semibold text-foreground transition-all active:scale-[0.98]"
                  >
                    Build my profile
                  </Link>
                  <p className="text-center text-[10px] text-muted-foreground/40 mt-2">
                    Takes ~30 seconds · No credit card
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 py-3 border-t border-white/6 flex items-center justify-between bg-white/1">
              <p className="text-[10px] text-muted-foreground/40">Illustrative data · NPI {profile.npi}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-muted-foreground/60">Enter your NPI above to see real results</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {PROFILES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-full transition-all ${active === i ? 'h-1.5 w-4 bg-emerald-400' : 'h-1.5 w-1.5 bg-muted hover:bg-muted'}`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
