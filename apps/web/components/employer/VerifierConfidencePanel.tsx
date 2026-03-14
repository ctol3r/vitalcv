import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronDown, ShieldCheck, Database, FileText, Activity } from 'lucide-react';
import { VerificationLatencyBadge } from '../onboarding/VerificationLatencyBadge';

interface VerifierConfidencePanelProps {
  trustLevel: string;
  readinessScore: number;
  artifactCount: number;
  latencyMs?: number;
  timestamp?: string;
  className?: string;
}

export function VerifierConfidencePanel({
  trustLevel,
  readinessScore,
  artifactCount,
  latencyMs = 142,
  timestamp = new Date().toISOString(),
  className
}: VerifierConfidencePanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden", className)}>
      {/* Header Summary */}
      <div 
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
              Readiness Score
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-serif text-emerald-700">{readinessScore}</span>
              <span className="text-sm text-emerald-700/50">/100</span>
            </div>
          </div>
          
          <div className="w-[1px] h-8 bg-slate-200" />
          
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
              Verified Artifacts
            </span>
            <span className="text-lg font-medium text-slate-900">{artifactCount} active</span>
          </div>

          <div className="w-[1px] h-8 bg-slate-200" />

          <VerificationLatencyBadge 
            latencyMs={latencyMs} 
            trustLevel={trustLevel} 
            timestamp={new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 
          />
        </div>

        <motion.div animate={{ rotate: expanded ? 180 : 0 }} className="text-slate-400">
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100 bg-slate-50/50"
          >
            <div className="p-6 grid grid-cols-2 gap-6">
              
              {/* Artifacts Preview */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold font-mono tracking-widest uppercase text-slate-500">
                  Verification Sources
                </h4>
                <div className="space-y-2">
                  {[ 
                    { name: 'NPPES Registry', status: 'Verified', icon: Database },
                    { name: 'State Medical Board', status: 'Verified', icon: ShieldCheck },
                    { name: 'DEA Registration', status: 'Verified', icon: Activity },
                    { name: 'OIG Sanctions', status: 'Clear', icon: FileText }
                  ].map((source, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <source.icon className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-slate-900">{source.name}</span>
                      </div>
                      <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {source.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Bundle */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold font-mono tracking-widest uppercase text-slate-500">
                  Audit Bundle
                </h4>
                <div className="bg-slate-900 rounded-xl p-5 text-emerald-400 font-mono text-xs overflow-hidden leading-relaxed h-[216px] overflow-y-auto custom-scrollbar">
                  <div className="opacity-50"># Generating cryptographic proof...</div>
                  <div>&gt; Hash: 0x8f2a...c9d4</div>
                  <div>&gt; Timestamps synchronized.</div>
                  <div className="mt-4 opacity-50"># Verified Artifact Signatures</div>
                  {[
                    'sig_nppes_9f82kd01',
                    'sig_board_ca_09214',
                    'sig_dea_xz91823k',
                    'sig_oig_clear_101'
                  ].map((sig, i) => (
                    <div key={i} className="flex items-center gap-2 mt-1">
                      <span className="text-emerald-500/50">[OK]</span>
                      <span className="text-emerald-300">{sig}</span>
                    </div>
                  ))}
                  <div className="mt-4 p-3 border border-emerald-500/20 bg-emerald-500/10 rounded text-emerald-300 text-center hover:bg-emerald-500/20 cursor-pointer transition-colors">
                    Download Full Audit Proof (.zip)
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
