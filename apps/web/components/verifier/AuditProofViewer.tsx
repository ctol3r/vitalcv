'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, FileText, CheckCircle2, History, Link, KeyRound, ExternalLink, Download } from 'lucide-react';

interface ProofEvidence {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  signature: string;
  documentHash: string;
}

const evidenceData: ProofEvidence[] = [
  {
    id: 'ev_098f6bcd',
    type: 'Primary Source Verification',
    source: 'National Student Clearinghouse',
    timestamp: '2026-03-14T10:00:00Z',
    signature: 'sig_a1b2c3d4e5f6',
    documentHash: '0x3a4b...9f8e',
  },
  {
    id: 'ev_1a2b3c4d',
    type: 'Identity Bound',
    source: 'Clear Identity, Inc.',
    timestamp: '2026-03-14T09:45:00Z',
    signature: 'sig_f6e5d4c3b2a1',
    documentHash: '0x1c2d...4e5f',
  }
];

export function AuditProofViewer() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-12 lg:p-24 selection:bg-indigo-100">
      <div className="max-w-6xl mx-auto flex flex-col gap-12">
        {/* Header - Serious, Authority */}
        <header className="flex flex-col gap-3 pb-8 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded text-xs font-mono font-bold tracking-widest uppercase">Verifier Console</span>
            <span className="text-slate-400 font-mono text-xs">{'// Immutable Audit Trail'}</span>
          </div>
          <h1 className="text-3xl font-serif text-slate-900">Cryptographic Proof Inspection</h1>
          <p className="text-slate-500 max-w-2xl text-sm font-mono leading-relaxed">
            Reviewing direct primary source evidence. Trust is derived from mathematical guarantees and provenance chains, not arbitrary indicators.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Inspection Panel (Col Span 2) */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* Credential Summary & Verification Evidence */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-foreground">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <h2 className="font-mono font-medium text-sm">Medical Degree Artifact</h2>
                </div>
                <div className="flex gap-2">
                  <button className="text-foreground hover:text-foreground p-2 transition-colors"><Download className="w-4 h-4" /></button>
                  <button className="text-foreground hover:text-foreground p-2 transition-colors"><ExternalLink className="w-4 h-4" /></button>
                </div>
              </div>
              
              <div className="p-6">
                <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-4">Verification Evidence</h3>
                
                <div className="space-y-4">
                  {evidenceData.map((evidence, idx) => (
                    <motion.div 
                      key={evidence.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="border border-slate-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all bg-slate-50 relative overflow-hidden group"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/0 group-hover:bg-indigo-500 transition-colors" />
                      
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="font-medium text-slate-900">{evidence.type}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">{new Date(evidence.timestamp).toLocaleTimeString()}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm font-mono mt-4 pt-4 border-t border-slate-200">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase mb-1">Source Authority</span>
                          <span className="text-slate-700">{evidence.source}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase mb-1">Document Hash</span>
                          <span className="text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">{evidence.documentHash}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 block text-[10px] uppercase mb-1">Digital Signature</span>
                          <span className="text-slate-500 break-all bg-slate-100 px-2 py-1 rounded block mt-1">{evidence.signature}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Audit Bundle Preview */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                <History className="w-4 h-4" /> Audit Bundle Payload
              </h3>
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] text-emerald-400/80 overflow-x-auto">
                <pre>{JSON.stringify({
                  "@context": ["https://www.w3.org/2018/credentials/v1"],
                  "type": ["VerifiableCredential", "MedicalDegree"],
                  "issuer": "did:web:vitalcv.com:nsc",
                  "issuanceDate": "2026-03-14T10:00:00Z",
                  "credentialSubject": {
                    "id": "did:key:z6MkhaXgBZDvotDkL5...",
                    "degree": "Doctor of Medicine"
                  },
                  "proof": {
                    "type": "Ed25519Signature2018",
                    "created": "2026-03-14T10:00:00Z",
                    "jws": "eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..Y2I..."
                  }
                }, null, 2)}</pre>
              </div>
            </div>
          </div>

          {/* Sidebar: Provenance Visualization */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
              <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                <Link className="w-5 h-5 text-indigo-600" />
                <h3 className="font-serif text-lg">Provenance Chain</h3>
              </div>

              <div className="relative pl-6 space-y-8 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500 before:via-slate-200 before:to-transparent">
                
                <div className="relative z-10">
                  <div className="w-6 h-6 absolute -left-9 bg-indigo-500 rounded-full flex items-center justify-center ring-4 ring-white">
                    <CheckCircle2 className="w-4 h-4 text-foreground" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Current Validation</h4>
                  <p className="text-xs font-mono text-slate-500 mt-1">Selective-disclosure proof verified. Signature integrity confirmed.</p>
                </div>

                <div className="relative z-10">
                  <div className="w-6 h-6 absolute -left-9 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center ring-4 ring-white">
                    <KeyRound className="w-3 h-3 text-slate-500" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Holder Anchored</h4>
                  <p className="text-xs font-mono text-slate-500 mt-1">Bound to clinician DID via biometric signature payload.</p>
                </div>

                <div className="relative z-10">
                  <div className="w-6 h-6 absolute -left-9 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center ring-4 ring-white">
                    <ShieldCheck className="w-3 h-3 text-slate-500" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Issuer Attestation</h4>
                  <p className="text-xs font-mono text-slate-500 mt-1">Issued and cryptographically signed by verified primary source entity.</p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
