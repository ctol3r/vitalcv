import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';
import { buildPassport } from '../entity/passportService';
import { resolveEntityFromNpi } from '../entity/entityResolutionService';
import { ingestClinicianIdentity, type IngestionResult } from '../identity/identityIngestionPipeline';
import { extractPracticeStates } from '../identity/phase3Sources';
import { loadClaimRecordsForNpi } from '../identity/identityStore';
import { resolvePhysicianLicensureLaunchLane } from '../identity/physicianLicensureLaunchLane';
import { fetchNursysClaim } from '../identity/nursysClaimMapper';
import { env } from '../../config/env';
import { upsertVcvCredential } from '../entity/upsertVcvCredential';
import type { PersistedIngestRun, IngestSourceId } from './contracts';
import {
  appendIngestEvent,
  completeIngestRun,
  createIngestRun,
  findOpenIngestRunByNpi,
  getIngestRun as loadIngestRun,
  getIngestSourceRunSummary,
  startIngestRun as markIngestRunStarted,
  updateIngestRun,
  updateIngestSourceRun,
} from './ingestEventStore';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deriveRunId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

async function persistRunIdOnSourceRun(
  sourceRunId: string | null | undefined,
  npi: string,
  startedAt: Date,
): Promise<void> {
  if (!sourceRunId || !UUID_RE.test(sourceRunId)) return;
  const runId = deriveRunId(`${npi}:${startedAt.toISOString()}`);

  // Chain linker: find the most recent prior run for the same NPI + source
  // to establish replay continuity: new_run.priorRunId = latest_prior.runId
  let priorRunId: string | null = null;
  try {
    const priorRun = await prisma.sourceRun.findFirst({
      where: {
        subjectNpi: npi,
        id: { not: sourceRunId },
        runId: { not: null },
      },
      orderBy: { startedAt: 'desc' },
      select: { runId: true },
    });
    priorRunId = priorRun?.runId ?? null;
  } catch {
    // Non-fatal — chain link is supplemental
  }

  try {
    await prisma.sourceRun.update({
      where: { id: sourceRunId },
      data: { runId, priorRunId },
    });
  } catch {
    // Non-fatal — runId is supplemental for replay persistence
  }
}

function mapPipelineSourceId(source: string): IngestSourceId | null {
  if (source === 'NPPES_API') return 'nppes';
  if (source === 'OIG_LEIE') return 'oig';
  if (source === 'PECOS_PUBLIC') return 'pecos';
  if (source === 'NURSYS' || source === 'NURSYS_ENOTIFY') return 'nursys';
  if (source === 'FSMB') return 'fsmb';
  return null;
}

function dedupeKey(
  type: string,
  sourceId?: string,
  suffix?: string,
): string {
  return [type, sourceId ?? 'run', suffix ?? 'default'].join(':');
}

function readJsonString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const candidate = record[key];
  if (typeof candidate !== 'string') {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function reviewRequiredCount(claimIds: readonly string[] | undefined): Promise<number> {
  if (!claimIds || claimIds.length === 0) {
    return 0;
  }

  return prisma.claimRecord.count({
    where: {
      claimId: {
        in: [...claimIds],
      },
      reviewRequired: true,
    },
  });
}

async function credentialDomains(credentialIds: readonly string[] | undefined): Promise<string[]> {
  if (!credentialIds || credentialIds.length === 0) {
    return [];
  }

  const rows = await prisma.vcvCredential.findMany({
    where: {
      id: {
        in: [...credentialIds],
      },
    },
    select: {
      domain: true,
    },
  });

  return Array.from(new Set(rows.map((row) => row.domain))).sort((left, right) => left.localeCompare(right));
}

async function emitSourceStart(runId: string, sourceId: IngestSourceId): Promise<void> {
  await updateIngestSourceRun(runId, sourceId, {
    status: 'RUNNING',
    startedAt: new Date(),
  });
  await appendIngestEvent({
    runId,
    type: 'source_start',
    sourceId,
    dedupeKey: dedupeKey('source_start', sourceId),
    payload: {
      sourceId,
      startedAt: new Date().toISOString(),
    },
  });
}

async function finalizeSourceResult(
  runId: string,
  sourceId: IngestSourceId,
  result: IngestionResult | null,
  extras?: Record<string, unknown>,
): Promise<void> {
  const credentialIds = result?.credentialIds ?? [];
  const claimIds = result?.claimIds ?? [];
  const status = result?.status === 'FAILED' ? 'ERROR' : 'DONE';

  await updateIngestSourceRun(runId, sourceId, {
    status,
    sourceRunId: result?.sourceRunId ?? null,
    artifactId: result?.artifactId ?? null,
    claimCount: result?.claimsEmitted ?? 0,
    credentialCount: credentialIds.length,
    errorCode: result?.status === 'FAILED' ? 'SOURCE_FAILED' : null,
    lastError: result?.error ?? null,
    completedAt: new Date(),
  });

  await appendIngestEvent({
    runId,
    type: 'source_complete',
    sourceId,
    dedupeKey: dedupeKey(
      'source_complete',
      sourceId,
      `${result?.sourceRunId ?? 'none'}:${result?.artifactId ?? 'none'}:${result?.status ?? 'missing'}`,
    ),
    payload: {
      sourceId,
      status: result?.status ?? 'FAILED',
      sourceRunId: result?.sourceRunId ?? null,
      artifactId: result?.artifactId ?? null,
      claimCount: result?.claimsEmitted ?? 0,
      credentialIds,
      ...extras,
    },
  });

  if ((claimIds.length > 0) || (credentialIds.length > 0)) {
    await appendIngestEvent({
      runId,
      type: 'claim_update',
      sourceId,
      dedupeKey: dedupeKey(
        'claim_update',
        sourceId,
        `${claimIds.length}:${credentialIds.length}:${result?.artifactId ?? 'none'}`,
      ),
      payload: {
        sourceId,
        claimCount: result?.claimsEmitted ?? 0,
        credentialIds,
        reviewRequiredCount: await reviewRequiredCount(claimIds),
        domains: await credentialDomains(credentialIds),
      },
    });
  }
}

async function runPipeline(runId: string, npi: string): Promise<void> {
  const pipelineStartedAt = new Date();
  await markIngestRunStarted(runId);

  try {
    await emitSourceStart(runId, 'nppes');

    const entityRecord = await resolveEntityFromNpi(npi);
    await updateIngestRun(runId, {
      entityId: entityRecord.entity.id,
    });

    await emitSourceStart(runId, 'oig');
    await emitSourceStart(runId, 'pecos');

    const report = await ingestClinicianIdentity(npi, ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC']);
    const resultBySource = new Map<IngestSourceId, IngestionResult>();
    for (const result of report.results) {
      const sourceId = mapPipelineSourceId(result.source);
      if (sourceId) {
        resultBySource.set(sourceId, result);
      }
    }

    const metadata = (entityRecord.entity.metadata as Record<string, unknown>) ?? {};

    await finalizeSourceResult(runId, 'nppes', resultBySource.get('nppes') ?? null, {
      resultStatus: resultBySource.get('nppes')?.status ?? 'FAILED',
      entityId: entityRecord.entity.id,
      displayName: entityRecord.entity.displayName,
      entityType: entityRecord.entity.entityType,
      npiType: entityRecord.entity.npiType,
      identityStatus: readJsonString(entityRecord.entity.metadata, 'status'),
      credentials: readJsonString(metadata, 'credentials'),
      specialty: readJsonString(metadata, 'specialty'),
      enumerationDate: readJsonString(metadata, 'enumerationDate'),
      lastUpdated: readJsonString(metadata, 'lastUpdated'),
      address: metadata.address,
      taxonomies: metadata.taxonomies,
    });
    await finalizeSourceResult(runId, 'oig', resultBySource.get('oig') ?? null);
    await finalizeSourceResult(runId, 'pecos', resultBySource.get('pecos') ?? null);

    // ── Authority stage: Nursys (nurse licensure) ────────────────────────────
    if (env().REAL_NURSYS_ENABLED) {
      await emitSourceStart(runId, 'nursys');
      try {
        const nursysClaim = await fetchNursysClaim(npi, new Date().toISOString());
        const nursysCredIds: string[] = [];
        if (nursysClaim) {
          const cred = await upsertVcvCredential(nursysClaim, entityRecord.entity.id);
          if (cred) nursysCredIds.push(cred.credentialId);
        }
        await finalizeSourceResult(runId, 'nursys', {
          npi,
          source: 'NURSYS',
          status:        nursysClaim ? 'SUCCESS' : 'SKIPPED',
          claimsEmitted: nursysClaim ? 1 : 0,
          credentialIds: nursysCredIds,
          claimIds:      nursysClaim ? [nursysClaim.claimId] : [],
          artifactId:    nursysClaim?.artifactId ?? null,
          sourceRunId:   `nursys-${npi}`,
          deltaEvents:   [],
          latencyMs:     0,
        });
      } catch (err) {
        log('warn', 'nursys_stage_failed', { npi, error: String(err) });
        await finalizeSourceResult(runId, 'nursys', {
          npi,
          source:        'NURSYS',
          status:        'FAILED',
          claimsEmitted: 0,
          credentialIds: [],
          claimIds:      [],
          artifactId:    null,
          sourceRunId:   undefined,
          deltaEvents:   [],
          latencyMs:     0,
          error:         String(err),
        });
      }
    }

    // ── Physician licensure launch lane: CA only, explicit fallback/manual ───
    await emitSourceStart(runId, 'fsmb');
    try {
      const existingClaims = await loadClaimRecordsForNpi(npi);
      const practiceStates = extractPracticeStates(existingClaims);
      const licensureResult = await resolvePhysicianLicensureLaunchLane({
        npi,
        observedAt: new Date().toISOString(),
        candidateStates: practiceStates,
      });
      const credentialIds: string[] = [];
      for (const claim of licensureResult.claims) {
        const cred = await upsertVcvCredential(claim, entityRecord.entity.id);
        if (cred) credentialIds.push(cred.credentialId);
      }

      await finalizeSourceResult(
        runId,
        'fsmb',
        {
          npi,
          source:
            licensureResult.route === 'fsmb'
              ? 'FSMB'
              : 'STATE_BOARD',
          status: licensureResult.claims.length > 0 ? 'SUCCESS' : 'SKIPPED',
          claimsEmitted: licensureResult.claims.length,
          credentialIds,
          claimIds: licensureResult.claims.map((claim) => claim.claimId),
          artifactId: licensureResult.claims[0]?.artifactId ?? null,
          sourceRunId: `physician-licensure-${npi}`,
          deltaEvents: [],
          latencyMs: 0,
          error:
            licensureResult.route === 'manual'
              ? 'CA physician licensure lane requires source access'
              : licensureResult.route === 'unsupported'
                ? 'Requested state is outside the CA physician licensure launch lane'
                : undefined,
        },
        {
          route: licensureResult.route,
          launchState: licensureResult.launchState,
          candidateStates: practiceStates,
        },
      );
    } catch (err) {
      log('warn', 'physician_licensure_launch_lane_failed', { npi, error: String(err) });
      await finalizeSourceResult(runId, 'fsmb', {
        npi,
        source: 'STATE_BOARD',
        status: 'FAILED',
        claimsEmitted: 0,
        credentialIds: [],
        claimIds: [],
        artifactId: null,
        sourceRunId: undefined,
        deltaEvents: [],
        latencyMs: 0,
        error: String(err),
      });
    }

    const passport = await buildPassport(entityRecord.entity.id);
    if (passport) {
      await appendIngestEvent({
        runId,
        type: 'passport_ready',
        dedupeKey: dedupeKey(
          'passport_ready',
          undefined,
          `${passport.entityId}:${passport.readiness.status}:${passport.authority.credentials.length}`,
        ),
        payload: {
          entityId: passport.entityId,
          displayName: passport.identity.displayName,
          specialty: passport.identity.specialty,
          entityType: passport.identity.entityType,
          identityStatus: passport.identity.status,
          exclusionChecked: passport.standing.exclusionStatus !== 'UNCHECKED',
          exclusionClear: passport.standing.exclusionClear,
          exclusionStatus: passport.standing.exclusionStatus,
          enrollmentChecked: passport.standing.pecosEnrollmentStatus !== 'UNCHECKED',
          enrollmentStatus: passport.standing.pecosEnrollmentStatus,
          readinessStatus: passport.readiness.status,
          readinessScore: passport.readiness.score,
          readinessLevel: passport.readiness.level,
          blockerCount: passport.readiness.blockers.length,
          credentialCount: passport.authority.credentials.length,
          checkedAt: passport.lastCheckedAt,
        },
      });
    }

    const sourceSummary = await getIngestSourceRunSummary(runId);
    const sourcesFailed = sourceSummary.filter((source) => source.status === 'ERROR').length;
    const totalClaims = sourceSummary.reduce((total, source) => total + source.claimCount, 0);
    const totalCredentials = sourceSummary.reduce((total, source) => total + source.credentialCount, 0);

    await completeIngestRun(runId, {
      status: 'DONE',
      entityId: entityRecord.entity.id,
    });
    await appendIngestEvent({
      runId,
      type: 'done',
      dedupeKey: dedupeKey('done', undefined, `${sourcesFailed}:${totalClaims}:${totalCredentials}`),
      payload: {
        status: sourcesFailed > 0 ? 'PARTIAL' : 'SUCCESS',
        entityId: entityRecord.entity.id,
        sourcesCompleted: sourceSummary.filter((source) => source.status === 'DONE').length,
        sourcesFailed,
        claimCount: totalClaims,
        credentialCount: totalCredentials,
        checkedAt: new Date().toISOString(),
      },
    });

    // Persist runId on each SourceRun for replay persistence alpha
    for (const [, result] of resultBySource) {
      await persistRunIdOnSourceRun(result.sourceRunId, npi, pipelineStartedAt);
    }

    log('info', 'ingest_run_done', {
      runId,
      npi,
      entityId: entityRecord.entity.id,
      sourcesFailed,
      totalClaims,
      totalCredentials,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    for (const sourceId of ['nppes', 'oig', 'pecos'] as const) {
      await updateIngestSourceRun(runId, sourceId, {
        status: 'ERROR',
        errorCode: 'INGEST_RUN_FAILED',
        lastError: message,
        completedAt: new Date(),
      }).catch(() => null);
    }

    await completeIngestRun(runId, {
      status: 'ERROR',
      lastError: message,
    }).catch(() => null);
    await appendIngestEvent({
      runId,
      type: 'error',
      dedupeKey: dedupeKey('error', undefined, message),
      payload: {
        code: 'INGEST_RUN_FAILED',
        message,
      },
    }).catch(() => null);

    log('error', 'ingest_run_error', {
      runId,
      npi,
      error: message,
    });
  }
}

export async function startIngestRun(npi: string): Promise<PersistedIngestRun> {
  const existing = await findOpenIngestRunByNpi(npi);
  if (existing) {
    return existing;
  }

  const created = await createIngestRun(npi);

  // AUDIT: NPI_INGESTED is one of the 5 canonical non-repudiation events.
  // Write to Postgres before triggering the pipeline so the ingest is always
  // traceable even if runPipeline fails before writing its own events.
  void prisma.auditEvent.create({
    data: {
      id:          randomUUID(),
      type:        'NPI_INGESTED',
      hash:        sha256ForPayload({ runId: created.id, npi: npi.slice(0, 4) + '······' }),
      referenceId: created.id,
      clinicianId: npi,
      anchored:    false,
      metadata:    { runId: created.id, npiPrefix: npi.slice(0, 4) + '······' },
    },
  }).catch((error: unknown) => {
    log('error', 'audit_npi_ingested_persist_failed', {
      runId: created.id,
      error: error instanceof Error ? error.message : String(error),
      severity: 'CRITICAL',
    });
  });

  setImmediate(() => {
    void runPipeline(created.id, npi);
  });
  return created;
}

export async function getIngestRun(runId: string): Promise<PersistedIngestRun | null> {
  return loadIngestRun(runId);
}
