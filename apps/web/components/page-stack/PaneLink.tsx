'use client';

/**
 * PaneLink — an internal entity link that opens its target in a pane.
 *
 * It is a real anchor with a real href, so middle-click / cmd-click / "open in
 * new tab" and no-JS all behave normally (the href points at the same surface
 * with the pane appended). A plain left-click is intercepted and handled as a
 * pane push, which keeps the current context visible instead of navigating away.
 */

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { usePaneStack } from '@/hooks/usePaneStack';
import { formatPaneParams, parsePaneParams } from '@/lib/page-stack/pane-key';
import type { PaneKey } from '@/lib/page-stack/types';

interface PaneLinkProps {
  readonly paneKey: PaneKey;
  readonly children: ReactNode;
  readonly className?: string;
}

export function PaneLink({ paneKey, children, className }: PaneLinkProps) {
  const { pushPane } = usePaneStack();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // A genuine href so the browser's own affordances work. It appends this pane
  // to whatever panes are already in the URL.
  const href = (() => {
    const params = new URLSearchParams(searchParams.toString());
    const existing = parsePaneParams(params.getAll('pane'));
    const alreadyOpen = existing.some((k) => k.type === paneKey.type && k.id === paneKey.id);
    const next = alreadyOpen ? existing : [...existing, paneKey];
    params.delete('pane');
    for (const token of formatPaneParams(next)) params.append('pane', token);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  return (
    <a
      href={href}
      className={className}
      data-pane-link={`${paneKey.type}:${paneKey.id}`}
      onClick={(event) => {
        // Let the browser handle anything that isn't a plain left-click.
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
        pushPane(paneKey);
      }}
    >
      {children}
    </a>
  );
}
