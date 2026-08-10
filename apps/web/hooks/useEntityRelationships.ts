'use client';

/**
 * useEntityRelationships — fetch a node's bidirectional relationships on demand.
 *
 * Loaded when the drawer opens, not on page load; cancellable; cached per
 * type:id:focus for the page's life. A 404 (absent/unauthorized/unwired type)
 * is a clean empty result, not an error surface.
 */

import { useCallback, useRef, useState } from 'react';

import type { EntityRelationships } from '@/lib/entity-relationships/project';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: EntityRelationships }
  | { status: 'empty' };

const cache = new Map<string, EntityRelationships | null>();

export function useEntityRelationships(type: string, id: string, focus?: string) {
  const key = `${type}:${id}:${focus ?? ''}`;
  const [state, setState] = useState<State>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    if (cache.has(key)) {
      const cached = cache.get(key)!;
      setState(cached ? { status: 'ready', data: cached } : { status: 'empty' });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    abortRef.current = controller;

    const qs = focus ? `?focus=${encodeURIComponent(focus)}` : '';
    fetch(`/api/entities/${encodeURIComponent(type)}/${encodeURIComponent(id)}/relationships${qs}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (res) => (res.status === 200 ? ((await res.json()) as EntityRelationships) : null))
      .then((data) => {
        const usable = data && (data.outgoing.length > 0 || data.backlinks.length > 0) ? data : null;
        cache.set(key, usable);
        setState(usable ? { status: 'ready', data: usable } : { status: 'empty' });
      })
      .catch((err) => {
        if ((err as { name?: string }).name === 'AbortError') return;
        setState({ status: 'empty' });
      });
  }, [key, type, id, focus]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { state, load, cancel };
}
