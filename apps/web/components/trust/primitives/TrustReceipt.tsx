import * as React from 'react';
import { cn } from '@/lib/utils';
import { LineageHeader, type LineageHeaderProps } from './LineageHeader';

/**
 * Signed receipt · evidentiary register.
 *
 * Source: Institutional Receipt.html. A verifier trusts the receipt
 * before reading the explanation. The artifact reads as a controlled
 * document — visible permanence, no marketing flourish. The dark
 * register is reserved for the cryptographic plane.
 */
export interface TrustReceiptProps {
  receiptId: string;
  /** Issuer DID (e.g. "did:web:vitalcv.health"). */
  issuerDid: string;
  /** Signing algorithm label (e.g. "Ed25519 · EdDSA"). */
  algorithm: string;
  /** Key id summary (e.g. "kid 6f0e 1d22"). */
  keyId: string;
  /** BLAKE3-256 head (e.g. "7a2c b8d3 9d11 3e4a"). */
  receiptHash: string;
  /** "0 = active" | "1 = revoked" — verbatim from StatusList2021. */
  statusBit: '0 = active' | '1 = revoked';
  /** Six-cell lineage header (composed via `composeLineage`). */
  lineage: LineageHeaderProps['slots'];
  /** Attested-claim paragraph rendered verbatim. */
  attestedClaim: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function TrustReceipt({
  receiptId,
  issuerDid,
  algorithm,
  keyId,
  receiptHash,
  statusBit,
  lineage,
  attestedClaim,
  children,
  className,
}: TrustReceiptProps) {
  const revoked = statusBit === '1 = revoked';
  return (
    <article
      data-slot="trust-receipt"
      data-revoked={revoked ? 'true' : undefined}
      className={cn(
        'rounded-2xl border border-slate-950 bg-slate-950 text-slate-100',
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-800 px-5 py-3 font-mono text-xs uppercase tracking-wider text-slate-300">
        <span>Signed receipt · evidentiary artifact</span>
        <span>{receiptId}</span>
      </header>
      <div className="space-y-4 p-5 text-sm">
        <LineageHeader slots={lineage} state="signed" />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Cell label="Issuer · DID" value={issuerDid} />
          <Cell label="Signing key" value={keyId} sub={algorithm} />
          <Cell label="Receipt hash" value={receiptHash} sub="BLAKE3-256 head" />
          <Cell
            label="Status · revocation bit"
            value={statusBit}
            sub="StatusList2021"
            emphasis={revoked ? 'alarm' : 'calm'}
          />
        </dl>
        <section
          data-slot="attested-claim"
          className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-100"
        >
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Attested claim · what the issuer signs
          </div>
          {attestedClaim}
        </section>
        {children}
      </div>
    </article>
  );
}

function Cell({
  label,
  value,
  sub,
  emphasis = 'calm',
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: 'calm' | 'alarm';
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 font-mono text-sm break-words',
          emphasis === 'alarm' ? 'text-amber-200' : 'text-slate-100',
        )}
      >
        {value}
      </dd>
      {sub ? (
        <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>
      ) : null}
    </div>
  );
}
