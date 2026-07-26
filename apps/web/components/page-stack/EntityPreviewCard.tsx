'use client';

/**
 * The hover/focus preview surface. Small, read-only, answers "what is this, why
 * is it linked, what state is it in" before the user commits to opening the
 * pane. It shows a restrained loading state (no flash) and renders nothing when
 * there is no preview — an unauthorized or absent entity simply has no card.
 */

import type { EntityPreview } from '@/lib/entity-preview/types';

import styles from './PageStack.module.css';

interface EntityPreviewCardProps {
  readonly status: 'loading' | 'ready';
  readonly preview?: EntityPreview;
}

export function EntityPreviewCard({ status, preview }: EntityPreviewCardProps) {
  return (
    <div className={`mz-card ${styles.previewCard}`} role="tooltip" data-entity-preview={status}>
      {status === 'loading' || !preview ? (
        <p className={styles.previewLoading}>Loading preview…</p>
      ) : (
        <>
          <p className={styles.previewTitle}>{preview.title}</p>
          {preview.subtitle ? <p className={styles.previewSubtitle}>{preview.subtitle}</p> : null}
          {preview.state ? <span className="mz-chip">{preview.state}</span> : null}
          {preview.fields && preview.fields.length > 0 ? (
            <dl className={styles.previewFields}>
              {preview.fields.map((f) => (
                <div key={f.label} className={styles.previewField}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </>
      )}
    </div>
  );
}
