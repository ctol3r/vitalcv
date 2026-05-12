import * as React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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

/**
 * ReceiptViewer
 *
 * Monospaced, highly structured viewer for the raw verification receipt,
 * proving the source artifact's authenticity and timestamp.
 *
 * wave-139: Added download button, issuer DID, key fingerprint,
 * and verification metadata block.
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
      issuerDid === 'mock (dev)' || !issuerDid || issuerDid.startsWith('mock');

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
        className={cn(
          'flex flex-col border border-border rounded overflow-hidden font-mono bg-black text-foreground/80',
          className,
        )}
        {...props}
      >
        {/* Header row */}
        <div className="flex flex-wrap text-[10px] sm:text-xs items-center justify-between border-b border-border bg-muted py-2 px-3">
          <div className="flex flex-col sm:flex-row sm:gap-4 gap-1">
            <span className="text-muted-foreground">
              RECEIPT_ID: <span className="text-foreground">{receiptId}</span>
            </span>
            <span className="text-muted-foreground">
              SOURCE: <span className="text-foreground">{sourceId}</span>
            </span>
          </div>
          <span className="text-muted-foreground">{timestamp}</span>
        </div>

        {/* Payload */}
        <ScrollArea className="h-48 sm:h-64 bg-black/50 p-3 sm:p-4 text-[11px] leading-relaxed">
          <pre className="whitespace-pre-wrap break-words">
            <code>{formattedPayload}</code>
          </pre>
        </ScrollArea>

        {/* Verification metadata block */}
        {(issuerDid || keyFingerprint || algorithm || signingKeyId) && (
          <div className="border-t border-border bg-white/[0.03] px-3 py-2 space-y-1">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
              Verification metadata
            </p>
            {issuerDid && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground/70 w-20 shrink-0">Issuer:</span>
                <span
                  className={
                    isMock ? 'text-amber-500/80' : 'text-foreground/70'
                  }
                >
                  {issuerDid}
                </span>
              </div>
            )}
            {keyFingerprint && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground/70 w-20 shrink-0">Key:</span>
                <span className="font-mono text-foreground/70">{keyFingerprint}</span>
              </div>
            )}
            {algorithm && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground/70 w-20 shrink-0">Algorithm:</span>
                <span className="font-mono text-foreground/70">{algorithm}</span>
              </div>
            )}
            {signingKeyId && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground/70 w-20 shrink-0">Key ID:</span>
                <span className="font-mono text-foreground/70">{signingKeyId}</span>
              </div>
            )}
            {signedAt && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground/70 w-20 shrink-0">Signed at:</span>
                <span className="font-mono text-foreground/70">
                  {new Date(signedAt * 1000).toISOString()}
                </span>
              </div>
            )}
            {expiresAt && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground/70 w-20 shrink-0">Expires at:</span>
                <span className="font-mono text-foreground/70">
                  {new Date(expiresAt * 1000).toISOString()}
                </span>
              </div>
            )}
            {jwksUri && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground/70 w-20 shrink-0">JWKS:</span>
                <a
                  href={jwksUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-400/80 hover:text-blue-300 transition-colors truncate"
                >
                  {jwksUri}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Footer: verified indicator + download */}
        <div className="border-t border-border bg-white/[0.02] p-2 px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-semibold">
              Cryptographically Verified
            </span>
          </div>

          {/* Download VC artifact */}
          <button
            type="button"
            onClick={handleDownload}
            className="text-[10px] text-muted-foreground/70 hover:text-foreground/80 transition-colors flex items-center gap-1 border border-border/50 rounded px-2 py-1"
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
