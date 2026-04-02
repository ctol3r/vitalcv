'use client';

/**
 * IncidentPanel.tsx — Wave 90: Incident Display Panel
 *
 * Shows credential outages, source downtime, and revocation spikes.
 */

import { motion } from 'framer-motion';

interface Incident {
  id: string;
  type: 'credential_outage' | 'source_downtime' | 'revocation_spike';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  detectedAt: string;
  resolved: boolean;
}

interface IncidentPanelProps {
  incidents: Incident[];
  className?: string;
}

const SEVERITY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  WARNING: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  INFO: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
};

const TYPE_LABEL: Record<string, string> = {
  credential_outage: 'Credential Outage',
  source_downtime: 'Source Downtime',
  revocation_spike: 'Revocation Spike',
};

export function IncidentPanel({ incidents, className = '' }: IncidentPanelProps) {
  if (incidents.length === 0) {
    return (
      <div className={`rounded-xl border border-white/8 bg-slate-900/40 p-5 ${className}`}>
        <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3 font-mono">
          Incidents
        </h3>
        <div className="flex items-center gap-2 text-emerald-400 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          No active incidents
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/8 bg-slate-900/40 p-5 ${className}`}>
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3 font-mono">
        Incidents ({incidents.length})
      </h3>
      <div className="space-y-2">
        {incidents.map((inc, i) => {
          const style = SEVERITY_STYLE[inc.severity] ?? SEVERITY_STYLE.INFO;
          return (
            <motion.div
              key={inc.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-lg border ${style.border} ${style.bg} p-3`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-mono uppercase tracking-wider ${style.text}`}>
                  {inc.severity} — {TYPE_LABEL[inc.type] ?? inc.type}
                </span>
                {inc.resolved && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                    Resolved
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground font-medium">{inc.title}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{inc.description}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default IncidentPanel;
