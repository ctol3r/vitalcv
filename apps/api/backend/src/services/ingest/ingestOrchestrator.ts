/**
 * ingestOrchestrator.ts — Real-time ingest with event emission
 *
 * Wraps `ingestClinicianIdentity` and emits structured SSE events at each
 * pipeline stage so the frontend can progressively hydrate the Passport.
 *
 * Event types:
 *   source_start    — a source fetch has begun
 *   source_complete — a source fetch resolved (with entityId/credentialIds)
 *   claim_update    — new claims derived and stored
 *   done            — pipeline complete; final entityId ready
 *   error           — pipeline error; message included
 *
 * Run lifecycle:
 *   POST /api/ingest/:npi → runId (stored in runStore)
 *   GET  /api/ingest/:runId/stream → SSE (attaches to that run's emitter)
 *   Run completes → emitter emits 'done' → SSE connection closed
 *
 * The in-memory run store expires entries after 5 minutes.
 */

import EventEmitter from 'node:events';
import { randomUUID } from 'node:crypto';
import { ingestClinicianIdentity, getClaimsForNpi } from '../identity/identityIngestionPipeline';
import { resolveEntityFromNpi } from '../entity/entityResolutionService';
import { materializeCredentials } from '../entity/upsertVcvCredential';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IngestEventType =
  | 'source_start'
  | 'source_complete'
  | 'claim_update'
  | 'done'
  | 'error';

export type IngestSource = 'nppes' | 'oig' | 'pecos' | 'entity';

export interface IngestEvent {
  type:       IngestEventType;
  source?:    IngestSource;
  timestamp:  string;
  payload:    Record<string, unknown>;
}

export type RunStatus = 'pending' | 'running' | 'done' | 'error';

export interface IngestRun {
  runId:     string;
  npi:       string;
  status:    RunStatus;
  emitter:   EventEmitter;
  events:    IngestEvent[];  // replay buffer for late-connecting clients
  createdAt: Date;
  entityId?: string;
}

// ── Run store ─────────────────────────────────────────────────────────────────

const runStore = new Map<string, IngestRun>();
const RUN_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, run] of runStore) {
    if (now - run.createdAt.getTime() > RUN_TTL_MS) {
      run.emitter.removeAllListeners();
      runStore.delete(id);
    }
  }
}

// ── Emit helper ───────────────────────────────────────────────────────────────

function emit(run: IngestRun, event: IngestEvent): void {
  run.events.push(event);
  run.emitter.emit('event', event);
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Start a new ingest run for an NPI.
 * Returns the runId immediately; pipeline runs in background.
 */
export function startIngestRun(npi: string): string {
  cleanupExpired();

  const runId   = randomUUID();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  const run: IngestRun = {
    runId,
    npi,
    status:    'pending',
    emitter,
    events:    [],
    createdAt: new Date(),
  };

  runStore.set(runId, run);

  // Fire pipeline asynchronously
  setImmediate(() => void runPipeline(run));

  return runId;
}

/**
 * Get an existing run by ID.
 */
export function getIngestRun(runId: string): IngestRun | undefined {
  return runStore.get(runId);
}

// ── Pipeline runner ────────────────────────────────────────────────────────────

async function runPipeline(run: IngestRun): Promise<void> {
  run.status = 'running';

  try {
    // ── Stage 1: NPPES (entity resolution) ──────────────────────────────────
    emit(run, {
      type: 'source_start', source: 'nppes',
      timestamp: new Date().toISOString(),
      payload: { npi: run.npi },
    });

    const record = await resolveEntityFromNpi(run.npi);
    run.entityId = record.entity.id;

    emit(run, {
      type: 'source_complete', source: 'nppes',
      timestamp: new Date().toISOString(),
      payload: {
        entityId:    record.entity.id,
        displayName: record.entity.displayName,
        entityType:  record.entity.entityType,
        npiType:     record.entity.npiType,
        specialty:   (record.entity.metadata as Record<string, unknown>)?.specialty,
      },
    });

    // ── Stage 2: OIG / PECOS via identity pipeline ───────────────────────────
    emit(run, {
      type: 'source_start', source: 'oig',
      timestamp: new Date().toISOString(),
      payload: { npi: run.npi },
    });

    emit(run, {
      type: 'source_start', source: 'pecos',
      timestamp: new Date().toISOString(),
      payload: { npi: run.npi },
    });

    // Run the full pipeline (NPPES + OIG + PECOS claim derivation)
    const report = await ingestClinicianIdentity(run.npi, ['NPPES_API', 'OIG_LEIE'] as Parameters<typeof ingestClinicianIdentity>[1]);

    // ── Stage 3: claim update ────────────────────────────────────────────────
    const claimCount = report.claims?.length ?? 0;

    emit(run, {
      type: 'source_complete', source: 'oig',
      timestamp: new Date().toISOString(),
      payload: {
        exclusionStatus: report.identitySummary?.exclusionStatus ?? 'UNKNOWN',
        exclusionClear:  report.identitySummary?.exclusionClear  ?? false,
      },
    });

    emit(run, {
      type: 'source_complete', source: 'pecos',
      timestamp: new Date().toISOString(),
      payload: {
        enrollmentStatus: report.identitySummary?.medicareEnrollmentStatus ?? 'UNKNOWN',
      },
    });

    // ── Stage 3: materialize claims → VcvCredential rows ────────────────────
    let materializedCount = 0;
    if (run.entityId) {
      try {
        const allClaims = await getClaimsForNpi(run.npi);
        const materialized = await materializeCredentials(allClaims, run.entityId);
        materializedCount = materialized.created + materialized.updated;

        emit(run, {
          type: 'claim_update',
          timestamp: new Date().toISOString(),
          payload: {
            claimCount:     allClaims.length,
            materialized:   materializedCount,
            readinessScore: report.identitySummary?.readinessScore,
            readinessLevel: report.identitySummary?.readinessLevel,
          },
        });
      } catch (err) {
        log('warn', 'credential_materialization_failed', {
          runId: run.runId, npi: run.npi, error: String(err),
        });
      }
    } else if (claimCount > 0) {
      emit(run, {
        type: 'claim_update',
        timestamp: new Date().toISOString(),
        payload: {
          claimCount,
          readinessScore: report.identitySummary?.readinessScore,
          readinessLevel: report.identitySummary?.readinessLevel,
        },
      });
    }

    // ── Done ─────────────────────────────────────────────────────────────────
    run.status = 'done';
    emit(run, {
      type: 'done',
      timestamp: new Date().toISOString(),
      payload: {
        entityId:           run.entityId,
        npi:                run.npi,
        claimsStored:       claimCount,
        credentialRows:     materializedCount,
        deltaEvents:        report.deltaEvents?.length ?? 0,
      },
    });

    log('info', 'ingest_run_done', { runId: run.runId, npi: run.npi, entityId: run.entityId });

  } catch (err) {
    run.status = 'error';
    const message = err instanceof Error ? err.message : String(err);
    emit(run, {
      type: 'error',
      timestamp: new Date().toISOString(),
      payload: { message },
    });
    log('error', 'ingest_run_error', { runId: run.runId, npi: run.npi, error: message });
  }
}
