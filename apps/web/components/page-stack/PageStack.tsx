'use client';

/**
 * PageStack — the horizontal spatial workspace. Renders the panes the URL
 * describes, left→right, the rightmost focused. Opening a linked entity adds a
 * pane; Back/close removes the newest; refresh and a shared URL restore the
 * whole stack, because the stack lives in the URL (see usePaneStack).
 */

import type { ReactNode } from 'react';

import { usePaneStack } from '@/hooks/usePaneStack';
import type { PaneRegistry } from '@/lib/page-stack/types';

import { Pane } from './Pane';
import styles from './PageStack.module.css';

interface PageStackProps {
  /** Rendered as the leftmost, always-present root workspace. */
  readonly root: ReactNode;
  /** Injectable for tests; defaults to the real registry. */
  readonly registry?: PaneRegistry;
}

export function PageStack({ root, registry }: PageStackProps) {
  const { stack, popPane, popTo } = usePaneStack(registry);

  // Closing pane N restores the stack to just before N opened: remove N and
  // everything to its right. The newest pane is a plain pop.
  const closeAt = (index: number) => (index === stack.panes.length - 1 ? popPane() : popTo(index - 1));

  return (
    <div className={styles.stack} role="group" aria-label="Spatial page stack" data-pane-count={stack.panes.length}>
      <section className={`mz-card ${styles.pane}`} aria-label="Workspace" data-pane-root="true">
        <div className={styles.paneBody}>{root}</div>
      </section>

      {stack.panes.map((pane) => (
        <Pane
          key={`${pane.type}:${pane.id}`}
          pane={pane}
          total={stack.panes.length}
          focused={pane.index === stack.focusIndex}
          onClose={closeAt}
        />
      ))}
    </div>
  );
}
