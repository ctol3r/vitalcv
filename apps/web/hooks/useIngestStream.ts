'use client';

/**
 * useIngestStream.ts — Progressive passport hydration via SSE
 *
 * Usage:
 *   const { state, startIngest } = useIngestStream()
 *
 *   startIngest('1234567890')
 *   // state.phase progresses: idle → starting → nppes → sanctions → enrollment → done
 *   // state.identity/standing/readiness update incrementally as events arrive
 *
 * Phases:
 *   idle       — no run started
 *   starting   — POST /api/ingest/:npi fired, waiting for runId
 *   nppes      — resolving identity from NPPES
 *   sanctions  — checking OIG/LEIE
 *   enrollment — checking PECOS enrollment
 *   done       — pipeline complete, full passport available
 *   error      — something failed
 *
 * The consumer renders whatever is available and shows spinners for pending fields.
 */

import { useState, useCallback, useRef } from 'react';

// ── Event types (mirror backend shape) ────────────────────────────────────────

type IngestEventType = 'source_start' | 'source_complete' | 'claim_update' | 'done' | 'error';
type IngestSource    = 'nppes' | 'oig' | 'pecos' | 'entity';

interface IngestEvent {
  type:      IngestEventType;
  source?:   IngestSource;
  timestamp: string;
  payload:   Record<string, unknown>;
}

// ── Stream state ───────────────────────────────────────────────────────────────

export type StreamPhase = 'idle' | 'starting' | 'nppes' | 'sanctions' | 'enrollment' | 'done' | 'error';

export interface StreamIdentity {
  entityId?:    string;
  displayName?: string;
  specialty?:   string;
  entityType?:  string;
  npiType?:     string;
}

export interface StreamStanding {
  exclusionChecked: boolean;
  exclusionClear?:  boolean;
  exclusionStatus?: string;
  enrollmentChecked: boolean;
  enrollmentStatus?: string;
}

export interface StreamReadiness {
  score?: number;
  level?: string;
  claimCount?: number;
}

export interface SourceStatus {
  nppes:  'pending' | 'checking' | 'done' | 'error';
  oig:    'pending' | 'checking' | 'done' | 'error';
  pecos:  'pending' | 'checking' | 'done' | 'error';
}

export interface IngestStreamState {
  phase:      StreamPhase;
  runId?:     string;
  npi?:       string;
  identity:   StreamIdentity;
  standing:   StreamStanding;
  readiness:  StreamReadiness;
  sources:    SourceStatus;
  events:     IngestEvent[];
  error?:     string;
  startedAt?: string;
  completedAt?: string;
}

const INITIAL_STATE: IngestStreamState = {
  phase:    'idle',
  identity:  {},
  standing:  { exclusionChecked: false, enrollmentChecked: false },
  readiness: {},
  sources:   { nppes: 'pending', oig: 'pending', pecos: 'pending' },
  events:    [],
};

// ── Event reducer ──────────────────────────────────────────────────────────────

function applyEvent(prev: IngestStreamState, event: IngestEvent): IngestStreamState {
  const events = [...prev.events, event];

  switch (event.type) {

    case 'source_start': {
      const src = event.source;
      if (src === 'nppes') {
        return { ...prev, events, phase: 'nppes', sources: { ...prev.sources, nppes: 'checking' } };
      }
      if (src === 'oig') {
        return { ...prev, events, phase: 'sanctions', sources: { ...prev.sources, oig: 'checking' } };
      }
      if (src === 'pecos') {
        return { ...prev, events, sources: { ...prev.sources, pecos: 'checking' } };
      }
      return { ...prev, events };
    }

    case 'source_complete': {
      const p = event.payload;
      if (event.source === 'nppes') {
        return {
          ...prev, events,
          sources: { ...prev.sources, nppes: 'done' },
          identity: {
            entityId:    p.entityId    as string,
            displayName: p.displayName as string,
            specialty:   p.specialty   as string | undefined,
            entityType:  p.entityType  as string | undefined,
            npiType:     p.npiType     as string | undefined,
          },
        };
      }
      if (event.source === 'oig') {
        return {
          ...prev, events,
          phase: 'enrollment',
          sources: { ...prev.sources, oig: 'done' },
          standing: {
            ...prev.standing,
            exclusionChecked: true,
            exclusionClear:   p.exclusionClear  as boolean | undefined,
            exclusionStatus:  p.exclusionStatus as string | undefined,
          },
        };
      }
      if (event.source === 'pecos') {
        return {
          ...prev, events,
          sources: { ...prev.sources, pecos: 'done' },
          standing: {
            ...prev.standing,
            enrollmentChecked: true,
            enrollmentStatus:  p.enrollmentStatus as string | undefined,
          },
        };
      }
      return { ...prev, events };
    }

    case 'claim_update': {
      const p = event.payload;
      return {
        ...prev, events,
        readiness: {
          score:      p.readinessScore as number | undefined,
          level:      p.readinessLevel as string | undefined,
          claimCount: p.claimCount     as number | undefined,
        },
      };
    }

    case 'done': {
      return {
        ...prev, events,
        phase:       'done',
        completedAt: event.timestamp,
      };
    }

    case 'error': {
      return {
        ...prev, events,
        phase: 'error',
        error: event.payload.message as string,
      };
    }

    default:
      return { ...prev, events };
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useIngestStream() {
  const [state, setState] = useState<IngestStreamState>(INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);

  const startIngest = useCallback(async (npi: string) => {
    // Close any existing stream
    esRef.current?.close();
    esRef.current = null;

    setState({ ...INITIAL_STATE, phase: 'starting', npi, startedAt: new Date().toISOString() });

    try {
      // 1. Start ingest run
      const res     = await fetch(`/api/ingest/${npi}`, { method: 'POST' });
      const { runId } = await res.json() as { runId: string };

      setState(prev => ({ ...prev, runId }));

      // 2. Open SSE stream (via Next.js streaming proxy)
      const es = new EventSource(`/api/ingest/stream/${runId}`);
      esRef.current = es;

      es.onmessage = (e: MessageEvent<string>) => {
        try {
          const event = JSON.parse(e.data) as IngestEvent;
          setState(prev => applyEvent(prev, event));
          if (event.type === 'done' || event.type === 'error') {
            es.close();
            esRef.current = null;
          }
        } catch { /* malformed event — ignore */ }
      };

      es.onerror = () => {
        setState(prev => ({
          ...prev,
          phase: prev.phase === 'done' ? 'done' : 'error',
          error: prev.phase === 'done' ? undefined : 'Stream disconnected.',
        }));
        es.close();
        esRef.current = null;
      };

    } catch (err) {
      setState(prev => ({
        ...prev,
        phase: 'error',
        error: err instanceof Error ? err.message : 'Failed to start ingest.',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return { state, startIngest, reset };
}
