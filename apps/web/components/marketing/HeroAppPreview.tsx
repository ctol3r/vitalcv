'use client';

/**
 * HeroAppPreview — Wave 11: Antigravity Aesthetic
 *
 * A 3D-perspective, isometric mock of the VitalCV verifier dashboard.
 * On page load it sits at rotateX(15deg) rotateY(-15deg) inside a
 * perspective(1000px) container. As the user scrolls, `useScroll` +
 * `useTransform` smoothly drives the rotation back to 0°, giving the
 * illusion that the UI "lands" flat on the screen.
 *
 * "use client" required for useScroll and mouse/scroll hooks.
 * No hydration risk — the initial transform is set inline so SSR
 * and the first client paint agree.
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  Search,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

// ── Mock data rows ────────────────────────────────────────────────────────

const MOCK_ROWS = [
  { name: 'Dr. Sarah Chen',    specialty: 'Cardiology',       score: 95, band: 'GREEN',  status: 'Verified' },
  { name: 'Dr. Marcus Webb',   specialty: 'Emergency Med.',   score: 88, band: 'GREEN',  status: 'Monitoring' },
  { name: 'Dr. Priya Nair',    specialty: 'Internal Med.',    score: 80, band: 'YELLOW', status: 'Expiring' },
  { name: 'Dr. James Okafor',  specialty: 'Neurology',        score: 95, band: 'GREEN',  status: 'Verified' },
] as const;

const BAND_COLORS = {
  GREEN:  { bg: 'bg-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-500/40' },
  YELLOW: { bg: 'bg-amber-500/20',   text: 'text-amber-400',   ring: 'ring-amber-500/40'   },
  RED:    { bg: 'bg-red-500/20',     text: 'text-red-400',     ring: 'ring-red-500/40'     },
} as const;

// ── Component ─────────────────────────────────────────────────────────────

export function HeroAppPreview() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // Flatten the 3D rotation as the user scrolls into the section
  const rotateX = useTransform(scrollYProgress, [0, 0.5], [15, 0]);
  const rotateY = useTransform(scrollYProgress, [0, 0.5], [-15, 0]);
  const scale   = useTransform(scrollYProgress, [0, 0.5], [0.92, 1]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-3xl"
      style={{ perspective: '1000px' }}
    >
      <motion.div
        style={{ rotateX, rotateY, scale, transformStyle: 'preserve-3d' }}
        initial={{ rotateX: 15, rotateY: -15, scale: 0.92 }}
        className="relative w-full"
      >
        {/* ── Outer chrome frame ────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/90 shadow-[0_40px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden">

          {/* Window traffic-light bar */}
          <div className="flex items-center gap-2 border-b border-white/5 bg-slate-900/80 px-5 py-3">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-amber-500/70" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
            <div className="ml-4 flex-1 rounded-full bg-white/5 px-4 py-1 text-center text-[10px] font-mono text-white/30">
              vitalcv.ai/verifier
            </div>
          </div>

          {/* ── App shell ──────────────────────────────── */}
          <div className="flex h-[360px] overflow-hidden">

            {/* Sidebar */}
            <nav className="hidden w-52 shrink-0 border-r border-white/5 bg-slate-900/60 p-4 sm:flex flex-col gap-1">
              <div className="mb-4 flex items-center gap-2 px-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white/70">VitalCV</span>
              </div>
              {[
                { icon: Search,    label: 'Verify Provider', active: true },
                { icon: Building2, label: 'My Pipeline',     active: false },
                { icon: TrendingUp,label: 'Analytics',       active: false },
                { icon: BadgeCheck,label: 'Audit Logs',      active: false },
              ].map(({ icon: Icon, label, active }) => (
                <div
                  key={label}
                  className={[
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs',
                    active
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-white/30 hover:text-white/50',
                  ].join(' ')}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </div>
              ))}
            </nav>

            {/* Main panel */}
            <div className="flex flex-1 flex-col overflow-hidden">

              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-white/5 bg-slate-900/40 px-5 py-3">
                <div>
                  <p className="text-xs font-semibold text-white/80">Provider Verification</p>
                  <p className="text-[10px] text-white/30">4 clinicians in queue</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 ring-1 ring-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-400">Live</span>
                </div>
              </div>

              {/* Table rows */}
              <div className="flex-1 overflow-hidden px-4 py-3 space-y-2">
                {MOCK_ROWS.map((row, i) => {
                  const colors = BAND_COLORS[row.band];
                  return (
                    <motion.div
                      key={row.name}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: 'easeOut' }}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5"
                    >
                      {/* Name + specialty */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white/80">{row.name}</p>
                        <p className="text-[10px] text-white/30">{row.specialty}</p>
                      </div>

                      {/* CRS score mini ring */}
                      <div className="flex items-center gap-3">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full ring-1 ${colors.bg} ${colors.ring}`}>
                          <span className={`text-[10px] font-bold tabular-nums ${colors.text}`}>
                            {row.score}
                          </span>
                        </div>

                        {/* Status badge */}
                        <span className={`hidden rounded-full px-2.5 py-0.5 text-[10px] font-medium sm:inline-block ring-1 ${colors.bg} ${colors.text} ${colors.ring}`}>
                          {row.status}
                        </span>

                        {/* Accept button */}
                        <div className="hidden rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30 lg:block">
                          Accept
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer stat bar */}
              <div className="flex items-center gap-6 border-t border-white/5 bg-slate-900/40 px-5 py-2.5">
                {[
                  { icon: CheckCircle2, label: '3 Verified',   color: 'text-emerald-400' },
                  { icon: Clock,        label: '1 Expiring',   color: 'text-amber-400'   },
                  { icon: TrendingUp,   label: '↓ 88% faster', color: 'text-white/40'    },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className={`flex items-center gap-1.5 text-[10px] font-medium ${color}`}>
                    <Icon className="h-3 w-3 shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reflection / shadow below the frame */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-4 left-6 right-6 h-8 rounded-b-2xl blur-xl"
          style={{
            background: 'linear-gradient(to bottom, rgba(16,185,129,0.08), transparent)',
          }}
        />
      </motion.div>
    </div>
  );
}
