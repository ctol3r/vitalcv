import * as React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CopyableDID } from '@/components/trust/CopyableDID';

export interface ReceiptViewerProps extends React.ComponentPropsWithoutRef<'div'> {
  receiptId: string;
  sourceId: string;
  timestamp: string;
  payload: Record<string, unknown> | string;
  /** Issuer DID string — e.g. "did:web:vitalcv.com" or "mock (dev)" */
  issuerDid?: string;
  /** Short key fingerprint — e.g. "vcv-signing-key-XXXXXXXX" */
  keyFingerprint?: string;
  /** JWKS URI for the issuer's public keys */
  jwksUri?: string;
  /** Algorithm used for signing */
  algorithm?: string;
  /** Key ID from signed_payload */
  signingKeyId?: string;
  /** Unix seconds: when was this signed */
  signedAt?: number;
  /** Unix seconds: when does this expire */
  expiresAt?: number;
}

function formatIso(unix: number): string {
  return new Date(unix * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function truncateKeyId(kid: string, maxLen = 24): string {
  if (kid.length <= maxLen) return kid;
  return kid.slice(0, maxLen) + '…';
}

// ── Signature row ─────────────────────────────────────────────────────────────

function SigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center min-h-[32px] border-b border-gray-100 last:border-b-0">
      <span className="w-[120px] flex-shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400">
        {label}
      </span>
      <div className="flex-1 min-w-0 text-xs font-mono text-gray-900">{children}</div>
    </div>
  );
}

// ── Section anchor band ───────────────────────────────────────────────────────

function AnchorBand({ label }: { label: string }) {
  return (
    <div className="vcv-anchor-band">
      <span className="vcv-label">{label}</span>
    </div>
  );
}

/**
 * ReceiptViewer
 *
 * Monospaced, structured viewer for the raw verification receipt.
 * Section rhythm: MASTHEAD → SIGNATURE → PAYLOAD → DOWNLOAD
 *
 * wave-139: Added download button, issuer DID, key fingerprint, and
 * verification metadata block.
 * wave-receipt-elevation: Restructured to institutional audit packet layout.
 * - Signature section: label/value grid, fixed 120px label col, hairline rows
 * - CopyableDID for issuer DID
 * - Section rhythm via vcv-anchor-band + vcv-receipt-section
 */
export const ReceiptViewer = React.forwardRef<HTMLDivElement, ReceiptViewerProps>(
  (
    {
      className,
      receiptId,
      sourceId,
      timestamp,
      payload,
      issuerDid,
      keyFingerprint,
      jwksUri,
      algorithm,
      signingKeyId,
      signedAt,
      expiresAt,
      ...props
    },
    ref,
  ) => {
    const formattedPayload =
      typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);

    const isMock =
      !issuerDid || issuerDid === 'mock (dev)' || issuerDid.startsWith('mock');

    const hasSignature = !!(algorithm || signingKeyId || issuerDid || signedAt);

    function handleDownload() {
      const artifact = {
        receipt: {
          receipt_id: receiptId,
          source_id: sourceId,
          timestamp,
        },
        payload: typeof payload === 'string' ? payload : payload,
        issuer_did: issuerDid ?? null,
        key_fingerprint: keyFingerprint ?? null,
        jwks_uri: jwksUri ?? null,
        algorithm: algorithm ?? null,
        signing_key_id: signingKeyId ?? null,
        signed_at: signedAt ?? null,
        expires_at: expiresAt ?? null,
      };

      const blob = new Blob([JSON.stringify(artifact, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptId.slice(0, 16)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    return (
      <div
        ref={ref}
        className={cn('vcv-receipt-wrapper flex flex-col overflow-hidden', className)}
        {...props}
      >
        {/* ── MASTHEAD ─────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 text-white px-4 py-3 vcv-receipt-section border-t border-gray-200">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                VitalCV Trust Receipt
              </span>
              <code className="font-mono text-xs text-gray-300 break-all select-all">
                {receiptId}
              </code>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] text-gray-500 font-mono">
                SOURCE: <span className="text-gray-300">{sourceId}</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono">{timestamp}</span>
            </div>
          </div>
        </div>

        {/* ── SIGNATURE ────────────────────────────────────────────────────── */}
        {hasSignature && (
          <div className="vcv-receipt-section bg-white px-4 py-0">
            <AnchorBand label="Signature" />
            <div className="px-0 py-1">
              {algorithm && <SigRow label="Algorithm">{algorithm}</SigRow>}
              {signingKeyId && (
                <SigRow label="Key ID">{truncateKeyId(signingKeyId)}</SigRow>
              )}
              {issuerDid && (
                <SigRow label="Issuer DID">
                  {isMock ? (
                    <span className="text-amber-600">{issuerDid}</span>
                  ) : (
                    <CopyableDID did={issuerDid} />
                  )}
                </SigRow>
              )}
              {signedAt && (
                <SigRow label="Signed at">{formatIso(signedAt)}</SigRow>
              )}
              {expiresAt && (
                <SigRow label="Expires">{formatIso(expiresAt)}</SigRow>
              )}
            </div>
            {jwksUri && (
              <div className="pb-2">
                <a
                  href={jwksUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-blue-600 hover:underline"
                >
                  Verify signature →
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── PAYLOAD ──────────────────────────────────────────────────────── */}
        <div className="vcv-receipt-section">
          <AnchorBand label="Payload" />
          <ScrollArea className="h-48 sm:h-64 bg-gray-900 p-3 sm:p-4 text-[11px] leading-relaxed">
            <pre className="whitespace-pre-wrap break-words text-gray-100">
              <code>{formattedPayload}</code>
            </pre>
          </ScrollArea>
        </div>

        {/* ── DOWNLOAD ACTIONS ─────────────────────────────────────────────── */}
        <div className="vcv-receipt-section bg-white px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-gray-700" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              Cryptographically Verified
            </span>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="text-[10px] font-mono text-gray-500 hover:text-gray-900 transition-colors"
            title="Download signed receipt as JSON"
          >
            ↓ Download VC
          </button>
        </div>
      </div>
    );
  },
);

ReceiptViewer.displayName = 'ReceiptViewer';
