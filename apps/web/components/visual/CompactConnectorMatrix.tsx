import * as React from 'react';

export type CompactConnector = {
  name: string;
  state: 'ok' | 'degraded' | 'unavail' | 'review';
  /** State label (defaults to a human form of the state). */
  stateLabel?: string;
  age?: string;
};

const DEFAULT_LABEL: Record<CompactConnector['state'], string> = {
  ok: 'Responding',
  degraded: 'Degraded',
  unavail: 'Unavailable',
  review: 'Institution-only',
};

/**
 * Compact Connector Matrix grid variant (chat22 fix #12).
 *
 * Used wherever the full table is too dense — most importantly the
 * landing hero's "at-a-glance" reuse. The full table lives on /status.
 */
export function CompactConnectorMatrix({ items }: { items: CompactConnector[] }) {
  return (
    <div className="vs-matrix-compact" role="list" aria-label="Connector status overview">
      {items.map((item) => (
        <div key={item.name} role="listitem">
          <span className="vs-cm-src">{item.name}</span>
          <span className={`vs-cm-state${item.state !== 'ok' ? ` ${item.state}` : ''}`}>
            {item.stateLabel ?? DEFAULT_LABEL[item.state]}
          </span>
          {item.age ? <span className="vs-cm-age">{item.age}</span> : null}
        </div>
      ))}
    </div>
  );
}
