'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, ShieldCheck } from 'lucide-react';
import { GraphNode } from './types';
import { GraphTokens } from '@/lib/design/graph-tokens';
import { VerificationChain } from './VerificationChain';

interface CredentialInspectorProps {
  node: GraphNode | null;
  onClose: () => void;
}

export function CredentialInspector({ node, onClose }: CredentialInspectorProps) {
  if (!node) return null;

  const isVerified = node.trustState === 'GREEN';

  // Mocking some verification steps based on the node for demonstration
  const getMockSteps = () => [
    { id: '1', label: 'Issuer Signature Checked', status: 'verified', hash: '0x32f...91a', type: 'signature' },
    { id: '2', label: 'Revocation Registry Check', status: isVerified ? 'verified' : 'failed', timestamp: 'Just now', type: 'registry' },
    { id: '3', label: 'Temporal Expiration', status: 'verified', type: 'expiration' }
  ] as any;

  return (
    <AnimatePresence>
      <motion.div
        className="absolute top-4 right-4 bottom-4 w-80 md:w-[22rem] bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col z-20 overflow-hidden"
        initial={{ opacity: 0, x: 50, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.95 }}
        transition={GraphTokens.motion.spring.gentle}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{node.group}</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-foreground hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-700">
          <div className="flex items-start justify-between mb-6 gap-4">
            <h3 className="text-xl font-medium text-foreground leading-tight">{node.label}</h3>
            {isVerified ? (
              <ShieldCheck className="w-8 h-8 text-emerald-500 shrink-0" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-amber-500 shrink-0" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30 text-center">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Status</span>
              <span className={`text-sm font-semibold capitalize ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                {node.status || 'Active'}
              </span>
            </div>
            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30 text-center">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Network</span>
              <span className="text-sm font-semibold text-slate-200">VitalCV Mainnet</span>
            </div>
          </div>

          {node.auditHash && (
            <div className="mb-6">
               <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-2">Cryptographic Artifact Hash</span>
               <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 break-all select-all">
                 {node.auditHash}
               </div>
            </div>
          )}

          <VerificationChain steps={getMockSteps()} />
        </div>
        
        {/* Detail Action Footer */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex gap-3">
          <button className="flex-1 bg-white text-slate-900 font-medium py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors">
            View Source Data
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
