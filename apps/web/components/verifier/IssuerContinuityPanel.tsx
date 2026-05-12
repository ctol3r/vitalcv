'use client';

/**
 * IssuerContinuityPanel.tsx
 *
 * Shows issuer DID, JWKS URI, key fingerprint, rotation status, and
 * a link to /.well-known/did.json for issuer verification.
 *
 * Design: Bloomberg header style, fixed-width label column, monospaced values.
 * wave-receipt-elevation: Full kid display, EC P-256 label, verify → link.
 */

import { CopyableDID } from '@/components/trust/CopyableDID';

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
    <div className="border border-gray-200 overflow-hidden rounded-none">
      {/* Header — Bloomberg style */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          Issuer Continuity
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Issuer DID */}
        <IssuerRow label="Issuer">
          <CopyableDID did={did} />
        </IssuerRow>

        {/* JWKS URI */}
        <IssuerRow label="JWKS URI">
          <a
            href={JWKS_URI}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-gray-800 hover:text-gray-600 break-all"
          >
            {JWKS_URI}
          </a>
        </IssuerRow>

        {/* Key fingerprint */}
        <IssuerRow label="Key Fingerprint">
          {signingKeyId ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-800 break-all">{signingKeyId}</span>
                <a
                  href={JWKS_URI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-mono text-blue-600 hover:underline flex-shrink-0"
                >
                  verify →
                </a>
              </div>
              <span className="text-[10px] text-gray-400">EC P-256 · ES256 · Active</span>
            </div>
          ) : (
            <span className="text-[10px] text-gray-400 italic">No key bound (dev mode)</span>
          )}
        </IssuerRow>

        {/* Key rotation */}
        <IssuerRow label="Last Rotation">
          <span className="text-xs font-mono text-gray-500">N/A</span>
        </IssuerRow>
      </div>

      {/* Verify issuer — link with → arrow, not a button */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
        <a
          href={DID_DOC_URI}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono uppercase tracking-[0.08em] text-gray-500 hover:text-gray-900 transition-colors"
        >
          Verify issuer →
        </a>
        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
          /.well-known/did.json · {did}
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
    <div className="flex items-start gap-3 px-3 min-h-[32px] py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 w-[140px] flex-shrink-0 pt-0.5">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
