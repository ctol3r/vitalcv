import prisma from '../src/graphql/prisma_client';
import { log } from '../src/obs/logger';
import { runGeocodingBatch, isGeocodingEnabled } from '../src/services/geospatial/geocodingService';
import { runGeospatialMaterializationCycle } from '../src/services/geospatial/geospatialMaterializationService';

function readBooleanEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw == null) {
    return fallback;
  }

  return raw === '1' || raw === 'true';
}

export function isGeospatialPipelineEnabled(): boolean {
  return readBooleanEnv('GEOSPATIAL_PIPELINE_ENABLED', false);
}

export async function runGeospatialPipelineCycle(): Promise<{
  institutionsUpserted: number;
  providerLocationsUpserted: number;
  boundariesUpserted: number;
  boundaryAssignments: number;
  geocodingProcessed: number;
  geocodingResolved: number;
  geocodingFailed: number;
}> {
  const materialization = await runGeospatialMaterializationCycle({
    prismaClient: prisma,
  });

  const geocoding = isGeocodingEnabled()
    ? await runGeocodingBatch({
      prismaClient: prisma,
    })
    : {
      processed: 0,
      geocoded: 0,
      failed: 0,
      dedupedAddresses: 0,
    };

  const result = {
    institutionsUpserted: materialization.institutions.upserted,
    providerLocationsUpserted: materialization.providerLocations.upserted,
    boundariesUpserted: materialization.boundaries.upserted,
    boundaryAssignments: materialization.assignments.assignments,
    geocodingProcessed: geocoding.processed,
    geocodingResolved: geocoding.geocoded,
    geocodingFailed: geocoding.failed,
  };

  log('info', 'geospatial.pipeline_completed', {
    event: 'geospatial_pipeline_completed',
    ...result,
  });

  return result;
}
