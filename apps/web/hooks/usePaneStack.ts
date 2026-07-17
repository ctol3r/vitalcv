'use client';

/**
 * usePaneStack — derives the pane stack from the URL and drives it back into the
 * URL. The URL (`?pane=type:id&pane=…`) is the single source of truth; the
 * returned `stack` is derived, never the canonical copy. That is what makes
 * Back/Forward/refresh/share all "just work": every navigation is a URL change.
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { formatPaneParams, paneKeysEqual, parsePaneParams } from '@/lib/page-stack/pane-key';
import { PANE_REGISTRY } from '@/lib/page-stack/registry';
import type { PaneKey, PaneRegistry, PaneStackState } from '@/lib/page-stack/types';

const PANE_PARAM = 'pane';

export interface PaneStackController {
  readonly stack: PaneStackState;
  /** Open a pane to the right of the stack. Adds a history entry (Back closes it). */
  readonly pushPane: (key: PaneKey) => void;
  /** Close the rightmost pane. */
  readonly popPane: () => void;
  /** Close every pane deeper than `index` (keeps 0..index). */
  readonly popTo: (index: number) => void;
  /** Replace the rightmost pane in place — no new history entry. */
  readonly replaceTop: (key: PaneKey) => void;
  readonly isOpen: (key: PaneKey) => boolean;
}

export function usePaneStack(registry: PaneRegistry = PANE_REGISTRY): PaneStackController {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive the resolved stack from the URL. Only tokens whose type is in the
  // registry become panes; the rest are already dropped by parsePaneParams.
  const stack = useMemo<PaneStackState>(() => {
    const keys = parsePaneParams(searchParams.getAll(PANE_PARAM)).filter((key) => registry[key.type]);
    const panes = keys.map((key, index) => ({
      ...key,
      descriptor: registry[key.type],
      index,
    }));
    return { panes, focusIndex: panes.length - 1 };
  }, [searchParams, registry]);

  // Build a URL that keeps every non-pane query param and replaces the pane list.
  const buildHref = useCallback(
    (keys: readonly PaneKey[]): string => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(PANE_PARAM);
      for (const token of formatPaneParams(keys)) params.append(PANE_PARAM, token);
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [searchParams, pathname],
  );

  const currentKeys = useMemo(() => stack.panes.map(({ type, id }) => ({ type, id })), [stack]);

  const pushPane = useCallback(
    (key: PaneKey) => {
      if (!registry[key.type]) return;
      // Opening a pane already in the stack focuses it (truncate to it) rather
      // than stacking a duplicate.
      const existing = currentKeys.findIndex((k) => paneKeysEqual(k, key));
      const next = existing >= 0 ? currentKeys.slice(0, existing + 1) : [...currentKeys, key];
      router.push(buildHref(next), { scroll: false });
    },
    [registry, currentKeys, router, buildHref],
  );

  const popPane = useCallback(() => {
    if (currentKeys.length === 0) return;
    router.push(buildHref(currentKeys.slice(0, -1)), { scroll: false });
  }, [currentKeys, router, buildHref]);

  const popTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= currentKeys.length - 1) return;
      router.push(buildHref(currentKeys.slice(0, index + 1)), { scroll: false });
    },
    [currentKeys, router, buildHref],
  );

  const replaceTop = useCallback(
    (key: PaneKey) => {
      if (!registry[key.type]) return;
      const next = currentKeys.length === 0 ? [key] : [...currentKeys.slice(0, -1), key];
      router.replace(buildHref(next), { scroll: false });
    },
    [registry, currentKeys, router, buildHref],
  );

  const isOpen = useCallback(
    (key: PaneKey) => currentKeys.some((k) => paneKeysEqual(k, key)),
    [currentKeys],
  );

  return { stack, pushPane, popPane, popTo, replaceTop, isOpen };
}
