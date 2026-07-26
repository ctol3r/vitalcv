'use client';

/**
 * useEntityPreview — lazy, cancellable entity-preview loader.
 *
 * A preview is fetched only after a deliberate hover/focus intent (the caller
 * gates the delay), never on page load. In-flight requests are aborted when the
 * intent is withdrawn, and results are cached per type:id for the page's life so
 * re-hovering is instant and does not refetch. A 404 (absent/unauthorized) is
 * cached as "no preview" so an unauthorized entity is not repeatedly probed.
 */

import { useCallback, useRef, useState } from 'react';

import type { EntityPreview, PreviewableType } from '@/lib/entity-preview/types';

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; preview: EntityPreview }
  | { status: 'none' }; // resolved, but no preview (absent/unauthorized)

const cache = new Map<string, EntityPreview | null>();

export function useEntityPreview(type: PreviewableType, id: string) {
  const key = `${type}:${id}`;
  const [state, setState] = useState<PreviewState>(() => {
    if (cache.has(key)) {
      const cached = cache.get(key)!;
      return cached ? { status: 'ready', preview: cached } : { status: 'none' };
    }
    return { status: 'idle' };
  });
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    if (cache.has(key)) {
      const cached = cache.get(key)!;
      setState(cached ? { status: 'ready', preview: cached } : { status: 'none' });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/entities/${encodeURIComponent(type)}/${encodeURIComponent(id)}/preview`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (res) => {
        if (res.status === 200) return (await res.json()) as EntityPreview;
        return null;
      })
      .then((preview) => {
        cache.set(key, preview);
        setState(preview ? { status: 'ready', preview } : { status: 'none' });
      })
      .catch((err) => {
        if ((err as { name?: string }).name === 'AbortError') return; // withdrawn intent
        setState({ status: 'none' });
      });
  }, [key, type, id]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => (prev.status === 'loading' ? { status: 'idle' } : prev));
  }, []);

  return { state, load, cancel };
}
