'use client';

import { AuditBundlePreview } from './AuditBundlePreview';
import { ProvenanceTimeline, TimelineEvent } from './ProvenanceTimeline';
import { CheckCircle2, AlertTriangle, XCircle, FileCode2 } from 'lucide-react';

export interface Artifact {
  id: string;
  name: string;
  hash: string;
  verifiedAt: string;
  type: string;
}

export interface DecisionCapsule {
  id: string;
  clinicianName: string;
  npi: string;
  decisionStatus: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
  decisionTimestamp: string;
  verifierOrganization: string;
  artifacts: Artifact[];
  provenanceEvents: TimelineEvent[];
  bundle: {
    bundleId: string;
    signatureStatus: 'VERIFIED' | 'INVALID' | 'UNVERIFIED';
    sizeBytes: number;
    timestamp: string;
  };
}

interface DecisionCapsuleViewerProps {
  capsule: DecisionCapsule;
}

const STATUS_CONFIG = {
  APPROVED: {
    label: 'Cleared for Start',
    color: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  CONDITIONAL: {
    label: 'Conditional Approval',
    color: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
  },
  REJECTED: {
    label: 'Not Ready',
    color: 'text-red-600 dark:text-red-400',
    icon: XCircle,
  },
};

export function DecisionCapsuleViewer({ capsule }: DecisionCapsuleViewerProps) {
  const config = STATUS_CONFIG[capsule.decisionStatus];
  const StatusIcon = config.icon;

  return (
    <div className="max-w-7xl mx-auto py-16 px-6 sm:px-12 space-y-16">
      {/* Header / Decision Summary */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-12 pb-16 border-b border-black/5 dark:border-white/5">
        <div className="space-y-6">
          <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.2em] mb-4">Decision Capsule</p>
          <div className="flex items-center gap-4">
            <StatusIcon className={`w-10 h-10 ${config.color}`} strokeWidth={1.5} />
            <h1 className={`text-5xl md:text-6xl font-light tracking-tight ${config.color} uppercase`}>
              {config.label}
            </h1>
          </div>
          <div className="flex items-center gap-6 mt-6">
            <span className="text-xl font-medium text-slate-700 dark:text-vt-neutral-300">
              {capsule.clinicianName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-vt-neutral-800 px-4 py-2 rounded-lg">
              NPI: {capsule.npi}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col md:items-end gap-3 text-left md:text-right bg-slate-50 dark:bg-vt-neutral-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Verifier Organization</p>
          <p className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">{capsule.verifierOrganization}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Decision Timestamp</p>
          <p className="text-slate-600 dark:text-slate-400 font-mono text-sm tracking-wider">{new Date(capsule.decisionTimestamp).toLocaleString()}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Left Column: Provenance & Artifacts */}
        <div className="lg:col-span-7 space-y-16">
          <section>
            <h2 className="text-2xl font-light tracking-tight text-slate-900 dark:text-slate-100 mb-8 border-b border-black/5 dark:border-white/5 pb-4">
              Verification Provenance
            </h2>
            <ProvenanceTimeline events={capsule.provenanceEvents} />
          </section>

          <section>
            <h2 className="text-2xl font-light tracking-tight text-slate-900 dark:text-slate-100 mb-8 border-b border-black/5 dark:border-white/5 pb-4">
              Credential Artifacts
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {capsule.artifacts.map(artifact => (
                <div key={artifact.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-vt-neutral-900 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 text-slate-400 dark:text-slate-500 transition-colors group-hover:text-blue-500">
                      <FileCode2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{artifact.name}</p>
                      <p className="text-xs uppercase text-slate-500 font-mono tracking-wider mt-1">{artifact.type}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-1 px-14 sm:px-0">
                    <span className="font-mono text-xs text-slate-400 uppercase">Artifact Hash</span>
                    <span className="font-mono text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={artifact.hash}>{artifact.hash}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Audit Bundle Preview */}
        <div className="lg:col-span-5 relative">
          <div className="sticky top-8">
             <h2 className="text-2xl font-light tracking-tight text-slate-900 dark:text-slate-100 mb-8 border-b border-black/5 dark:border-white/5 pb-4">
               Audit Bundle
             </h2>
             <AuditBundlePreview 
                npi={capsule.npi}
                bundleId={capsule.bundle.bundleId}
                signatureStatus={capsule.bundle.signatureStatus}
                sizeBytes={capsule.bundle.sizeBytes}
                timestamp={capsule.bundle.timestamp}
             />
          </div>
        </div>
      </div>
    </div>
  );
}
