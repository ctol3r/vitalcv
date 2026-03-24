import { syncProviderBoundaryAssignments } from '../geospatialMaterializationService';

describe('geospatialMaterializationService', () => {
  it('assigns HPSA boundaries by county FIPS before polygon fallback', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const prismaClient = {
      providerLocation: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'location-1',
          countyFips: '06037',
          postalCode: '90001',
          latitude: null,
          longitude: null,
        }]),
      },
      geographicBoundary: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'boundary-1',
          boundaryType: 'HPSA',
          externalId: 'HPSA-1',
          name: 'Los Angeles HPSA',
          stateCode: 'CA',
          countyFips: '06037',
          centroidLat: null,
          centroidLng: null,
          bboxMinLat: null,
          bboxMinLng: null,
          bboxMaxLat: null,
          bboxMaxLng: null,
          geometryGeoJson: {
            type: 'Polygon',
            coordinates: [[
              [-118.7, 33.7],
              [-117.6, 33.7],
              [-117.6, 34.4],
              [-118.7, 34.4],
              [-118.7, 33.7],
            ]],
          },
          metadata: {},
          updatedAt: new Date('2026-03-24T00:00:00.000Z'),
        }]),
      },
      providerBoundaryAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert,
      },
    } as any;

    const result = await syncProviderBoundaryAssignments({
      prismaClient,
      limit: 10,
    });

    expect(result.processed).toBe(1);
    expect(result.assignments).toBe(1);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        assignmentMethod: 'COUNTY_FIPS',
        confidence: 0.95,
      }),
    }));
  });
});
