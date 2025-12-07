import cron from 'node-cron';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientImpl } from '@prisma/client';

import { fetchExternalLicenses } from '../services/licenses/api-wrapper';
import { validateGlobalLicenseProvenance } from '../services/licenses/provenance';
import { resolveGlobalLicenseEquivalency } from '../services/licenses/equivalency';
import { generateCrossBorderLicensePdf } from '../services/licenses/pdf';
import {
  anchorGlobalLicenseExpiration,
  anchorGlobalLicenseVerification,
} from '../services/audit/anchor';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';

const prisma: PrismaClient = new PrismaClientImpl();
const log = getServiceLogger('api/workers/global-license-ingest');

const DEFAULT_CRON = process.env.GLOBAL_LICENSE_INGEST_CRON ?? '12 * * * *';
const DEFAULT_BATCH = Number(process.env.GLOBAL_LICENSE_INGEST_BATCH ?? '20');

let cronTask: cron.ScheduledTask | null = null;

export interface GlobalLicenseIngestOptions {
  clinicianIds?: string[];
  limit?: number;
  dryRun?: boolean;
}

export interface GlobalLicenseIngestResult {
  processed: number;
  upserts: number;
  anchored: number;
  clinicianIds: string[];
  generatedAt: string;
}

export function startGlobalLicenseIngestWorker(): cron.ScheduledTask {
  if (cronTask) {
    return cronTask;
  }

  log.info('Starting global license ingest worker', { schedule: DEFAULT_CRON });
  cronTask = cron.schedule(DEFAULT_CRON, async () => {
    try {
      const result = await runGlobalLicenseIngestCycle();
      log.info('Global license ingest cycle completed', result);
    } catch (error) {
      log.error('Global license ingest failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return cronTask;
}

export async function runGlobalLicenseIngestCycle(
  options: GlobalLicenseIngestOptions = {},
): Promise<GlobalLicenseIngestResult> {
  const clinicianIds =
    options.clinicianIds && options.clinicianIds.length > 0
      ? options.clinicianIds
      : await lookupTargetClinicians(options.limit ?? DEFAULT_BATCH);

  let upserts = 0;
  let anchored = 0;

  for (const clinicianId of clinicianIds) {
    try {
      const result = await ingestGlobalLicensesForClinician(clinicianId, {
        dryRun: options.dryRun ?? false,
      });
      upserts += result.upserts;
      anchored += result.anchored;
    } catch (error) {
      log.warn('Skipped clinician during global license ingest', {
        clinicianId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    processed: clinicianIds.length,
    upserts,
    anchored,
    clinicianIds,
    generatedAt: new Date().toISOString(),
  };
}

export async function ingestGlobalLicensesForClinician(
  clinicianId: string,
  options: { dryRun?: boolean } = {},
): Promise<{ clinicianId: string; upserts: number; anchored: number }> {
  if (!clinicianId) {
    throw new Error('clinicianId is required');
  }

  const existing = await prisma.globalLicense.findMany({
    where: { clinicianId },
  });
  const existingMap = new Map(existing.map((record) => [recordKey(record.authority, record.licenseNumber), record]));

  const externalRecords = await fetchExternalLicenses({ clinicianId });
  let upserts = 0;
  let anchored = 0;

  for (const record of externalRecords) {
    const key = recordKey(record.authority, record.licenseNumber);
    const previous = existingMap.get(key);

    try {
      const provenance = validateGlobalLicenseProvenance({
        clinicianId,
        authority: record.authority,
        country: record.country,
        licenseNumber: record.licenseNumber,
        status: record.status,
        payloadHash: record.payloadHash,
        issuedAt: record.issuedAt,
        expiresAt: record.expiresAt,
        lastVerified: record.lastVerified,
        previousHash: previous?.recordHash ?? undefined,
      });
      const equivalency = resolveGlobalLicenseEquivalency({
        country: record.country,
        authority: record.authority,
        status: record.status,
      });
      const pdf = generateCrossBorderLicensePdf({
        clinicianId,
        license: {
          authority: record.authority,
          country: record.country,
          licenseNumber: record.licenseNumber,
          status: record.status,
          issuedAt: record.issuedAt,
          expiresAt: record.expiresAt,
          equivalencyTarget: equivalency.targetCountry,
          equivalencyLevel: equivalency.level,
          provenanceScore: provenance.score,
          boardName: record.board.humanName,
          lastVerified: record.lastVerified,
        },
      });

      if (options.dryRun) {
        log.info('[global-license-ingest] (dry-run) would upsert license', {
          clinicianId,
          authority: record.authority,
          licenseNumber: record.licenseNumber,
        });
        upserts += 1;
        continue;
      }

      const payloadJson = record as unknown as Prisma.JsonObject;
      const metadataJson = record.metadata as Prisma.JsonObject;

      const data = {
        clinicianId,
        country: record.country,
        authority: record.authority,
        licenseNumber: record.licenseNumber,
        status: record.status,
        expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
        lastVerified: new Date(record.lastVerified),
        payloadHash: record.payloadHash,
        recordHash: provenance.recordHash,
        payload: payloadJson,
        metadata: metadataJson,
        provenanceVerdict: provenance.verdict,
        provenanceScore: provenance.score,
        provenanceIssues: provenance.issues as Prisma.JsonValue,
        equivalencyTarget: equivalency.targetCountry,
        equivalencyLevel: equivalency.level,
        equivalencyRationale: equivalency.rationale,
        pdfDigest: pdf.digest,
        pdfDataUri: pdf.dataUri,
        anchoredAt: previous?.anchoredAt ?? null,
        anchorEvent: previous?.anchorEvent ?? null,
        anchorTxHash: previous?.anchorTxHash ?? null,
        anchorNetwork: previous?.anchorNetwork ?? null,
      };

      const upserted = await prisma.globalLicense.upsert({
        where: {
          clinicianId_authority_licenseNumber: {
            clinicianId,
            authority: record.authority,
            licenseNumber: record.licenseNumber,
          },
        },
        create: data,
        update: data,
      });

      existingMap.set(key, upserted);
      upserts += 1;

      const anchor =
        record.status === 'active'
          ? anchorGlobalLicenseVerification({
              clinicianId,
              authority: record.authority,
              country: record.country,
              licenseNumber: record.licenseNumber,
              status: record.status,
              recordHash: provenance.recordHash,
            })
          : record.status === 'expired'
            ? anchorGlobalLicenseExpiration({
                clinicianId,
                authority: record.authority,
                country: record.country,
                licenseNumber: record.licenseNumber,
                expiresAt: record.expiresAt,
                recordHash: provenance.recordHash,
              })
            : null;

      if (anchor) {
        anchored += 1;
        await prisma.globalLicense.update({
          where: { id: upserted.id },
          data: {
            anchorEvent: anchor.type,
            anchorTxHash: anchor.txHash,
            anchorNetwork: anchor.network,
            anchoredAt: anchor.payload.timestamp,
          },
        });
      }
    } catch (error) {
      log.warn('[global-license-ingest] failed to process record', {
        clinicianId,
        authority: record.authority,
        licenseNumber: record.licenseNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { clinicianId, upserts, anchored };
}

async function lookupTargetClinicians(limit: number): Promise<string[]> {
  const fromGlobal = await prisma.globalLicense.findMany({
    select: { clinicianId: true },
    distinct: ['clinicianId'],
    take: limit,
  });
  if (fromGlobal.length >= limit) {
    return fromGlobal.map((record) => record.clinicianId);
  }

  const fromForeign = await prisma.foreignCredential.findMany({
    select: { clinicianId: true },
    distinct: ['clinicianId'],
    take: limit,
  });
  const ids = new Set<string>();
  fromGlobal.forEach((record) => ids.add(record.clinicianId));
  fromForeign.forEach((record) => ids.add(record.clinicianId));

  if (ids.size < limit) {
    const fallbackClinicians = await prisma.clinicianProfile.findMany({
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: limit - ids.size,
    });
    fallbackClinicians.forEach((profile) => ids.add(profile.id));
  }

  return Array.from(ids);
}

function recordKey(authority: string, licenseNumber: string): string {
  return `${authority}:${licenseNumber}`.toUpperCase();
}









