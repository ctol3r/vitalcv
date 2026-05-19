import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Hard interruption · revoked credential.
 *
 * Source: Trust State Transitions.html · StatusList2021. A revoked
 * credential renders a red lineage break; this is a hard interruption,
 * never a soft "stale" state. Verifiers must not honor.
 */
export interface RevocationStateBannerProps {
  /** StatusList2021 index for this credential. */
  statusListIndex: number;
  /** ISO 8601 timestamp the issuer set the revocation bit. */
  revokedAtIso: string;
  /** Optional reason rendered as institutional sub-copy. */
  reason?: string;
  className?: string;
}

export function RevocationStateBanner({
  statusListIndex,
  revokedAtIso,
  reason,
  className,
}: RevocationStateBannerProps) {
  return (
    <section
      role="alert"
      data-slot="revocation-banner"
      className={cn(
        'rounded-2xl border-2 border-rose-900 bg-rose-950 p-4 text-sm text-rose-50',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wider text-rose-200">
        <span>StatusList2021 · bit 1</span>
        <span>idx {statusListIndex}</span>
      </header>
      <h3 className="mt-2 text-base font-semibold">Credential revoked</h3>
      <p className="mt-1 text-sm">
        The issuer has revoked this credential. Verifiers must not honor it.
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-rose-200">
            Revoked at
          </dt>
          <dd>{revokedAtIso}</dd>
        </div>
        {reason ? (
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-rose-200">
              Reason
            </dt>
            <dd className="break-words">{reason}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
