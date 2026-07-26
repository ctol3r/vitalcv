'use client';

/**
 * A single pane: title bar with an accessible close, and the entity body. The
 * pane body self-loads from the entity id — the pane itself holds no data, so
 * it stays a thin, reusable frame around whatever surface the registry names.
 */

import { useEffect, useRef } from 'react';

import type { PaneInstance } from '@/lib/page-stack/types';

import styles from './PageStack.module.css';

interface PaneProps {
  readonly pane: PaneInstance;
  readonly total: number;
  readonly focused: boolean;
  readonly onClose: (index: number) => void;
}

export function Pane({ pane, total, focused, onClose }: PaneProps) {
  const { descriptor, id, index } = pane;
  const Body = descriptor.Component;
  const ref = useRef<HTMLElement>(null);

  // When this becomes the focused (rightmost) pane, bring it into view and move
  // focus to it, so keyboard users land on the pane that just opened.
  useEffect(() => {
    if (focused && ref.current) {
      // scrollIntoView is absent in some environments (jsdom, older engines) —
      // guard it so a pane never crashes on open.
      ref.current.scrollIntoView?.({ inline: 'end', block: 'nearest' });
      ref.current.focus({ preventScroll: true });
    }
  }, [focused]);

  return (
    <section
      ref={ref}
      className={`mz-card ${styles.pane} ${focused ? '' : styles.paneCompact}`}
      tabIndex={-1}
      aria-label={`${descriptor.fallbackLabel} details, pane ${index + 1} of ${total}`}
      data-pane-index={index}
      data-pane-focused={focused ? 'true' : 'false'}
      onMouseDown={() => {
        // Clicking an earlier pane brings it forward — scroll it into view.
        // This is a view affordance only; it never truncates the stack.
        if (!focused) ref.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
      }}
      onKeyDown={(event) => {
        // Escape closes the newest pane only.
        if (event.key === 'Escape' && index === total - 1) {
          event.stopPropagation();
          onClose(index);
        }
      }}
    >
      <header className={styles.titleBar}>
        <span className={styles.title}>{descriptor.fallbackLabel}</span>
        <button
          type="button"
          className={`mz-interactive ${styles.closeButton}`}
          aria-label={`Close ${descriptor.fallbackLabel} pane`}
          onClick={() => onClose(index)}
        >
          ×
        </button>
      </header>
      <div className={styles.paneBody}>
        <Body id={id} />
      </div>
    </section>
  );
}
