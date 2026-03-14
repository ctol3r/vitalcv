'use client';

import { ShieldCheck, ShieldAlert, AlertCircle, ChevronRight, Lock, Fingerprint, Clock, Activity } from 'lucide-react';
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
    description: 'You are fully clear to work.',
    color: 'emerald',
    icon: ShieldCheck,
    actionLabel: 'Share Trust State',
  },
  CONDITIONALLY_READY: {
    label: 'CONDITIONALLY READY',
    description: 'Action required soon.',
    color: 'amber',
    icon: Clock,
    actionLabel: 'Resolve Actions',
  },
  NOT_READY: {
    label: 'NOT READY',
    description: 'Missing required credentials.',
    color: 'rose',
    icon: ShieldAlert,
    actionLabel: 'Complete Profile',
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

  const colorVariants = {
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };

  const bgVariants = {
    emerald: 'from-emerald-500/5 to-transparent border-emerald-500/10',
    amber: 'from-amber-500/5 to-transparent border-amber-500/10',
    rose: 'from-rose-500/5 to-transparent border-rose-500/10',
  };

  const scoreColor = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-rose-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b ${bgVariants[config.color as keyof typeof bgVariants]} backdrop-blur-xl p-6 shadow-2xl`}
    >
      <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
        
        {/* Left: Status & Trust Level */}
        <div className="flex gap-6 items-center">
          <div className="relative">
            {/* Score Ring */}
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                className="text-white/5"
                strokeWidth="4"
                stroke="currentColor"
                fill="transparent"
                r="44"
                cx="48"
                cy="48"
              />
              <circle
                className={scoreColor}
                strokeWidth="4"
                strokeDasharray={276}
                strokeDashoffset={276 - (276 * score) / 100}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="44"
                cx="48"
                cy="48"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-mono tracking-tighter text-white">{score}</span>
              <span className="text-[10px] uppercase tracking-widest text-white/40">Score</span>
            </div>
          </div>

          <div>
            <div className="flex flex-col gap-1 mb-2">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest font-medium border ${colorVariants[config.color as keyof typeof colorVariants]} w-fit`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
              </div>
              <h2 className="text-2xl font-serif text-white">{trustLevel} Trust Level</h2>
            </div>
            <p className="text-sm font-mono text-white/50">{config.description}</p>
          </div>
        </div>

        {/* Right: Primary Action */}
        <div className="w-full md:w-auto flex flex-col items-end gap-3">
          <button 
            onClick={onPrimaryAction}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-mono tracking-wide"
          >
            {config.actionLabel}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alerts Section (Only visible if there are alerts) */}
      {alerts.length > 0 && (
        <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
          <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4">Required Attention</h3>
          {alerts.map((alert) => (
            <div key={alert.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white-[0.07] transition-colors border border-white/5">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${alert.type === 'missing' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  {alert.type === 'missing' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white/90">{alert.title}</h4>
                  <p className="text-xs font-mono text-white/50 mt-1">{alert.description}</p>
                </div>
              </div>
              {alert.daysRemaining !== undefined && (
                <div className="px-3 py-1.5 rounded-md bg-white/5 text-xs font-mono text-white/70 border border-white/5 whitespace-nowrap">
                  {alert.daysRemaining} days left
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
