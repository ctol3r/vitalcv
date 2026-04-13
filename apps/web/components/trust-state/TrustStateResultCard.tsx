'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileCode2, ExternalLink, ShieldAlert, ShieldCheck, Shield } from 'lucide-react';

export type TrustStateStatus = 'READY' | 'CONDITIONAL' | 'NOT_READY';

interface Artifact {
  id: string;
  name: string;
  type: string;
  hash: string;
  verifiedAt: string;
}

export interface TrustStateResultCardProps {
  status: TrustStateStatus;
  trustLevel: 'L3' | 'L2' | 'L1' | 'L0';
  readinessScore: number;
  artifacts?: Artifact[];
  onViewEvidence?: (artifactId: string) => void;
}

const STATUS_CONFIG = {
  READY: {
    label: 'Ready',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/20',
    dot: 'bg-emerald-500',
    icon: ShieldCheck,
  },
  CONDITIONAL: {
    label: 'Conditional',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
    dot: 'bg-amber-500',
    icon: ShieldAlert,
  },
  NOT_READY: {
    label: 'Not Ready',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/20',
    dot: 'bg-red-500',
    icon: Shield,
  },
};

export function TrustStateResultCard({
  status,
  trustLevel,
  readinessScore,
  artifacts = [],
  onViewEvidence,
}: TrustStateResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border bg-vt-neutral-100 dark:bg-vt-neutral-900 shadow-sm overflow-hidden transition-all duration-300 ${config.border}`}>
      <div className={`p-4 sm:p-6 ${config.bg} transition-colors duration-300`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg bg-card dark:bg-black/20 ${config.color}`}>
              <Icon className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-vt-neutral-500 mb-1">State</p>
              <h2 className={`text-xl sm:text-2xl font-medium tracking-tight ${config.color}`}>
                {config.label}
              </h2>
            </div>
          </div>

          <div className="flex gap-4 sm:gap-6">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase text-vt-neutral-500 mb-1 tracking-widest">Score</span>
              <span className="text-xl sm:text-2xl font-medium text-vt-neutral-800 dark:text-vt-neutral-100">{readinessScore}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase text-vt-neutral-500 mb-1 tracking-widest">Trust Level</span>
              <span className="text-xl sm:text-2xl font-medium text-vt-neutral-800 dark:text-vt-neutral-100">{trustLevel}</span>
            </div>
          </div>
        </div>

        {artifacts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
            <p className="text-sm font-medium text-vt-neutral-600 dark:text-vt-neutral-400">
              <span className="font-bold text-vt-neutral-900 dark:text-vt-neutral-100">{artifacts.length}</span> verified artifacts attached
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              className={`flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80 ${config.color}`}
            >
              {expanded ? 'Hide Details' : 'View Details'}
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

        {expanded && artifacts.length > 0 && (
          <div className="overflow-hidden">
            <div className="px-4 py-4 sm:px-6 space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-vt-neutral-500 mb-2">
                Verification Artifacts
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {artifacts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-vt-neutral-200 dark:border-vt-neutral-800 bg-vt-neutral-50 hover:bg-vt-neutral-100 dark:bg-vt-neutral-800 dark:hover:bg-vt-neutral-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-vt-neutral-100 dark:bg-black/40 text-vt-neutral-500">
                        <FileCode2 className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-vt-neutral-800 dark:text-vt-neutral-100">{a.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-vt-neutral-500 font-mono truncate max-w-[100px]">{a.hash}</span>
                          <span className="w-1 h-1 rounded-full bg-vt-neutral-300 dark:bg-vt-neutral-700"></span>
                          <span className="text-[10px] text-vt-neutral-500 uppercase">{a.type}</span>
                        </div>
                      </div>
                    </div>
                    {onViewEvidence && (
                      <button 
                        onClick={() => onViewEvidence(a.id)}
                        className="p-2 text-vt-neutral-400 hover:text-vt-neutral-600 dark:text-vt-neutral-500 dark:hover:text-vt-neutral-300 transition-colors"
                        title="View evidence"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
