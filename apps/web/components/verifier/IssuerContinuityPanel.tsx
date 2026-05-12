'use client';

/**
 * IssuerContinuityPanel.tsx
 *
 * Shows issuer DID, JWKS URI, key fingerprint, rotation status, and
 * a link to /.well-known/did.json for issuer verification.
 */

import { ExternalLink, ShieldCheck } from 'lucide-react';

interface IssuerContinuityPanelProps {
  /** Override if needed; defaults to the canonical VitalCV DID */
  did?: string;
  /** Signing key ID from the receipt */
  signingKeyId?: string | null;
}

const ISSUER_DID = 'did:web:vitalcv.com';
const JWKS_URI = 'https://vitalcv.com/.well-known/jwks.json';
const DID_DOC_URI = '/.well-known/did.json';

export function IssuerContinuityPanel({
  did = ISSUER_DID,
  signingKeyId,
}: IssuerContinuityPanelProps) {
  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Issuer Continuity
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Issuer DID */}
        <IssuerRow label="Issuer">
          <span className="font-mono text-xs text-gray-800">{did}</span>
        </IssuerRow>

        {/* JWKS URI */}
        <IssuerRow label="JWKS URI">
          <a
            href={JWKS_URI}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-mono text-blue-600 hover:underline"
          >
            {JWKS_URI}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        </IssuerRow>

        {/* Key fingerprint */}
        <IssuerRow label="Key fingerprint">
          <span className="font-mono text-xs text-gray-800 break-all">
            {signingKeyId ?? '—'}
          </span>
        </IssuerRow>

        {/* Key rotation */}
        <IssuerRow label="Last key rotation">
          <span className="text-xs text-gray-500">N/A</span>
        </IssuerRow>
      </div>

      {/* Verify issuer action */}
      <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-200">
        <a
          href={DID_DOC_URI}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-black text-white hover:bg-gray-800 transition-colors"
        >
          Verify issuer
          <ExternalLink className="w-3 h-3" />
        </a>
        <p className="text-[10px] text-gray-400 mt-1.5">
          Links to <code className="font-mono">/.well-known/did.json</code> — W3C DID document for{' '}
          <span className="font-mono">{did}</span>
        </p>
      </div>
    </div>
  );
}

function IssuerRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <span className="text-[10px] text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
