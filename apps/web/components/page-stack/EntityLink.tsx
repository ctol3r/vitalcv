'use client';

/**
 * EntityLink — the canonical internal entity link (G3).
 *
 * Superset of PaneLink: a real anchor (so cmd/middle-click and no-JS work) whose
 * plain click opens the entity in a pane, PLUS a lazy hover/focus preview and a
 * copy-canonical-link affordance. Preview fetch is delayed ~300ms behind a
 * deliberate hover and cancelled if the pointer leaves first; keyboard focus
 * exposes the same preview so it is not mouse-only.
 */

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useId, useRef, useState, type ReactNode } from 'react';

import { useEntityPreview } from '@/hooks/useEntityPreview';
import { usePaneStack } from '@/hooks/usePaneStack';
import { formatPaneParams, parsePaneParams } from '@/lib/page-stack/pane-key';
import type { PaneKey } from '@/lib/page-stack/types';

import { EntityPreviewCard } from './EntityPreviewCard';
import styles from './PageStack.module.css';

const PREVIEW_DELAY_MS = 300;

interface EntityLinkProps {
  readonly entity: PaneKey;
  readonly children: ReactNode;
  readonly className?: string;
  /** Why this entity is linked here — surfaced to assistive tech. */
  readonly relationship?: string;
}

export function EntityLink({ entity, children, className, relationship }: EntityLinkProps) {
  const { pushPane } = usePaneStack();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, load, cancel } = useEntityPreview(entity.type, entity.id);
  const [open, setOpen] = useState(false);
  const relationshipId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const href = (() => {
    const params = new URLSearchParams(searchParams.toString());
    const existing = parsePaneParams(params.getAll('pane'));
    const alreadyOpen = existing.some((k) => k.type === entity.type && k.id === entity.id);
    const next = alreadyOpen ? existing : [...existing, entity];
    params.delete('pane');
    for (const token of formatPaneParams(next)) params.append('pane', token);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  const beginPreview = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      setOpen(true);
      load();
    }, PREVIEW_DELAY_MS);
  }, [load]);

  const endPreview = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setOpen(false);
    cancel();
  }, [cancel]);

  const showCard = open && (state.status === 'loading' || state.status === 'ready');

  return (
    <span className={styles.entityLinkWrap} onMouseEnter={beginPreview} onMouseLeave={endPreview}>
      <a
        href={href}
        className={className}
        data-entity-link={`${entity.type}:${entity.id}`}
        aria-describedby={relationship ? relationshipId : undefined}
        onFocus={beginPreview}
        onBlur={endPreview}
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }
          event.preventDefault();
          endPreview();
          pushPane(entity);
        }}
      >
        {children}
      </a>
      {relationship ? (
        <span id={relationshipId} className={styles.visuallyHidden}>
          {relationship}
        </span>
      ) : null}
      {showCard ? (
        <span className={styles.entityLinkPreview}>
          <EntityPreviewCard
            status={state.status === 'ready' ? 'ready' : 'loading'}
            preview={state.status === 'ready' ? state.preview : undefined}
          />
        </span>
      ) : null}
    </span>
  );
}
