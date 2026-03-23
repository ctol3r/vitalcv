import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { buildPassport } from '../entity/passportService';
import { resolveEntityFromNpi } from '../entity/entityResolutionService';
import { ingestClinicianIdentity, type IngestionResult } from '../identity/identityIngestionPipeline';
import { fetchFsmbClaims, isFsmbEnabled } from '../identity/fsmbClaimMapper';
import { fetchNursysClaim } from '../identity/nursysClaimMapper';
import { env } from '../../config/env';
import { upsertVcvCredential } from '../entity/upsertVcvCredential';
import { computeClaimId } from '../identity/evidenceModel';
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

    await finalizeSourceResult(runId, 'nppes', resultBySource.get('nppes') ?? null, {
      entityId: entityRecord.entity.id,
      displayName: entityRecord.entity.displayName,
      entityType: entityRecord.entity.entityType,
      npiType: entityRecord.entity.npiType,
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

    // ── Authority stage: FSMB (physician licensure + board certs) ────────────
    if (isFsmbEnabled()) {
      await emitSourceStart(runId, 'fsmb');
      try {
        const fsmbResult = await fetchFsmbClaims(npi, new Date().toISOString());
        const fsmbCredIds: string[] = [];
        for (const claim of fsmbResult.claims) {
          const cred = await upsertVcvCredential(claim, entityRecord.entity.id);
          if (cred) fsmbCredIds.push(cred.credentialId);
        }
        await finalizeSourceResult(runId, 'fsmb', {
          npi,
          source:        'FSMB',
          status:        fsmbResult.sourced ? 'SUCCESS' : 'FAILED',
          claimsEmitted: fsmbResult.claims.length,
          credentialIds: fsmbCredIds,
          claimIds:      fsmbResult.claims.map(c => c.claimId),
          artifactId:    fsmbResult.claims[0]?.artifactId ?? undefined,
          sourceRunId:   `fsmb-${npi}`,
          deltaEvents:   [],
          latencyMs:     0,
          error:         fsmbResult.error,
        });
      } catch (err) {
        log('warn', 'fsmb_stage_failed', { npi, error: String(err) });
        await finalizeSourceResult(runId, 'fsmb', {
          npi,
          source:        'FSMB',
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
          readinessStatus: passport.readiness.status,
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
  setImmediate(() => {
    void runPipeline(created.id, npi);
  });
  return created;
}

export async function getIngestRun(runId: string): Promise<PersistedIngestRun | null> {
  return loadIngestRun(runId);
}
