'use client';

import { Drawer } from '@/components/ui/Drawer';
import { Network, ShieldCheck } from 'lucide-react';
import type { RetrievalData, IntegrityPanelData } from './types';

export function SourceProvenanceDrawer({
  open,
  onClose,
  retrieval,
  integrity,
}: {
  open: boolean;
  onClose: () => void;
  retrieval?: RetrievalData;
  integrity?: IntegrityPanelData;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Network className="w-4 h-4 text-emerald-400" /> Source Provenance</span>} width="md">
      <div className="p-6 space-y-8 text-slate-300 font-sans">
        
        {/* Header summary */}
        <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5" />
            <div>
              <h3 className="text-emerald-50 font-medium">Source-Backed Fact</h3>
              <p className="text-sm text-emerald-200/70 mt-1 leading-relaxed">
                This credential fact was retrieved directly from an authoritative primary source and cryptographically signed to guarantee untampered provenance.
              </p>
            </div>
          </div>
        </div>

        {/* Source Details */}
        {retrieval && (
          <section className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-border pb-2">Retrieval Details</h4>
            <dl className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <dt className="text-slate-500 mb-1">Source Name</dt>
                <dd className="font-medium text-slate-200">{retrieval.source.sourceName}</dd>
              </div>
              <div>
                <dt className="text-slate-500 mb-1">Source Type</dt>
                <dd className="font-mono text-xs bg-slate-800 text-slate-300 inline-block px-1.5 py-0.5 rounded">{retrieval.source.sourceType}</dd>
              </div>
              <div>
                <dt className="text-slate-500 mb-1">Retrieval Method</dt>
                <dd className="font-mono text-xs text-slate-300">{retrieval.method}</dd>
              </div>
              <div>
                <dt className="text-slate-500 mb-1">Timestamp</dt>
                <dd className="font-mono text-xs text-slate-300">{new Date(retrieval.retrievedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </section>
        )}

        {/* Cryptographic Integrity */}
        {integrity && (
          <section className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-border pb-2">Cryptographic Integrity</h4>
            <div className="bg-[#12141a] border border-white/5 rounded-md p-4 font-mono text-xs break-all space-y-4">
              <div>
                <span className="text-slate-500 block mb-1 uppercase text-[10px] tracking-wider">Algorithm</span>
                <span className="text-blue-400">{integrity.signatureAlgorithm}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 uppercase text-[10px] tracking-wider">Public Key ID</span>
                <span className="text-slate-300">{integrity.publicKeyId}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 uppercase text-[10px] tracking-wider">Artifact Hash</span>
                <span className="text-slate-400">{integrity.artifactHash}</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
}
