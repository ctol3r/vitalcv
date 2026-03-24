'use client';

/**
 * SdkDocs.tsx — Substrate Consolidation: Phase 7
 *
 * Developer portal SDK documentation panel.
 * Covers: verifier-sdk, issuer-sdk, wallet-sdk.
 * Also links to conformance report.
 */

import React from 'react';
import { useState } from 'react';
import { Code2, Package, Shield, Award, Wallet } from 'lucide-react';
import { getPublicApiBase } from '@/lib/api';

type SdkId = 'verifier' | 'issuer' | 'wallet';

interface SdkDef {
  id: SdkId;
  name: string;
  package: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  install: string;
  quickstart: string;
  methods: Array<{ sig: string; desc: string }>;
}

export function buildSdkDefs(baseUrl: string): SdkDef[] {
  return [
    {
    id: 'verifier',
    name: 'Verifier SDK',
    package: '@vitalcv/verifier-sdk',
    description: 'For healthcare employers, staffing agencies, and credentialing bodies. Verify clinician trust states, check credential revocations, and accept presentations.',
    icon: <Shield className="h-4 w-4" />,
    color: 'emerald',
    install: 'npm install @vitalcv/verifier-sdk',
    quickstart: `import { createVerifier } from '@vitalcv/verifier-sdk';

const verifier = createVerifier({
  baseUrl: '${baseUrl}',
  apiKey: process.env.VITALCV_API_KEY,
});

// Check trust band (fast path)
const band = await verifier.getTrustBand('1234567890');
console.log(band.band); // 'L3'

// Full substrate trust state
const state = await verifier.getSubstrateTrustState('1234567890');
console.log(state.haipCompliance.compliant); // true

// Verify a VP-JWT presentation
const result = await verifier.verifyPresentation({ vpJwt });
if (result.valid) {
  await verifier.acceptPresentation({ presentationId: result.presentationId });
}

// Selective disclosure
const sd = await verifier.requestSelectiveDisclosure({
  subject: '1234567890',
  claims: ['state', 'licenseNumber'],
});`,
    methods: [
      { sig: 'getTrustBand(npi)', desc: 'Fast L0–L3 band check' },
      { sig: 'getSubstrateTrustState(npi)', desc: 'Full HAIP + federation + revocation state' },
      { sig: 'getPublicProfile(npi)', desc: 'Public trust profile' },
      { sig: 'verifyPresentation({ vpJwt })', desc: 'Verify VP-JWT presentation' },
      { sig: 'acceptPresentation({ presentationId })', desc: 'Record acceptance in audit ledger' },
      { sig: 'requestSelectiveDisclosure({ subject, claims })', desc: 'SD-JWT selective claim disclosure' },
      { sig: 'checkRevocation(credentialId)', desc: 'Single credential revocation check' },
      { sig: 'listRevocations({ offset, limit })', desc: 'Paginated revocation ledger' },
      { sig: 'getAuditEvents({ after, limit })', desc: 'Cursor-based audit event export' },
    ],
  },
    {
    id: 'issuer',
    name: 'Issuer SDK',
    package: '@vitalcv/issuer-sdk',
    description: 'For medical licensing boards, certification bodies, and hospital credentialing departments. Issue HAIP-compliant verifiable credentials with SD-JWT support.',
    icon: <Award className="h-4 w-4" />,
    color: 'blue',
    install: 'npm install @vitalcv/issuer-sdk',
    quickstart: `import { createIssuer } from '@vitalcv/issuer-sdk';

const issuer = createIssuer({
  baseUrl: '${baseUrl}',
  apiKey: process.env.VITALCV_ISSUER_KEY!,
  issuerId: 'did:vitalcv:org_ca_medical_board',
});

// Issue a credential
const vc = await issuer.issueCredential({
  npi: '1234567890',
  credentialType: 'MedicalLicense',
  claims: { state: 'CA', licenseNumber: 'A12345' },
  selectiveDisclosure: true,
  disclosableFields: ['licenseNumber'],
});
console.log(vc.haipCompliant); // true

// Create OID4VCI offer for wallet pickup
const offer = await issuer.createOID4VCICredentialOffer({
  npi: '1234567890',
  credentialType: 'BoardCertification',
});

// Revoke (triggers cascade)
await issuer.revokeCredential(vc.credentialId, {
  reason: 'License expired',
  permanent: true,
});`,
    methods: [
      { sig: 'issueCredential(req)', desc: 'Issue HAIP-compliant VC with SD-JWT support' },
      { sig: 'createOID4VCICredentialOffer(req)', desc: 'Create OID4VCI wallet offer with QR code' },
      { sig: 'revokeCredential(credentialId, opts)', desc: 'Revoke + trigger cascade analysis' },
      { sig: 'updateCredentialStatuses(updates)', desc: 'Bulk status update' },
      { sig: 'registerIssuer(params)', desc: 'Register in VitalCV trust registry' },
      { sig: 'getStats()', desc: 'Issuance analytics and trust score' },
    ],
  },
    {
    id: 'wallet',
    name: 'Wallet SDK',
    package: '@vitalcv/wallet-sdk',
    description: 'For clinician apps, mobile wallets, and holder agents. Manage credentials, generate presentations, respond to OID4VP requests, and perform selective disclosure.',
    icon: <Wallet className="h-4 w-4" />,
    color: 'purple',
    install: 'npm install @vitalcv/wallet-sdk',
    quickstart: `import { createWallet } from '@vitalcv/wallet-sdk';

const wallet = createWallet({
  baseUrl: '${baseUrl}',
  npi: '1234567890',
  holderDid: 'did:vitalcv:clinician_1234567890',
  token: sessionToken,
});

// Wallet summary
const summary = await wallet.getSummary();
console.log(summary.trustBand);     // 'L3'
console.log(summary.expiringCredentials); // 1

// List credentials
const creds = await wallet.listCredentials({ status: 'VALID' });

// Present to a verifier
const vp = await wallet.createPresentation({
  credentialIds: [creds[0].credentialId],
  verifierDid: 'did:vitalcv:org_hospital',
  challenge: crypto.randomUUID(),
});

// Selective disclosure
const sd = await wallet.presentSelectiveDisclosure({
  claims: ['state', 'certificationDate'],
});

// OID4VP cross-device flow
await wallet.respondToOID4VPRequest({
  presentationRequestUri: 'openid4vp://...',
});`,
    methods: [
      { sig: 'getSummary()', desc: 'Wallet summary with trust band and expiry warnings' },
      { sig: 'listCredentials(filter?)', desc: 'All credentials with status and expiry info' },
      { sig: 'getCredential(credentialId)', desc: 'Single credential with full VC-JWT' },
      { sig: 'removeCredential(credentialId)', desc: 'Remove from wallet' },
      { sig: 'createPresentation(req)', desc: 'Generate VP-JWT for selected credentials' },
      { sig: 'presentSelectiveDisclosure(req)', desc: 'SD-JWT selective claim presentation' },
      { sig: 'respondToOID4VPRequest(req)', desc: 'OID4VP cross-device / same-device flow' },
      { sig: 'acceptCredentialOffer(offer)', desc: 'Accept OID4VCI offer and store credential' },
      { sig: 'getTrustState()', desc: 'Current L0–L3 trust band for this NPI' },
    ],
  },
  ];
}

const COLOR_MAP: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-400',
  blue:    'border-blue-500/30 bg-blue-500/[0.04] text-blue-400',
  purple:  'border-purple-500/30 bg-purple-500/[0.04] text-purple-400',
};

const ACTIVE_MAP: Record<string, string> = {
  emerald: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  blue:    'bg-blue-500/15 border-blue-500/30 text-blue-300',
  purple:  'bg-purple-500/15 border-purple-500/30 text-purple-300',
};

export function SdkDocs() {
  const [activeSdk, setActiveSdk] = useState<SdkId>('verifier');
  const baseUrl = getPublicApiBase();
  const sdks = buildSdkDefs(baseUrl);
  const sdk = sdks.find((s) => s.id === activeSdk)!;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
        <Package className="h-4 w-4 text-zinc-400" />
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">SDK Documentation</h3>
          <p className="text-xs text-zinc-500">verifier-sdk · issuer-sdk · wallet-sdk</p>
        </div>
      </div>

      <div className="flex">
        {/* SDK Selector */}
        <div className="w-48 border-r border-zinc-800 p-3 shrink-0">
          <p className="text-[9px] text-zinc-700 uppercase tracking-widest px-2 pb-2">Packages</p>
          <div className="space-y-1">
            {sdks.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSdk(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 border transition-colors ${
                  activeSdk === s.id
                    ? ACTIVE_MAP[s.color]
                    : 'border-transparent text-zinc-400 hover:bg-white/[0.03]'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SDK Content */}
        <div className="flex-1 p-6 overflow-y-auto max-h-[600px] space-y-6">
          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs ${COLOR_MAP[sdk.color]}`}>
                {sdk.icon}
                {sdk.package}
              </div>
            </div>
            <p className="text-sm text-zinc-400">{sdk.description}</p>
          </div>

          {/* Install */}
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Install</p>
            <div className="rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 font-mono text-xs text-emerald-400">
              {sdk.install}
            </div>
          </div>

          {/* Quickstart */}
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Code2 className="h-3 w-3" />
              Quickstart
            </p>
            <pre className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
              {sdk.quickstart}
            </pre>
          </div>

          {/* Methods */}
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">API Reference</p>
            <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800/60">
              {sdk.methods.map((m) => (
                <div key={m.sig} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                  <code className="text-[11px] font-mono text-emerald-400 shrink-0 mt-0.5">{m.sig}</code>
                  <p className="text-xs text-zinc-500">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
