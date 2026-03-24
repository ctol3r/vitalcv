import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runGeocodingBatch } from '../geocodingService';

describe('geocodingService', () => {
  const originalFetch = global.fetch;
  const originalZipSource = process.env.GEOSPATIAL_ZIP_CENTROIDS_PATH;

  afterEach(async () => {
    global.fetch = originalFetch;
    if (originalZipSource === undefined) {
      delete process.env.GEOSPATIAL_ZIP_CENTROIDS_PATH;
    } else {
      process.env.GEOSPATIAL_ZIP_CENTROIDS_PATH = originalZipSource;
    }
  });

  it('falls back to ZIP centroids when Census does not return coordinates', async () => {
    const zipSourcePath = path.join(os.tmpdir(), `vitalcv-zip-centroids-${Date.now()}.json`);
    await fs.writeFile(zipSourcePath, JSON.stringify([
      {
        zip: '94107',
        latitude: 37.7764,
        longitude: -122.395,
        stateCode: 'CA',
      },
    ]), 'utf8');
    process.env.GEOSPATIAL_ZIP_CENTROIDS_PATH = zipSourcePath;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          addressMatches: [],
        },
      }),
    } as Response);

    const institutionUpdate = jest.fn().mockResolvedValue(undefined);
    const prismaClient = {
      institution: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'inst-1',
          addressLine1: '123 Market Street',
          addressLine2: null,
          city: 'San Francisco',
          stateCode: 'CA',
          postalCode: '94107',
          countryCode: 'US',
          geocodeStatus: 'PENDING',
          geocodeAttempts: 0,
          lastGeocodedAt: null,
          latitude: null,
          longitude: null,
        }]),
        update: institutionUpdate,
      },
      providerLocation: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      geographicBoundary: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await runGeocodingBatch({
      prismaClient,
      batchSize: 10,
      concurrency: 1,
    });

    expect(result.processed).toBe(1);
    expect(result.geocoded).toBe(1);
    expect(institutionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        geocodePrecision: 'ZIP_CENTROID',
        geocodeSource: 'ZIP_CENTROID',
      }),
    }));
  });
});
