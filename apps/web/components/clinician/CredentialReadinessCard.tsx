'use client';

import { ShieldCheck, ShieldAlert, AlertCircle, ChevronRight, Clock, Copy } from 'lucide-react';
import { motion } from 'framer-motion';

export type ReadinessState = 'READY' | 'CONDITIONALLY_READY' | 'NOT_READY';
export type TrustLevel = 'L0' | 'L1' | 'L2' | 'L3';

interface Alert {
  id: string;
  type: 'missing' | 'expiring';
  title: string;
  description: string;
  daysRemaining?: number;
}

interface CredentialReadinessCardProps {
  state: ReadinessState;
  score: number;
  trustLevel: TrustLevel;
  alerts: Alert[];
  onPrimaryAction?: () => void;
}

const stateConfig = {
  READY: {
    label: 'READY',
    description: 'Fully clear to work.',
    theme: 'emerald',
    icon: ShieldCheck,
    actionLabel: 'Share Live Profile',
  },
  CONDITIONALLY_READY: {
    label: 'CONDITIONAL',
    description: 'Action required soon.',
    theme: 'amber',
    icon: Clock,
    actionLabel: 'Review Actions',
  },
  NOT_READY: {
    label: 'NOT READY',
    description: 'Missing credentials.',
    theme: 'rose',
    icon: ShieldAlert,
    actionLabel: 'Missing Items',
  },
};

export function CredentialReadinessCard({
  state,
  score,
  trustLevel,
  alerts,
  onPrimaryAction,
}: CredentialReadinessCardProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  const themes = {
    emerald: {
      bg: 'from-emerald-950/40 to-slate-950/80',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10',
      badgeBorder: 'border-emerald-500/30',
      ring: 'ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    },
    amber: {
      bg: 'from-amber-950/40 to-slate-950/80',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      badgeBg: 'bg-amber-500/10',
      badgeBorder: 'border-amber-500/30',
      ring: 'ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    },
    rose: {
      bg: 'from-rose-950/40 to-slate-950/80',
      border: 'border-rose-500/20',
      text: 'text-rose-400',
      badgeBg: 'bg-rose-500/10',
      badgeBorder: 'border-rose-500/30',
      ring: 'ring-rose-500/20 shadow-[0_0_20px_rgba(225,29,72,0.15)]',
    },
  };

  const theme = themes[config.theme as keyof typeof themes];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden rounded-3xl border bg-gradient-to-b ${theme.bg} ${theme.border} ${theme.ring} backdrop-blur-xl p-6 sm:p-8 flex flex-col gap-8 transition-all duration-300`}
    >
      {/* Header: Label & Time */}
      <div className="flex items-center justify-between">
        <div className={`px-3 py-1.5 rounded-full border ${theme.badgeBg} ${theme.badgeBorder} flex items-center gap-1.5`}>
          <Icon className={`w-3.5 h-3.5 ${theme.text}`} />
          <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest ${theme.text}`}>
            {config.label}
          </span>
        </div>
        <p className="text-[10px] sm:text-xs font-mono tracking-widest uppercase text-slate-500">
          Last Updated Today
        </p>
      </div>

      {/* Main Score & Status */}
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-3">
          <h1 className="text-6xl sm:text-7xl font-semibold tracking-tighter text-white">
            {score}
          </h1>
          <div className="pb-1.5 sm:pb-2">
            <span className="text-xl sm:text-2xl text-slate-500">/100</span>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-medium text-white mb-1">
            {trustLevel} Trust Level
          </h2>
          <p className="text-sm text-slate-400 font-medium">
            {config.description}
          </p>
        </div>
      </div>

      {/* Required Actions / Missing Items */}
      {alerts.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Open Actions
          </h3>
          {alerts.map((alert) => (
            <div key={alert.id} className="flex gap-3 items-start p-3 sm:p-4 rounded-2xl bg-black/40 border border-white/[0.05]">
              <div className={`shrink-0 p-1.5 rounded-lg ${alert.type === 'missing' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {alert.type === 'missing' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 truncate">{alert.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{alert.description}</p>
              </div>
              {alert.daysRemaining !== undefined && (
                <div className="shrink-0 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                  {alert.daysRemaining} days
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Primary CTA */}
      <div className="pt-2 sm:pt-4">
        <button
          onClick={onPrimaryAction}
          className="group relative w-full flex min-h-[56px] items-center justify-between rounded-2xl bg-white px-5 sm:px-6 py-4 transition-all hover:bg-slate-100 active:scale-[0.98]"
        >
          <span className="text-sm sm:text-base font-bold text-slate-900">
            {config.actionLabel}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 group-hover:bg-slate-800 transition-colors">
            <ChevronRight className="w-4 h-4 text-white" />
          </div>
        </button>
      </div>
    </motion.div>
  );
}
