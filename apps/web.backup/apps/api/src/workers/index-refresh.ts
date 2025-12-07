import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { reconcileMasterCredentialIndex } from '../services/indexer/reconcile';
import { buildCredentialGraphForClinician } from '../../../../services/graph/credentialGraphBuilder';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('api/workers/index-refresh');

const DEFAULT_CRON = process.env.INDEX_REFRESH_CRON ?? '5 * * * *';
const DEFAULT_BATCH = Number(process.env.INDEX_REFRESH_BATCH ?? '15');

let cronTask: cron.ScheduledTask | null = null;

export interface IndexRefreshOptions {
  clinicianIds?: string[];
  batchSize?: number;
  dryRun?: boolean;
}

export interface IndexRefreshResult {
  processed: number;
  reconciled: number;
  anchoredSnapshots: number;
  anchoredDiffs: number;
  generatedAt: string;
  clinicianIds: string[];
}

export function startIndexRefreshWorker(): cron.ScheduledTask {
  if (cronTask) {
    return cronTask;
  }

  log.info('Starting index refresh worker', { schedule: DEFAULT_CRON });
  cronTask = cron.schedule(DEFAULT_CRON, async () => {
    try {
      const result = await runIndexRefreshSweep();
      log.info('Index refresh completed', result);
    } catch (error) {
      log.error('Index refresh failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return cronTask;
}

export async function runIndexRefreshSweep(
  options: IndexRefreshOptions = {},
): Promise<IndexRefreshResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  const clinicianIds =
    options.clinicianIds ??
    (
      await prisma.clinicianProfile.findMany({
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
        take: batchSize,
      })
    ).map((profile) => profile.id);

  let reconciled = 0;
  let snapshotAnchors = 0;
  let diffAnchors = 0;

  for (const clinicianId of clinicianIds) {
    try {
      if (!options.dryRun) {
        await buildCredentialGraphForClinician({ clinicianId });
        const reconciliation = await reconcileMasterCredentialIndex(clinicianId, { prisma });
        reconciled += 1;
        if (reconciliation.snapshot.anchor) snapshotAnchors += 1;
        if (reconciliation.diff?.anchor) diffAnchors += 1;
      } else {
        log.info('[index-refresh] (dry-run) would refresh index', { clinicianId });
      }
    } catch (error) {
      log.warn('Index refresh skipped clinician', {
        clinicianId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    processed: clinicianIds.length,
    reconciled,
    anchoredSnapshots: snapshotAnchors,
    anchoredDiffs: diffAnchors,
    generatedAt: new Date().toISOString(),
    clinicianIds,
  };
}



