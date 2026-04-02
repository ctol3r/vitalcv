'use client';

import { FileArchive, Download, Lock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface AuditBundleProps {
  npi: string;
  bundleId: string;
  signatureStatus: 'VERIFIED' | 'INVALID' | 'UNVERIFIED';
  sizeBytes: number;
  timestamp: string;
}

export function AuditBundlePreview({ npi, bundleId, signatureStatus, sizeBytes, timestamp }: AuditBundleProps) {
  const isVerified = signatureStatus === 'VERIFIED';

  return (
    <div className="flex flex-col p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-vt-neutral-900/50">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-vt-neutral-900 shadow-sm border border-slate-200 dark:border-slate-800">
            <FileArchive className="w-8 h-8 text-slate-700 dark:text-slate-300" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100">Audit Bundle</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">NPI {npi}</p>
          </div>
        </div>
        
        {isVerified && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Cryptographically Verified</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 border-y border-slate-200 dark:border-slate-800 py-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Bundle ID</p>
          <p className="font-mono text-sm text-slate-800 dark:text-slate-200 truncate">{bundleId}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Generated</p>
          <p className="text-sm text-slate-800 dark:text-slate-200">{new Date(timestamp).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Size</p>
          <p className="text-sm text-slate-800 dark:text-slate-200">{(sizeBytes / 1024).toFixed(1)} KB</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Signature</p>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <p className="font-mono text-sm text-slate-800 dark:text-slate-200">SHA-256 RSA</p>
          </div>
        </div>
      </div>

      <button className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-foreground dark:text-slate-900 transition-colors font-medium">
        <Download className="w-4 h-4" />
        Download Complete Bundle
      </button>
    </div>
  );
}
