import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckedAtStamp } from './CheckedAtStamp';

/**
 * IssuerAttribution — canonical signer / DID / receipt-attribution chip.
 *
 * Surfaces the cryptographic identity of who signed a check or receipt.
 * Per the Lane A audit, `signer`, `DID`, and `keyId` live only on the
 * backend (`modules/identity/signer.ts`, `utils/issuerDid.ts`) and never
 * reach the UI; a verifier currently has no way to see which issuer
 * vouched for a given artifact.
 *
 * Continuity vocabulary:
 *   ACTIVE  — issuer endpoint reachable AND signing key is current
 *   STALE   — issuer endpoint reachable but key has been rotated; the
 *             receipt was signed under a prior key (still cryptographically
 *             valid but the signing chain is older)
 *   BROKEN  — issuer endpoint unreachable, or the receipt signature
 *             fails to verify against the current key set
 */
export type IssuerContinuity = 'ACTIVE' | 'STALE' | 'BROKEN';

const CONTINUITY_LABEL: Record<IssuerContinuity, string> = {
  ACTIVE: 'Active',
  STALE:  'Stale key',
  BROKEN: 'Broken chain',
};

const CONTINUITY_CLASSES: Record<IssuerContinuity, string> = {
  ACTIVE: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  STALE:  'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  BROKEN: 'border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300',
};

export interface IssuerAttributionProps {
  /** Decentralized identifier of the issuer (`did:vitalcv:issuer:...`). */
  did?: string | null;
  /** Display name of the signer (e.g. 'VitalCV PSV Issuer'). */
  signer?: string | null;
  /** Key id used to sign the receipt. */
  keyId?: string | null;
  /** Receipt id this attribution backs. */
  receiptId?: string | null;
  /** Issuer continuity state. */
  continuity?: IssuerContinuity;
  /** ISO timestamp of the most recent issuer-endpoint check. */
  lastCheckedAt?: string | null;
  className?: string;
}

export function IssuerAttribution({
  did,
  signer,
  keyId,
  receiptId,
  continuity = 'ACTIVE',
  lastCheckedAt,
  className,
}: IssuerAttributionProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border px-3 py-2',
        CONTINUITY_CLASSES[continuity],
        className,
      )}
      data-issuer-continuity={continuity}
      data-issuer-did={did ?? undefined}
      data-issuer-key-id={keyId ?? undefined}
      role="group"
      aria-label="Issuer attribution"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
        <span className="font-semibold uppercase tracking-wide text-xs">
          {signer ?? 'Unknown signer'}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
          {CONTINUITY_LABEL[continuity]}
        </span>
      </div>
      {did && (
        <div className="flex items-baseline gap-1.5 text-[11px]">
          <span className="font-mono uppercase tracking-wide opacity-70">did</span>
          <span className="font-mono truncate" title={did}>
            {did}
          </span>
        </div>
      )}
      {keyId && (
        <div className="flex items-baseline gap-1.5 text-[11px]">
          <span className="font-mono uppercase tracking-wide opacity-70">key</span>
          <span className="font-mono" title={keyId}>{keyId}</span>
        </div>
      )}
      {receiptId && (
        <div className="flex items-baseline gap-1.5 text-[11px]">
          <span className="font-mono uppercase tracking-wide opacity-70">receipt</span>
          <span className="font-mono" title={receiptId}>{receiptId}</span>
        </div>
      )}
      {lastCheckedAt && (
        <CheckedAtStamp
          checkedAt={lastCheckedAt}
          label="issuer checked"
          format="long"
          className="text-[10px]"
        />
      )}
    </div>
  );
}
