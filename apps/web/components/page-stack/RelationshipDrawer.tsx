'use client';

/**
 * RelationshipDrawer (G4) — the two-directional relationship view for an entity.
 *
 * Tabs: Outgoing (what this connects to) and Backlinks (what connects to this).
 * Each row is the same canonical edge phrased for its direction, the related
 * node's label, and its evidence state — context, not a bare id list. Renders
 * from real projected relationships only; an entity with none shows an honest
 * empty state, never a fabricated connection.
 */

import { useState } from 'react';

import type { RelationshipView } from '@/lib/entity-relationships/project';

import styles from './PageStack.module.css';

interface RelationshipDrawerProps {
  readonly outgoing: readonly RelationshipView[];
  readonly backlinks: readonly RelationshipView[];
  /** Optional loading flag for the async fetch. */
  readonly loading?: boolean;
}

type Tab = 'outgoing' | 'backlinks';

function Row({ rel }: { rel: RelationshipView }) {
  return (
    <li className={styles.relRow} data-rel-direction={rel.direction} data-rel-type={rel.type}>
      <span className={styles.relLabel}>{rel.label}</span>
      <span className={styles.relNode}>{rel.node.label}</span>
      {rel.node.state ? <span className="mz-chip">{rel.node.state}</span> : null}
    </li>
  );
}

export function RelationshipDrawer({ outgoing, backlinks, loading }: RelationshipDrawerProps) {
  const [tab, setTab] = useState<Tab>('outgoing');
  const rows = tab === 'outgoing' ? outgoing : backlinks;

  return (
    <section className={`mz-inset ${styles.relDrawer}`} aria-label="Relationships">
      <div className={styles.relTabs} role="tablist" aria-label="Relationship direction">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'outgoing'}
          className={`mz-interactive ${tab === 'outgoing' ? styles.relTabActive : ''}`}
          onClick={() => setTab('outgoing')}
        >
          Outgoing ({outgoing.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'backlinks'}
          className={`mz-interactive ${tab === 'backlinks' ? styles.relTabActive : ''}`}
          onClick={() => setTab('backlinks')}
        >
          Backlinks ({backlinks.length})
        </button>
      </div>

      {loading ? (
        <p className={styles.relEmpty}>Loading relationships…</p>
      ) : rows.length === 0 ? (
        <p className={styles.relEmpty} data-rel-empty={tab}>
          No {tab === 'outgoing' ? 'outgoing links' : 'backlinks'} recorded.
        </p>
      ) : (
        <ul className={styles.relList} data-rel-list={tab}>
          {rows.map((rel) => (
            <Row key={rel.id} rel={rel} />
          ))}
        </ul>
      )}
    </section>
  );
}
