'use client';

import { Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { ClearToStartBanner } from '@/components/trust-state/ClearToStartBanner';
import { MonitoringStatusBadge } from '@/components/trust-state/MonitoringStatusBadge';
import { SanctionRiskBadge } from '@/components/trust-state/SanctionRiskBadge';
import { SourceProvenanceDrawer } from '@/components/trust-state/SourceProvenanceDrawer';
import { AuditTrailTimeline } from '@/components/trust-state/AuditTrailTimeline';
import { EvidenceArtifactPreview } from '@/components/trust-state/EvidenceArtifactPreview';
import { ShieldCheck, Fingerprint, Eye, FileText } from 'lucide-react';
import type { PASObject } from './types';

export function PasReceipt({ pas }: { pas?: PASObject }) {
  const [provenanceOpen, setProvenanceOpen] = useState(false);

  // Fallback to purely mocked Verifier Evidence Layout if pas object isn't provided (as per prompt instructions for Days 5-6)
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm font-sans flex flex-col">
      <ClearToStartBanner />

      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-start justify-between">
            <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">John Doe, MD</h1>
                <p className="text-sm text-slate-500 mt-1 font-mono">NPI: 1003000126</p>
            </div>
            <div className="flex flex-col items-end gap-2">
                <MonitoringStatusBadge active={true} lastMonitoredAt={new Date().toISOString()} />
                <SanctionRiskBadge hasRisk={false} />
            </div>
        </div>
      </div>

      <div className="p-6 border-b border-slate-100">
         <div className="flex items-center justify-between mb-4">
             <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Verified Evidence Artifacts</h2>
             <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">Minimum Necessary Scope</span>
         </div>

         <div className="space-y-3">
             {/* Mocked Fact #1 */}
             <div className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setProvenanceOpen(true)}>
                 <div className="flex justify-between items-start">
                     <div className="flex items-center gap-3">
                         <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-md">
                             <ShieldCheck className="h-4 w-4" />
                         </div>
                         <div>
                             <h4 className="text-sm font-semibold text-slate-800">State Medical License</h4>
                             <p className="text-xs text-slate-500 mt-0.5 font-mono">California Medical Board</p>
                         </div>
                     </div>
                     <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Active</span>
                 </div>
                 <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                     <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                         <Fingerprint className="h-3 w-3" />
                         <span>0x2cf24dba...9824</span>
                     </div>
                     <div className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                         <Eye className="h-3 w-3" /> View Provenance & Scope
                     </div>
                 </div>
                 <div className="mt-4 pt-3 border-t border-slate-100">
                    <EvidenceArtifactPreview 
                       artifactName="State Medical License"
                       fieldsDisclosed={['licenseNumber', 'issueDate', 'expirationDate', 'status']}
                       fieldsRedacted={['homeAddress', 'ssn', 'dateOfBirth']}
                    />
                 </div>
             </div>
             
             {/* Mocked Fact #2 */}
             <div className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setProvenanceOpen(true)}>
                 <div className="flex justify-between items-start">
                     <div className="flex items-center gap-3">
                         <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-md">
                             <ShieldCheck className="h-4 w-4" />
                         </div>
                         <div>
                             <h4 className="text-sm font-semibold text-slate-800">Board Certification</h4>
                             <p className="text-xs text-slate-500 mt-0.5 font-mono">American Board of Internal Medicine</p>
                         </div>
                     </div>
                     <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Active</span>
                 </div>
                 <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                     <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                         <Fingerprint className="h-3 w-3" />
                         <span>0x8b1a9953...c461</span>
                     </div>
                     <div className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                         <Eye className="h-3 w-3" /> View Provenance & Scope
                     </div>
                 </div>
                 <div className="mt-4 pt-3 border-t border-slate-100">
                    <EvidenceArtifactPreview 
                       artifactName="Board Certification"
                       fieldsDisclosed={['certificationId', 'specialty', 'status']}
                       fieldsRedacted={['examScore', 'ssn']}
                    />
                 </div>
             </div>

         </div>
      </div>

      <div className="bg-slate-50/50 p-6">
          <AuditTrailTimeline events={[
            {
              id: '1',
              type: 'VERIFICATION_REQUESTED',
              label: 'Verification Requested',
              timestamp: new Date(Date.now() - 5000).toISOString(),
              employer: 'Mercor Health',
              facility: 'HQ',
              metadata: {}
            },
            {
              id: '2',
              type: 'VERIFICATION_COMPLETED',
              label: 'Cryptographic Facts Processed',
              timestamp: new Date().toISOString(),
              hash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
              metadata: {}
            }
          ]} />
      </div>

      <SourceProvenanceDrawer 
          open={provenanceOpen} 
          onClose={() => setProvenanceOpen(false)} 
          retrieval={{
            method: 'API',
            retrievedAt: new Date().toISOString(),
            agent: { system: 'VitalCV Trusted Delegate', version: '2.4.1' },
            source: { sourceType: 'STATE_BOARD', sourceName: 'California Medical Board', authoritative: true, sourceUrl: '' }
          }}
          integrity={{
            signatureAlgorithm: 'ES256',
            publicKeyId: 'k1_prod_99xyz',
            artifactHash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
            rawPayloadHash: 'payload_hash_here',
            signedAt: new Date().toISOString()
          }}
      />
    </div>
  );
}
