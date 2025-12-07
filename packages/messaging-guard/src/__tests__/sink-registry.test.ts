import { describe, it, expect } from 'vitest';
import {
  SINK_REGISTRY,
  getSinkById,
  getSinksByType,
  getSinksByEnvironment,
  isValidSinkId,
  getAllSinkIds,
} from '../sink-registry';

describe('Sink Registry (B95B-SEC-001)', () => {
  describe('Registry structure', () => {
    it('should have all required sink IDs', () => {
      const requiredSinks = [
        'svc.issuer-api',
        'svc.verifier-api',
        'svc.trust-registry',
        'svc.audit-log',
        'svc.compliance-api',
        'svc.privileges-api',
        'svc.router',
        'etl.fhir-gateway',
        'job.psv',
        'queue.dlq',
      ];

      const registeredIds = getAllSinkIds();
      for (const sinkId of requiredSinks) {
        expect(registeredIds).toContain(sinkId);
      }
    });

    it('should have valid sink ID format for all entries', () => {
      for (const sink of SINK_REGISTRY) {
        expect(isValidSinkId(sink.id)).toBe(true);
      }
    });

    it('should have all required fields for each entry', () => {
      for (const sink of SINK_REGISTRY) {
        expect(sink.id).toBeTruthy();
        expect(sink.description).toBeTruthy();
        expect(sink.type).toBeTruthy();
        expect(sink.environments.length).toBeGreaterThan(0);
        expect(sink.owner).toBeTruthy();
      }
    });
  });

  describe('getSinkById', () => {
    it('should return sink entry for valid ID', () => {
      const sink = getSinkById('svc.issuer-api');
      expect(sink).toBeDefined();
      expect(sink?.id).toBe('svc.issuer-api');
      expect(sink?.type).toBe('svc');
    });

    it('should return undefined for invalid ID', () => {
      const sink = getSinkById('svc.non-existent');
      expect(sink).toBeUndefined();
    });
  });

  describe('getSinksByType', () => {
    it('should return all service sinks', () => {
      const svcSinks = getSinksByType('svc');
      expect(svcSinks.length).toBeGreaterThan(0);
      expect(svcSinks.every(s => s.type === 'svc')).toBe(true);
    });

    it('should return all ETL sinks', () => {
      const etlSinks = getSinksByType('etl');
      expect(etlSinks.length).toBeGreaterThan(0);
      expect(etlSinks.every(s => s.type === 'etl')).toBe(true);
    });

    it('should return all job sinks', () => {
      const jobSinks = getSinksByType('job');
      expect(jobSinks.length).toBeGreaterThan(0);
      expect(jobSinks.every(s => s.type === 'job')).toBe(true);
    });
  });

  describe('getSinksByEnvironment', () => {
    it('should return sinks available in production', () => {
      const prodSinks = getSinksByEnvironment('production');
      expect(prodSinks.length).toBeGreaterThan(0);
      expect(prodSinks.every(s => s.environments.includes('production'))).toBe(true);
    });

    it('should return sinks available in development', () => {
      const devSinks = getSinksByEnvironment('development');
      expect(devSinks.length).toBeGreaterThan(0);
      expect(devSinks.every(s => s.environments.includes('development'))).toBe(true);
    });

    it('should return sinks available in staging', () => {
      const stagingSinks = getSinksByEnvironment('staging');
      expect(stagingSinks.length).toBeGreaterThan(0);
      expect(stagingSinks.every(s => s.environments.includes('staging'))).toBe(true);
    });
  });

  describe('isValidSinkId', () => {
    it('should validate correct sink ID formats', () => {
      expect(isValidSinkId('svc.issuer-api')).toBe(true);
      expect(isValidSinkId('etl.fhir-gateway')).toBe(true);
      expect(isValidSinkId('job.psv')).toBe(true);
      expect(isValidSinkId('queue.dlq')).toBe(true);
      expect(isValidSinkId('db.postgres')).toBe(true);
    });

    it('should reject invalid sink ID formats', () => {
      expect(isValidSinkId('invalid')).toBe(false);
      expect(isValidSinkId('svc')).toBe(false);
      expect(isValidSinkId('svc.')).toBe(false);
      expect(isValidSinkId('.issuer-api')).toBe(false);
      expect(isValidSinkId('svc.issuer_api')).toBe(false); // underscore not allowed
      expect(isValidSinkId('SVC.issuer-api')).toBe(false); // uppercase not allowed
    });
  });

  describe('getAllSinkIds', () => {
    it('should return all registered sink IDs', () => {
      const ids = getAllSinkIds();
      expect(ids.length).toBe(SINK_REGISTRY.length);
      expect(ids.every(id => isValidSinkId(id))).toBe(true);
    });
  });
});

