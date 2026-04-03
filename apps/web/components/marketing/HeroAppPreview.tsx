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
  GREEN:  { bg: 'bg-[var(--vt-status-resolved)]/20', text: 'text-[var(--vt-status-resolved)]', ring: 'border-[var(--vt-status-resolved)]/40' },
  YELLOW: { bg: 'bg-[var(--vt-severity-high)]/20',   text: 'text-[var(--vt-severity-high)]',   ring: 'border-[var(--vt-severity-high)]/40'   },
  RED:    { bg: 'bg-[var(--vt-severity-critical)]/20',     text: 'text-[var(--vt-severity-critical)]',     ring: 'border-[var(--vt-severity-critical)]/40'     },
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
        <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] overflow-hidden">

          {/* Window traffic-light bar */}
          <div className="flex items-center gap-2 border-b border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-5 py-3">
            <span className="h-3 w-3 rounded-sm bg-[var(--vt-text-muted)]" />
            <span className="h-3 w-3 rounded-sm bg-[var(--vt-text-muted)]" />
            <span className="h-3 w-3 rounded-sm bg-[var(--vt-text-muted)]" />
            <div className="ml-4 flex-1 rounded-sm bg-[var(--vt-surface-subtle)] px-4 py-1 text-center text-[10px] font-mono text-[var(--vt-text-muted)]">
              vitalcv.ai/verifier
            </div>
          </div>

          {/* ── App shell ──────────────────────────────── */}
          <div className="flex h-[360px] overflow-hidden">

            {/* Sidebar */}
            <nav className="hidden w-52 shrink-0 border-r border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-4 sm:flex flex-col gap-1">
              <div className="mb-4 flex items-center gap-2 px-2">
                <ShieldCheck className="h-4 w-4 text-[var(--vt-status-resolved)]" />
                <span className="text-xs font-semibold text-[var(--vt-text-secondary)]">VitalCV</span>
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
                    'flex items-center gap-2.5 rounded-sm px-3 py-2 text-xs',
                    active
                      ? 'bg-[var(--vt-status-resolved)]/10 text-[var(--vt-status-resolved)]'
                      : 'text-[var(--vt-text-muted)] hover:text-[var(--vt-text-secondary)]',
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
              <div className="flex items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-5 py-3">
                <div>
                  <p className="text-xs font-semibold text-[var(--vt-text-primary)]">Provider Verification</p>
                  <p className="text-[10px] text-[var(--vt-text-muted)]">4 clinicians in queue</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-status-resolved)]/10 px-3 py-1.5">
                  <CheckCircle2 className="h-3 w-3 text-[var(--vt-status-resolved)]" />
                  <span className="text-[10px] font-medium text-[var(--vt-status-resolved)]">Live</span>
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
                      className="flex items-center justify-between rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-2.5"
                    >
                      {/* Name + specialty */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-[var(--vt-text-primary)]">{row.name}</p>
                        <p className="text-[10px] text-[var(--vt-text-muted)]">{row.specialty}</p>
                      </div>

                      {/* CRS score mini ring */}
                      <div className="flex items-center gap-3">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-sm border ${colors.bg} ${colors.ring}`}>
                          <span className={`text-[10px] font-bold tabular-nums ${colors.text}`}>
                            {row.score}
                          </span>
                        </div>

                        {/* Status badge */}
                        <span className={`hidden rounded-sm border px-2.5 py-0.5 text-[10px] font-medium sm:inline-block ${colors.bg} ${colors.text} ${colors.ring}`}>
                          {row.status}
                        </span>

                        {/* Accept button */}
                        <div className="hidden rounded-sm border border-[var(--vt-border)] bg-[var(--vt-status-resolved)]/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--vt-status-resolved)] lg:block">
                          Accept
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer stat bar */}
              <div className="flex items-center gap-6 border-t border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-5 py-2.5">
                {[
                  { icon: CheckCircle2, label: '3 Verified',   color: 'text-[var(--vt-status-resolved)]' },
                  { icon: Clock,        label: '1 Expiring',   color: 'text-[var(--vt-severity-high)]'   },
                  { icon: TrendingUp,   label: '↓ 88% faster', color: 'text-[var(--vt-text-muted)]'    },
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


      </motion.div>
    </div>
  );
}
