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
  buildPublicIngestStreamUrl,
  startPublicIngest,
} from '@/lib/api';
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
  IngestStreamState,
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

  const openStream = useCallback((runId: string) => {
    const es = new EventSource(buildPublicIngestStreamUrl(runId));
    esRef.current = es;

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

    es.onmessage = handler;

    es.onerror = () => {
      setState(prev => applyIngestDisconnect(prev));
      es.close();
      esRef.current = null;
    };
  }, []);

  const resumeIngest = useCallback((runId: string, seedState?: IngestStreamState | null) => {
    // Close any existing stream
    esRef.current?.close();
    esRef.current = null;

    if (seedState) {
      setState({
        ...seedState,
        runId,
        disconnected: false,
      });
    }

    openStream(runId);
  }, [openStream]);

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
      const ingestResponse = await startPublicIngest(npi);

      // Detect the backend's degraded-state fallback (HTTP 200 with
      // body.fallback === true). When the readiness pipeline is
      // temporarily unreachable, the /api/ingest/[npi] route returns
      // a structured fallback body rather than 5xx-ing. Surface that
      // as a calm pending-sources state instead of an `error` phase
      // with all sources marked failed — the upstream IS unreachable,
      // but the clinician hasn't done anything wrong, and source
      // checks are queued to retry.
      const body = ingestResponse.body as
        | { fallback?: unknown; message?: unknown }
        | null;
      if (body && body.fallback === true) {
        const calmMessage =
          typeof body.message === 'string' && body.message.length > 0
            ? body.message
            : 'Sources are temporarily unavailable. Try again in a moment.';
        setState(prev => ({
          ...prev,
          phase: 'error',
          sources: {
            nppes: 'pending',
            oig: 'pending',
            pecos: 'pending',
          },
          error: calmMessage,
        }));
        return;
      }

      const runId = parseIngestStartResponse({ ...ingestResponse });

      setState(prev => ({ ...prev, runId }));

      // 2. Open SSE stream (via Next.js streaming proxy)
      openStream(runId);
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
  }, [openStream]);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState(createInitialIngestStreamState());
  }, []);

  return { state, startIngest, resumeIngest, reset };
}
