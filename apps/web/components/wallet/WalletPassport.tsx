'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrustStateCard } from '@/components/trust-state/TrustStateCard';
import { CredentialFactCard } from '@/components/trust-state/CredentialFactCard';
import { MonitoringStatusBadge } from '@/components/trust-state/MonitoringStatusBadge';
import { SanctionRiskBadge } from '@/components/trust-state/SanctionRiskBadge';
import { DisclosureScopePanel } from '@/components/trust-state/DisclosureScopePanel';
import { ClearToStartBanner } from '@/components/trust-state/ClearToStartBanner';
import { SourceProvenanceDrawer } from '@/components/trust-state/SourceProvenanceDrawer';
import { Share2, Fingerprint, RefreshCw } from 'lucide-react';
import type { TrustStateCardData, CredentialRow } from '@/components/trust-state/types';

// Mocked Canonical Facts matching the prompt requirements
const MOCK_TRUST_STATE: TrustStateCardData = {
  band: 'GREEN',
  windowStatus: 'WITHIN_WINDOW',
  verifiedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  validUntil: new Date(Date.now() + 86400000 * 118).toISOString(),
  daysRemaining: 118,
  windowDays: 120,
  startReady: true,
  blockingReasons: [],
};

const MOCK_CREDENTIALS: CredentialRow[] = [
  {
    credentialType: 'STATE_LICENSE',
    status: 'ACTIVE',
    issuer: 'Medical Board of California',
    issuingStateOrBody: 'State of California',
    credentialIdentifier: 'A-123456',
    issueDate: '2020-01-01T00:00:00.000Z',
    expirationDate: '2025-01-01T00:00:00.000Z',
  },
  {
    credentialType: 'BOARD_CERTIFICATION',
    status: 'ACTIVE',
    issuer: 'American Board of Internal Medicine (ABIM)',
    issuingStateOrBody: 'ABIM',
    credentialIdentifier: '11002233',
    issueDate: '2019-06-15T00:00:00.000Z',
    expirationDate: '2029-12-31T00:00:00.000Z',
  },
  {
    credentialType: 'DEA_REGISTRATION',
    status: 'PENDING',
    issuer: 'Drug Enforcement Administration',
    issuingStateOrBody: 'Federal',
    credentialIdentifier: 'XY9876543',
    issueDate: '',
    expirationDate: '',
  }
];

export function WalletPassport({ npi = '1003000126' }: { npi?: string; pollIntervalMs?: number }) {
  const [presenting, setPresenting] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [provenanceOpen, setProvenanceOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl mx-auto flex flex-col">
      {MOCK_TRUST_STATE.startReady && <ClearToStartBanner />}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Portable Trust Wallet</h2>
          <p className="text-xs text-slate-500 mt-0.5">NPI: {npi}</p>
        </div>
        <div className="flex gap-2">
           <SanctionRiskBadge hasRisk={false} />
           <MonitoringStatusBadge active={true} lastMonitoredAt={new Date().toISOString()} />
        </div>
      </div>

      <TrustStateCard data={MOCK_TRUST_STATE} />

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
           <h3 className="text-sm font-semibold text-slate-700 tracking-tight">Source-Backed Credentials</h3>
           <span className="text-xs font-mono text-slate-400">{MOCK_CREDENTIALS.length} verified facts</span>
        </div>
        
        <div className="grid gap-4">
          {MOCK_CREDENTIALS.map((cred, i) => (
            <div key={i} onClick={() => setProvenanceOpen(true)} className="cursor-pointer hover:opacity-90 transition-opacity">
              <CredentialFactCard credential={cred} />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200 space-y-4">
         {!showDisclosure ? (
           <button 
             onClick={() => setShowDisclosure(true)}
             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 flex items-center justify-center gap-2 font-medium shadow-sm transition-colors"
           >
             <Share2 className="w-4 h-4" /> Present Cryptographic Evidence
           </button>
         ) : (
           <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 overflow-hidden">
             <DisclosureScopePanel purposes={['Hospital Privileging', 'Payer Enrollment']} expiresInDays={30} />
             <div className="flex gap-3">
               <button 
                 onClick={() => setShowDisclosure(false)}
                 className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg py-3 font-medium transition-colors"
               >
                 Cancel
               </button>
               <button 
                 onClick={() => {
                    setPresenting(true);
                    setTimeout(() => setPresenting(false), 2000);
                 }}
                 disabled={presenting}
                 className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-3 flex items-center justify-center gap-2 font-medium shadow-sm transition-colors disabled:opacity-50"
               >
                 {presenting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                 {presenting ? 'Generating Signature...' : 'Confirm & Sign'}
               </button>
             </div>
           </motion.div>
         )}
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
