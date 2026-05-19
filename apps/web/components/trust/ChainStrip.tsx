/**
 * VitalCV · Trust Surfaces · ChainStrip v1
 *
 * Renders the chain of receipt nodes oldest → newest in a horizontal
 * strip. Used on /receipt/[id] and /replay. Mono / tabular numerals
 * for every id. Inverted-dark surface inherits from the parent
 * SignaturePanel when nested; on /replay it sits on the light plane
 * (CSS uses the `.t-chain` class only — no global override).
 *
 * The chain is fixture data. The component does not verify lineage,
 * does not call any network, and does not assert continuity.
 */

import * as React from 'react';

import { Mono, cn } from './primitives';
import { truncateId } from '@/lib/trust/format';

export interface ChainStripProps {
  /** Receipt ids oldest first. */
  chain: ReadonlyArray<string>;
  /** Index of the currently-highlighted node (defaults to last). */
  highlightIndex?: number;
  /** Optional caption shown below the strip. */
  caption?: string;
}

export function ChainStrip({
  chain,
  highlightIndex,
  caption,
}: ChainStripProps) {
  const last = chain.length - 1;
  const highlight = highlightIndex ?? last;
  return (
    <section
      className="t-chain"
      data-testid="trust-chain-strip"
      aria-label="Receipt chain (oldest first)"
    >
      <header className="t-chain-head">
        <span className="t-chain-eye mono">chain · oldest → newest</span>
        <span className="t-chain-count mono">{chain.length} nodes</span>
      </header>

      <ol className="t-chain-nodes" role="list">
        {chain.map((id, i) => {
          const isHead = i === highlight;
          return (
            <li
              key={id}
              className={cn('t-chain-node', isHead && 't-chain-node--head')}
              data-testid="trust-chain-node"
              data-index={i}
              data-head={String(isHead)}
            >
              <span className="t-chain-node-idx mono">{i.toString().padStart(2, '0')}</span>
              <span className="t-chain-node-id">
                <Mono>{truncateId(id, 8, 4)}</Mono>
              </span>
              {i < chain.length - 1 && (
                <span className="t-chain-node-arrow" aria-hidden>
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {caption && <p className="t-chain-caption">{caption}</p>}
    </section>
  );
}
