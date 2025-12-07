/**
 * Coverage Endpoint Tests
 * B128B-PSV-022: /compliance/coverage: %auto-PSV + stale-by-source + SLA badges
 *
 * Acceptance criteria:
 * - Tiles match counts
 * - Stale ages calculated correctly
 * - SLA colors based on thresholds
 * - Per-row evidence ID included
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import coverageRouter from '../coverage';

// Mock PSV registry
vi.mock('../../../../services/psv/registry', () => ({
  getPSVRegistry: () => ({
    getVerificationHistory: vi.fn(() => [
      {
        id: 'ver-1',
        endpointId: 'ep-1',
        verificationType: 'license',
        subjectId: 'provider-1',
        status: 'success',
        timestamp: Date.now() - (20 * 24 * 60 * 60 * 1000), // 20 days ago
        requestPayload: {},
        responsePayload: { verified: true },
        durationMs: 150,
      },
      {
        id: 'ver-2',
        endpointId: 'ep-2',
        verificationType: 'certification',
        subjectId: 'provider-2',
        status: 'success',
        timestamp: Date.now() - (45 * 24 * 60 * 60 * 1000), // 45 days ago
        requestPayload: {},
        responsePayload: { verified: true },
        durationMs: 200,
      },
      {
        id: 'ver-3',
        endpointId: 'ep-3',
        verificationType: 'education',
        subjectId: 'provider-3',
        status: 'success',
        timestamp: Date.now() - (100 * 24 * 60 * 60 * 1000), // 100 days ago (stale)
        requestPayload: {},
        responsePayload: { verified: true },
        durationMs: 180,
      },
      {
        id: 'ver-4',
        endpointId: 'ep-1',
        verificationType: 'license',
        subjectId: 'provider-4',
        status: 'failed',
        timestamp: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days ago
        requestPayload: {},
        responsePayload: null,
        durationMs: 100,
      },
    ]),
    listEndpoints: vi.fn(() => [
      {
        id: 'ep-1',
        name: 'NPPES API',
        endpoint: 'https://npiregistry.cms.hhs.gov/api',
        method: 'GET',
        authType: 'none',
        verificationTypes: ['license'],
        description: 'National Plan and Provider Enumeration System',
        provider: 'nppes',
        active: true,
        lastVerified: Date.now() - (20 * 24 * 60 * 60 * 1000),
        createdAt: Date.now() - (100 * 24 * 60 * 60 * 1000),
        updatedAt: Date.now() - (20 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'ep-2',
        name: 'State Board API',
        endpoint: 'https://stateboard.example.com/api',
        method: 'POST',
        authType: 'api_key',
        verificationTypes: ['certification'],
        description: 'State Medical Board',
        provider: 'state-board',
        active: true,
        lastVerified: Date.now() - (45 * 24 * 60 * 60 * 1000),
        createdAt: Date.now() - (100 * 24 * 60 * 60 * 1000),
        updatedAt: Date.now() - (45 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'ep-3',
        name: 'Education Verification',
        endpoint: 'https://education.example.com/api',
        method: 'GET',
        authType: 'oauth2',
        verificationTypes: ['education'],
        description: 'Education Credential Verification',
        provider: 'education-verify',
        active: true,
        lastVerified: Date.now() - (100 * 24 * 60 * 60 * 1000),
        createdAt: Date.now() - (150 * 24 * 60 * 60 * 1000),
        updatedAt: Date.now() - (100 * 24 * 60 * 60 * 1000),
      },
    ]),
  }),
  getSourceRegistry: vi.fn(() => ({})),
}));

describe('B128B-PSV-022: Coverage Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/compliance/coverage', coverageRouter);
  });

  describe('GET /compliance/coverage', () => {
    it('should return coverage summary with tiles', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('tiles');
      expect(response.body.tiles).toBeInstanceOf(Array);
      expect(response.body.tiles.length).toBeGreaterThan(0);
    });

    it('should calculate auto-PSV percentage correctly', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const { summary } = response.body;
      expect(summary).toHaveProperty('autoPSVPercentage');
      expect(summary).toHaveProperty('totalVerifications');
      expect(summary).toHaveProperty('autoVerifications');

      // 3 successful out of 4 total = 75%
      expect(summary.autoPSVPercentage).toBe(75);
      expect(summary.totalVerifications).toBe(4);
      expect(summary.autoVerifications).toBe(3);
    });

    it('should include SLA distribution', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const { summary } = response.body;
      expect(summary).toHaveProperty('slaDistribution');
      expect(summary.slaDistribution).toHaveProperty('green');
      expect(summary.slaDistribution).toHaveProperty('yellow');
      expect(summary.slaDistribution).toHaveProperty('red');
    });

    it('should include stale distribution', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const { summary } = response.body;
      expect(summary).toHaveProperty('staleDistribution');
      expect(summary.staleDistribution).toHaveProperty('current');
      expect(summary.staleDistribution).toHaveProperty('approaching_stale');
      expect(summary.staleDistribution).toHaveProperty('stale');
    });

    it('should return stale items by source', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      expect(response.body).toHaveProperty('staleBySource');
      expect(response.body.staleBySource).toBeInstanceOf(Array);
    });

    it('should calculate age in days for each source', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const { staleBySource } = response.body;
      staleBySource.forEach((source: any) => {
        expect(source).toHaveProperty('ageInDays');
        expect(typeof source.ageInDays).toBe('number');
        expect(source.ageInDays).toBeGreaterThanOrEqual(0);
      });
    });

    it('should assign SLA badges based on age thresholds', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const { staleBySource } = response.body;
      staleBySource.forEach((source: any) => {
        expect(source).toHaveProperty('slaBadge');
        expect(['green', 'yellow', 'red']).toContain(source.slaBadge);

        // Verify badge matches age
        if (source.ageInDays < 30) {
          expect(source.slaBadge).toBe('green');
        } else if (source.ageInDays < 60) {
          expect(source.slaBadge).toBe('yellow');
        } else {
          expect(source.slaBadge).toBe('red');
        }
      });
    });

    it('should include evidence IDs for each source', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const { staleBySource } = response.body;
      staleBySource.forEach((source: any) => {
        expect(source).toHaveProperty('evidenceIds');
        expect(source.evidenceIds).toBeInstanceOf(Array);
        expect(source.evidenceIds.length).toBeGreaterThan(0);
      });
    });

    it('should sort stale items by stalest first', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const { staleBySource } = response.body;
      if (staleBySource.length > 1) {
        for (let i = 0; i < staleBySource.length - 1; i++) {
          expect(staleBySource[i].ageInDays).toBeGreaterThanOrEqual(staleBySource[i + 1].ageInDays);
        }
      }
    });

    it('should include SLA thresholds in response', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      expect(response.body).toHaveProperty('slaThresholds');
      expect(response.body.slaThresholds).toHaveProperty('green');
      expect(response.body.slaThresholds).toHaveProperty('yellow');
      expect(response.body.slaThresholds).toHaveProperty('red');
    });

    it('should include timestamp', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('GET /compliance/coverage/source/:sourceId', () => {
    it('should return source-specific coverage details', async () => {
      const response = await request(app)
        .get('/compliance/coverage/source/nppes')
        .expect(200);

      expect(response.body).toHaveProperty('sourceId');
      expect(response.body.sourceId).toBe('nppes');
      expect(response.body).toHaveProperty('totalVerifications');
      expect(response.body).toHaveProperty('successfulVerifications');
      expect(response.body).toHaveProperty('verifications');
    });

    it('should return 404 for unknown source', async () => {
      const response = await request(app)
        .get('/compliance/coverage/source/unknown-source')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('source_not_found');
    });

    it('should include SLA badge for source', async () => {
      const response = await request(app)
        .get('/compliance/coverage/source/nppes')
        .expect(200);

      expect(response.body).toHaveProperty('slaBadge');
      expect(['green', 'yellow', 'red']).toContain(response.body.slaBadge);
    });

    it('should include verification list with ages', async () => {
      const response = await request(app)
        .get('/compliance/coverage/source/nppes')
        .expect(200);

      expect(response.body).toHaveProperty('verifications');
      expect(response.body.verifications).toBeInstanceOf(Array);

      response.body.verifications.forEach((verification: any) => {
        expect(verification).toHaveProperty('id');
        expect(verification).toHaveProperty('ageInDays');
        expect(verification).toHaveProperty('slaBadge');
      });
    });
  });

  describe('GET /compliance/coverage/evidence/:evidenceId', () => {
    it('should return evidence details', async () => {
      const response = await request(app)
        .get('/compliance/coverage/evidence/ver-1')
        .expect(200);

      expect(response.body).toHaveProperty('evidenceId');
      expect(response.body.evidenceId).toBe('ver-1');
      expect(response.body).toHaveProperty('verificationType');
      expect(response.body).toHaveProperty('ageInDays');
      expect(response.body).toHaveProperty('slaBadge');
    });

    it('should return 404 for unknown evidence', async () => {
      const response = await request(app)
        .get('/compliance/coverage/evidence/unknown-evidence')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('evidence_not_found');
    });

    it('should include request and response payloads', async () => {
      const response = await request(app)
        .get('/compliance/coverage/evidence/ver-1')
        .expect(200);

      expect(response.body).toHaveProperty('requestPayload');
      expect(response.body).toHaveProperty('responsePayload');
      expect(response.body).toHaveProperty('durationMs');
    });
  });

  describe('SLA Badge Logic', () => {
    it('should assign green badge for age < 30 days', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const greenSources = response.body.staleBySource.filter((s: any) => s.ageInDays < 30);
      greenSources.forEach((source: any) => {
        expect(source.slaBadge).toBe('green');
      });
    });

    it('should assign yellow badge for age 30-60 days', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const yellowSources = response.body.staleBySource.filter(
        (s: any) => s.ageInDays >= 30 && s.ageInDays < 60
      );
      yellowSources.forEach((source: any) => {
        expect(source.slaBadge).toBe('yellow');
      });
    });

    it('should assign red badge for age >= 90 days', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const redSources = response.body.staleBySource.filter((s: any) => s.ageInDays >= 90);
      redSources.forEach((source: any) => {
        expect(source.slaBadge).toBe('red');
      });
    });
  });

  describe('Tiles Validation', () => {
    it('should have auto-PSV tile matching summary', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const autoPSVTile = response.body.tiles.find((t: any) => t.id === 'auto-psv-percentage');
      if (autoPSVTile) {
        const expectedValue = `${response.body.summary.autoPSVPercentage}%`;
        expect(autoPSVTile.value).toBe(expectedValue);
      }
    });

    it('should have total sources tile', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const totalSourcesTile = response.body.tiles.find((t: any) => t.id === 'total-sources');
      expect(totalSourcesTile).toBeDefined();
      expect(totalSourcesTile.value).toBe(response.body.summary.totalSources.toString());
    });

    it('should have SLA distribution tiles', async () => {
      const response = await request(app)
        .get('/compliance/coverage')
        .expect(200);

      const slaGreenTile = response.body.tiles.find((t: any) => t.id === 'sla-green');
      const slaYellowTile = response.body.tiles.find((t: any) => t.id === 'sla-yellow');
      const slaRedTile = response.body.tiles.find((t: any) => t.id === 'sla-red');

      expect(slaGreenTile).toBeDefined();
      expect(slaYellowTile).toBeDefined();
      expect(slaRedTile).toBeDefined();

      expect(slaGreenTile.badge).toBe('green');
      expect(slaYellowTile.badge).toBe('yellow');
      expect(slaRedTile.badge).toBe('red');
    });
  });
});
