'use client';

import { motion } from 'framer-motion';
import { GraphTokens } from '@/lib/design/graph-tokens';
import { CheckCircle2, Shield, Lock, ExternalLink } from 'lucide-react';

interface VerificationStep {
  id: string;
  label: string;
  status: 'pending' | 'verified' | 'failed';
  timestamp?: string;
  hash?: string;
  type: 'signature' | 'registry' | 'expiration' | 'semantic';
}

interface VerificationChainProps {
  steps: VerificationStep[];
}

export function VerificationChain({ steps }: VerificationChainProps) {
  return (
    <div className="flex flex-col gap-4 mt-6">
      <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Verification Chain</h4>
      <div className="relative pl-4 space-y-6 border-l border-slate-700">
        {steps.map((step, idx) => (
          <motion.div 
            key={step.id} 
            className="relative"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1, ...GraphTokens.motion.spring.gentle }}
          >
            {/* Step Marker */}
            <div className="absolute -left-[21px] top-0.5 bg-slate-900 rounded-full p-0.5">
              {step.status === 'verified' && <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />}
              {step.status === 'failed' && <Shield className="w-4 h-4 text-rose-500 fill-rose-500/20" />}
              {step.status === 'pending' && <div className="w-4 h-4 border-2 border-slate-600 rounded-full" />}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">{step.label}</span>
                {step.timestamp && <span className="text-[10px] text-slate-500">{step.timestamp}</span>}
              </div>
              
              {step.hash && (
                <div className="flex items-center gap-2 mt-1 px-2 py-1.5 bg-slate-800/50 rounded border border-slate-700/50 w-full overflow-hidden group hover:bg-slate-800 transition-colors">
                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                  <code className="text-[10px] text-slate-400 truncate font-mono">{step.hash}</code>
                  <ExternalLink className="w-3 h-3 text-slate-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
