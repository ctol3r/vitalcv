/**
 * B126C-EVID-030: Evidence Registry Tests
 * Tests for evidence seed, SHA256 anchor verification, and KPI dereferencing
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import evidenceRegistryRouter from '../evidence-registry';
import { createHash } from 'crypto';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/evidence', evidenceRegistryRouter);

describe('Evidence Registry API', () => {
  describe('GET /api/evidence/registry', () => {
    it('should list all evidence entries', async () => {
      const response = await request(app)
        .get('/api/evidence/registry')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
      expect(Array.isArray(response.body.entries)).toBe(true);
    });

    it('should filter by kpiReference', async () => {
      const response = await request(app)
        .get('/api/evidence/registry')
        .query({ kpiReference: 'minutes-in-notes' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);

      // All entries should have the kpiReference
      response.body.entries.forEach((entry: any) => {
        expect(entry.kpiReference).toBe('minutes-in-notes');
      });
    });

    it('should return empty array for non-existent kpiReference', async () => {
      const response = await request(app)
        .get('/api/evidence/registry')
        .query({ kpiReference: 'non-existent-kpi' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.entries).toEqual([]);
    });
  });

  describe('GET /api/evidence/registry/:id', () => {
    it('should return full evidence entry for ambient-AI study', async () => {
      const response = await request(app)
        .get('/api/evidence/registry/ambient-ai-burnout-2025')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.entry).toBeDefined();
      expect(response.body.entry.id).toBe('ambient-ai-burnout-2025');
      expect(response.body.entry.study.doi).toBe('10.1001/jamanetworkopen.2025.34976');
      expect(response.body.entry.study.title).toContain('Ambient Artificial Intelligence');
      expect(response.body.entry.sha256.anchor).toBeDefined();
      expect(response.body.entry.sha256.algorithm).toBe('SHA256');
      expect(response.body.entry.sha256.verified).toBe(true);
    });

    it('should return 404 for non-existent evidence ID', async () => {
      const response = await request(app)
        .get('/api/evidence/registry/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('not_found');
    });
  });

  describe('POST /api/evidence/registry/verify', () => {
    it('should verify SHA256 anchor for ambient-AI study', async () => {
      // First, get the entry to get the expected metadata
      const getResponse = await request(app)
        .get('/api/evidence/registry/ambient-ai-burnout-2025')
        .expect(200);

      const entry = getResponse.body.entry;

      // Verify with correct metadata
      const studyMetadata = {
        title: entry.study.title,
        authors: entry.study.authors,
        journal: entry.study.journal,
        publicationDate: entry.study.publicationDate,
        doi: entry.study.doi,
      };

      const response = await request(app)
        .post('/api/evidence/registry/verify')
        .send({
          id: 'ambient-ai-burnout-2025',
          studyMetadata,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);
      expect(response.body.match).toBe(true);
      expect(response.body.providedHash).toBe(response.body.registryHash);
    });

    it('should fail verification with incorrect metadata', async () => {
      const incorrectMetadata = {
        title: 'Wrong Title',
        authors: ['Wrong Author'],
        journal: 'Wrong Journal',
        publicationDate: '2020-01-01',
        doi: '10.1234/wrong.doi',
      };

      const response = await request(app)
        .post('/api/evidence/registry/verify')
        .send({
          id: 'ambient-ai-burnout-2025',
          studyMetadata: incorrectMetadata,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(false);
      expect(response.body.match).toBe(false);
      expect(response.body.providedHash).not.toBe(response.body.registryHash);
    });

    it('should return verification status without metadata', async () => {
      const response = await request(app)
        .post('/api/evidence/registry/verify')
        .send({
          id: 'ambient-ai-burnout-2025',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.entry).toBeDefined();
      expect(response.body.entry.verified).toBe(true);
    });

    it('should return 404 for non-existent evidence ID', async () => {
      const response = await request(app)
        .post('/api/evidence/registry/verify')
        .send({
          id: 'non-existent-id',
        })
        .expect(404);

      expect(response.body.error).toBe('not_found');
    });
  });

  describe('GET /api/evidence/kpi/:kpiReference', () => {
    it('should dereference KPI to evidence entries', async () => {
      const response = await request(app)
        .get('/api/evidence/kpi/minutes-in-notes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.kpiReference).toBe('minutes-in-notes');
      expect(response.body.count).toBeGreaterThan(0);
      expect(Array.isArray(response.body.entries)).toBe(true);

      // Verify ambient-AI study is included
      const ambientAIStudy = response.body.entries.find(
        (e: any) => e.id === 'ambient-ai-burnout-2025'
      );
      expect(ambientAIStudy).toBeDefined();
      expect(ambientAIStudy.study.doi).toBe('10.1001/jamanetworkopen.2025.34976');
      expect(ambientAIStudy.citation).toBeDefined();
      expect(ambientAIStudy.citation.apa).toBeDefined();
      expect(ambientAIStudy.citation.bibtex).toBeDefined();
    });

    it('should return 404 for non-existent KPI reference', async () => {
      const response = await request(app)
        .get('/api/evidence/kpi/non-existent-kpi')
        .expect(404);

      expect(response.body.error).toBe('not_found');
    });
  });

  describe('SHA256 Anchor Integrity', () => {
    it('should maintain consistent SHA256 anchors across requests', async () => {
      const response1 = await request(app)
        .get('/api/evidence/registry/ambient-ai-burnout-2025')
        .expect(200);

      const response2 = await request(app)
        .get('/api/evidence/registry/ambient-ai-burnout-2025')
        .expect(200);

      expect(response1.body.entry.sha256.anchor).toBe(response2.body.entry.sha256.anchor);
    });

    it('should have valid SHA256 hash format', async () => {
      const response = await request(app)
        .get('/api/evidence/registry/ambient-ai-burnout-2025')
        .expect(200);

      const anchor = response.body.entry.sha256.anchor;

      // SHA256 hash should be 64 hex characters
      expect(anchor).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('KPI Mapping', () => {
    it('should include KPI mapping in evidence entry', async () => {
      const response = await request(app)
        .get('/api/evidence/registry/ambient-ai-burnout-2025')
        .expect(200);

      const entry = response.body.entry;
      expect(entry.kpiMapping).toBeDefined();
      expect(entry.kpiMapping.metric).toBe('minutes_saved_per_visit');
      expect(entry.kpiMapping.unit).toBe('minutes');
      expect(entry.kpiMapping.value).toBe(5.2);
      expect(entry.kpiMapping.confidence).toBeDefined();
      expect(entry.kpiMapping.notes).toBeDefined();
    });
  });

  describe('Citation Formats', () => {
    it('should include APA citation', async () => {
      const response = await request(app)
        .get('/api/evidence/registry/ambient-ai-burnout-2025')
        .expect(200);

      const citation = response.body.entry.citation;
      expect(citation.apa).toBeDefined();
      expect(citation.apa).toContain('Smith, J.');
      expect(citation.apa).toContain('JAMA Network Open');
      expect(citation.apa).toContain('10.1001/jamanetworkopen.2025.34976');
    });

    it('should include BibTeX citation', async () => {
      const response = await request(app)
        .get('/api/evidence/registry/ambient-ai-burnout-2025')
        .expect(200);

      const citation = response.body.entry.citation;
      expect(citation.bibtex).toBeDefined();
      expect(citation.bibtex).toContain('@article{');
      expect(citation.bibtex).toContain('doi={10.1001/jamanetworkopen.2025.34976}');
    });
  });
});

