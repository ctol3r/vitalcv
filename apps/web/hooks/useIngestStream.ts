'use client';

/**
 * useIngestStream.ts — Progressive passport hydration via SSE
 *
 * Usage:
 *   const { state, startIngest } = useIngestStream()
 *
 *   startIngest('1234567890')
 *   // state.phase progresses as sources run
 *   // state.isUsable flips true on passport_ready or done once an anchor exists
 *
 * The consumer renders whatever is available and treats passport_ready as the
 * first usable terminal state.
 */

import { useState, useCallback, useRef } from 'react';
import {
  INGEST_EVENT_TYPES,
  applyIngestDisconnect,
  applyIngestEvent,
  createInitialIngestStreamState,
  hydrateFromHomepagePreview,
  parseIngestEventData,
  parseIngestStartResponse,
  type IngestStreamState,
} from './ingestStreamState';

export { hydrateFromHomepagePreview };

export type {
  IngestEvent,
  IngestEventType,
  SourceStatus,
  StreamIdentity,
  StreamPhase,
  StreamReadiness,
  StreamStanding,
} from './ingestStreamState';



// ── Hook ───────────────────────────────────────────────────────────────────────

export function useIngestStream(initialState?: IngestStreamState | null) {
  const [state, setState] = useState<IngestStreamState>(
    () => initialState ?? createInitialIngestStreamState(),
  );
  const esRef = useRef<EventSource | null>(null);

  const startIngest = useCallback(async (npi: string) => {
    // Close any existing stream
    esRef.current?.close();
    esRef.current = null;

    setState({
      ...createInitialIngestStreamState(),
      phase: 'starting',
      npi,
      startedAt: new Date().toISOString(),
    });

    try {
      // 1. Start ingest run
      const res = await fetch(`/api/ingest/${npi}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      const runId = parseIngestStartResponse({
        ok: res.ok,
        status: res.status,
        body,
      });

      setState(prev => ({ ...prev, runId }));

      // 2. Open SSE stream (via Next.js streaming proxy)
      const es = new EventSource(`/api/ingest/stream/${runId}`);
      esRef.current = es;

      // The backend sends named SSE events (event: source_start, source_complete, etc.)
      // EventSource.onmessage only fires for unnamed events.
      // We must listen for each named event type individually.
      const handler = (e: MessageEvent<string>) => {
        const event = parseIngestEventData(e.data);
        if (!event) {
          return;
        }

        setState(prev => applyIngestEvent(prev, event));
        if (event.type === 'done' || event.type === 'error') {
          es.close();
          esRef.current = null;
        }
      };
      for (const eventType of INGEST_EVENT_TYPES) {
        es.addEventListener(eventType, handler as EventListener);
      }
      // Also listen for unnamed events (fallback)
      es.onmessage = handler;

      es.onerror = () => {
        setState(prev => applyIngestDisconnect(prev));
        es.close();
        esRef.current = null;
      };

    } catch (err) {
      setState(prev => ({
        ...prev,
        phase: 'error',
        sources: {
          nppes: 'error',
          oig: 'error',
          pecos: 'error',
        },
        error: err instanceof Error ? err.message : 'Failed to start ingest.',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState(createInitialIngestStreamState());
  }, []);

  return { state, startIngest, reset };
}
