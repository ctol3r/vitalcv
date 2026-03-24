import express from 'express';
import request from 'supertest';

jest.mock('../../services/geospatial/mapAggregationService', () => ({
  getMapInstitutions: jest.fn(),
  getMapClusters: jest.fn(),
  getMapShortages: jest.fn(),
  getMapNetwork: jest.fn(),
}));

import { registerMapRoutes } from '../map';
import {
  getMapClusters,
  getMapInstitutions,
  getMapNetwork,
  getMapShortages,
} from '../../services/geospatial/mapAggregationService';

const getMapInstitutionsMock = getMapInstitutions as jest.MockedFunction<typeof getMapInstitutions>;
const getMapClustersMock = getMapClusters as jest.MockedFunction<typeof getMapClusters>;
const getMapShortagesMock = getMapShortages as jest.MockedFunction<typeof getMapShortages>;
const getMapNetworkMock = getMapNetwork as jest.MockedFunction<typeof getMapNetwork>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerMapRoutes(app);
  return app;
}

describe('map routes', () => {
  beforeEach(() => {
    getMapInstitutionsMock.mockReset();
    getMapClustersMock.mockReset();
    getMapShortagesMock.mockReset();
    getMapNetworkMock.mockReset();
  });

  it('requires bbox and zoom query params', async () => {
    const app = buildApp();
    const response = await request(app).get('/api/map/institutions');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Failed to load map institutions');
    expect(response.body.detail).toMatch(/bbox and zoom are required/i);
  });

  it('rejects oversized viewports', async () => {
    const app = buildApp();
    const response = await request(app)
      .get('/api/map/network')
      .query({
        bbox: '-170,-50,170,50',
        zoom: '3',
      });

    expect(response.status).toBe(400);
    expect(response.body.detail).toMatch(/bbox is too large/i);
  });

  it('returns the institutions geojson envelope', async () => {
    getMapInstitutionsMock.mockResolvedValue({
      schema: 'https://vitalcv.com/map/institutions/v1',
      generatedAt: '2026-03-24T00:00:00.000Z',
      dataVersion: 'geospatial:v1:3',
      viewport: {
        bbox: { minLng: -123, minLat: 37, maxLng: -121, maxLat: 38 },
        zoom: 8,
      },
      stats: {
        returned: 1,
        rawPoints: 1,
        clustered: false,
      },
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          id: 'inst-1',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: {
            institutionId: 'inst-1',
            label: 'General Hospital',
            momentumScore: 82,
            momentumState: 'expanding',
            providerCount: 24,
            researchSignalCount: 6,
            geocodePrecision: 'STREET',
          },
        }],
      },
    });

    const app = buildApp();
    const response = await request(app)
      .get('/api/map/institutions')
      .query({
        bbox: '-123,37,-121,38',
        zoom: '8',
      });

    expect(response.status).toBe(200);
    expect(response.body.schema).toBe('https://vitalcv.com/map/institutions/v1');
    expect(response.body.geojson.features[0].properties.institutionId).toBe('inst-1');
  });

  it('returns shortage polygons in geojson format', async () => {
    getMapShortagesMock.mockResolvedValue({
      schema: 'https://vitalcv.com/map/shortages/v1',
      generatedAt: '2026-03-24T00:00:00.000Z',
      dataVersion: 'geospatial:v1:3',
      viewport: {
        bbox: { minLng: -123, minLat: 37, maxLng: -121, maxLat: 38 },
        zoom: 7,
      },
      stats: {
        returned: 1,
        boundaryType: 'HPSA',
      },
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          id: 'boundary-1',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-122.6, 37.6],
              [-121.8, 37.6],
              [-121.8, 37.9],
              [-122.6, 37.9],
              [-122.6, 37.6],
            ]],
          },
          properties: {
            boundaryId: 'boundary-1',
            boundaryType: 'HPSA',
            specialty: 'cardiology',
            pressureScore: 88,
            pressureState: 'severe',
            hpsaScore: 19,
            verifiedSupplyCount: 12,
            demandSignal: 'HIGH',
            confidence: 0.91,
          },
        }],
      },
    });

    const app = buildApp();
    const response = await request(app)
      .get('/api/map/shortages')
      .query({
        bbox: '-123,37,-121,38',
        zoom: '7',
      });

    expect(response.status).toBe(200);
    expect(response.body.geojson.features[0].geometry.type).toBe('Polygon');
    expect(response.body.geojson.features[0].properties.pressureState).toBe('severe');
  });

  it('returns bundled network edges', async () => {
    getMapNetworkMock.mockResolvedValue({
      schema: 'https://vitalcv.com/map/network/v1',
      generatedAt: '2026-03-24T00:00:00.000Z',
      dataVersion: 'geospatial:v1:4',
      viewport: {
        bbox: { minLng: -123, minLat: 37, maxLng: -121, maxLat: 38 },
        zoom: 6,
      },
      stats: {
        returned: 1,
        rawEdges: 3,
        bundledEdges: 1,
      },
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          id: 'edge-1',
          geometry: {
            type: 'LineString',
            coordinates: [[-122.4, 37.77], [-121.9, 37.33]],
          },
          properties: {
            edgeId: 'edge-1',
            fromInstitutionId: 'inst-1',
            toInstitutionId: 'cluster:77',
            weight: 4.2,
            relationshipCount: 5,
            sourceCount: 2,
            aggregationLevel: 'cluster',
            avgMomentumScore: 71.4,
          },
        }],
      },
    });

    const app = buildApp();
    const response = await request(app)
      .get('/api/map/network')
      .query({
        bbox: '-123,37,-121,38',
        zoom: '6',
      });

    expect(response.status).toBe(200);
    expect(response.body.geojson.features[0].geometry.type).toBe('LineString');
    expect(response.body.geojson.features[0].properties.aggregationLevel).toBe('cluster');
  });
});
