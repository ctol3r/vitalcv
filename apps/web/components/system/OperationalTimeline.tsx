'use client';

/**
 * OperationalTimeline.tsx — Wave 87: Operational Event Timeline
 *
 * Sequential display: verification → decision → simulation → monitoring.
 */

import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  phase: 'verification' | 'decision' | 'simulation' | 'monitoring';
  label: string;
  status: 'complete' | 'active' | 'pending';
  detail?: string;
  timestamp?: string;
}

interface OperationalTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

// ── Phase Styling ─────────────────────────────────────────────────────

const PHASE_STYLE: Record<string, { color: string; bg: string }> = {
  verification: { color: 'text-emerald-400', bg: 'bg-emerald-400' },
  decision: { color: 'text-orange-400', bg: 'bg-orange-400' },
  simulation: { color: 'text-violet-400', bg: 'bg-violet-400' },
  monitoring: { color: 'text-blue-400', bg: 'bg-blue-400' },
};

const STATUS_ICON: Record<string, string> = {
  complete: '●',
  active: '◎',
  pending: '○',
};

// ── Component ─────────────────────────────────────────────────────────

export function OperationalTimeline({ events, className = '' }: OperationalTimelineProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-zinc-800" />

      <div className="space-y-1">
        {events.map((ev, i) => {
          const style = PHASE_STYLE[ev.phase] ?? PHASE_STYLE.verification;
          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.2 }}
              className="flex items-start gap-3 pl-1"
            >
              <span className={`text-sm mt-0.5 relative z-10 ${ev.status === 'active' ? style.color : ev.status === 'complete' ? style.color : 'text-zinc-600'}`}>
                {STATUS_ICON[ev.status]}
              </span>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${style.bg}/20 ${style.color}`}>
                    {ev.phase}
                  </span>
                  <span className="text-[11px] text-zinc-300">{ev.label}</span>
                </div>
                {ev.detail && (
                  <p className="text-[9px] text-zinc-600 mt-0.5 ml-0.5">{ev.detail}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default OperationalTimeline;
