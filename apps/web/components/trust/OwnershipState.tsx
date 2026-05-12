import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckedAtStamp } from './CheckedAtStamp';

/**
 * OwnershipState — canonical NPI / passport ownership chip.
 *
 * Per the Lane A audit, the `/api/ownership/{claim,me}` endpoints exist
 * on the backend but no UI surface displays ownership state. A hospital
 * verifier cannot currently see whether a clinician has actively claimed
 * the NPI they're being evaluated on — which is exactly the kind of
 * self-attestation signal that distinguishes a real passport from a
 * scraped-data lookup.
 *
 * Ownership state vocabulary:
 *   CLAIMED   — clinician has claimed the NPI and the claim is current
 *   PENDING   — clinician started a claim flow but verification of
 *               ownership is incomplete
 *   UNCLAIMED — no claim has been made on this NPI; rendered passport
 *               is from public-data ingest only
 *   DISPUTED  — multiple parties have asserted ownership; review required
 */
export type OwnershipStateValue = 'CLAIMED' | 'PENDING' | 'UNCLAIMED' | 'DISPUTED';

const STATE_COPY: Record<OwnershipStateValue, { label: string; detail: string }> = {
  CLAIMED:   { label: 'Claimed',   detail: 'Clinician has claimed this NPI.' },
  PENDING:   { label: 'Pending',   detail: 'Claim started; ownership verification incomplete.' },
  UNCLAIMED: { label: 'Unclaimed', detail: 'No clinician has claimed this NPI.' },
  DISPUTED:  { label: 'Disputed',  detail: 'Multiple claims on this NPI; review required.' },
};

const STATE_CLASSES: Record<OwnershipStateValue, string> = {
  CLAIMED:   'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  PENDING:   'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  UNCLAIMED: 'border-dashed border-zinc-400/40 bg-transparent text-zinc-600 dark:text-zinc-400',
  DISPUTED:  'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export interface OwnershipStateProps {
  state: OwnershipStateValue;
  /** Display identifier for the claimant (e.g. 'macie@example.com'). */
  claimant?: string;
  /** ISO timestamp when the claim was made / last updated. */
  claimedAt?: string | null;
  /** Show detail subline (default true). */
  showDetail?: boolean;
  className?: string;
}

export function OwnershipState({
  state,
  claimant,
  claimedAt,
  showDetail = true,
  className,
}: OwnershipStateProps): React.ReactElement {
  const copy = STATE_COPY[state];
  return (
    <div
      className={cn(
        'inline-flex flex-col gap-1 rounded-lg border px-3 py-2',
        STATE_CLASSES[state],
        className,
      )}
      data-ownership-state={state}
      role="status"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
        <span className="font-semibold uppercase tracking-wide text-xs">{copy.label}</span>
        {claimant && (
          <span className="font-mono text-[11px] opacity-90" data-claimant={claimant}>
            {claimant}
          </span>
        )}
      </div>
      {showDetail && (
        <p className="text-[11px] opacity-80 leading-snug">{copy.detail}</p>
      )}
      {claimedAt && (
        <CheckedAtStamp
          checkedAt={claimedAt}
          label="claimed"
          format="long"
          className="text-[10px]"
        />
      )}
    </div>
  );
}
