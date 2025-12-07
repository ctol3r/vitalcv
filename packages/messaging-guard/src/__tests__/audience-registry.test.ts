import { describe, it, expect } from 'vitest';
import {
  getPrimaryAudience,
  getAudiencesForEnvironment,
  isValidAudienceForEnvironment,
  normalizeEnvironment,
  isValidAudienceFormat,
  AUDIENCE_REGISTRY,
} from '../audience-registry';

describe('Audience Registry', () => {
  describe('getPrimaryAudience', () => {
    it('should return dev.vitalcv.com for development', () => {
      expect(getPrimaryAudience('development')).toBe('dev.vitalcv.com');
      expect(getPrimaryAudience('dev')).toBe('dev.vitalcv.com');
    });

    it('should return staging.vitalcv.com for staging', () => {
      expect(getPrimaryAudience('staging')).toBe('staging.vitalcv.com');
      expect(getPrimaryAudience('stage')).toBe('staging.vitalcv.com');
    });

    it('should return vitalcv.com for production', () => {
      expect(getPrimaryAudience('production')).toBe('vitalcv.com');
      expect(getPrimaryAudience('prod')).toBe('vitalcv.com');
    });

    it('should default to development for unknown environment', () => {
      expect(getPrimaryAudience('unknown')).toBe('dev.vitalcv.com');
    });
  });

  describe('getAudiencesForEnvironment', () => {
    it('should return all valid audiences for development', () => {
      const audiences = getAudiencesForEnvironment('development');
      expect(audiences).toContain('dev.vitalcv.com');
      expect(audiences).toContain('development.vitalcv.com');
    });

    it('should return all valid audiences for staging', () => {
      const audiences = getAudiencesForEnvironment('staging');
      expect(audiences).toContain('staging.vitalcv.com');
    });

    it('should return all valid audiences for production', () => {
      const audiences = getAudiencesForEnvironment('production');
      expect(audiences).toContain('vitalcv.com');
    });
  });

  describe('isValidAudienceForEnvironment', () => {
    it('should validate correct audience for development', () => {
      expect(isValidAudienceForEnvironment('dev.vitalcv.com', 'development')).toBe(true);
      expect(isValidAudienceForEnvironment('development.vitalcv.com', 'development')).toBe(true);
    });

    it('should validate correct audience for staging', () => {
      expect(isValidAudienceForEnvironment('staging.vitalcv.com', 'staging')).toBe(true);
    });

    it('should validate correct audience for production', () => {
      expect(isValidAudienceForEnvironment('vitalcv.com', 'production')).toBe(true);
    });

    it('should reject wrong audience for environment', () => {
      expect(isValidAudienceForEnvironment('vitalcv.com', 'development')).toBe(false);
      expect(isValidAudienceForEnvironment('dev.vitalcv.com', 'production')).toBe(false);
    });

    it('should validate array of audiences if one matches', () => {
      expect(isValidAudienceForEnvironment(['vitalcv.com', 'dev.vitalcv.com'], 'development')).toBe(true);
      expect(isValidAudienceForEnvironment(['vitalcv.com', 'staging.vitalcv.com'], 'development')).toBe(false);
    });
  });

  describe('normalizeEnvironment', () => {
    it('should normalize development variants', () => {
      expect(normalizeEnvironment('dev')).toBe('development');
      expect(normalizeEnvironment('development')).toBe('development');
      expect(normalizeEnvironment('DEV')).toBe('development');
    });

    it('should normalize staging variants', () => {
      expect(normalizeEnvironment('staging')).toBe('staging');
      expect(normalizeEnvironment('stage')).toBe('staging');
    });

    it('should normalize production variants', () => {
      expect(normalizeEnvironment('prod')).toBe('production');
      expect(normalizeEnvironment('production')).toBe('production');
    });

    it('should default to development for unknown', () => {
      expect(normalizeEnvironment('unknown')).toBe('development');
    });
  });

  describe('isValidAudienceFormat', () => {
    it('should validate correct audience formats', () => {
      expect(isValidAudienceFormat('dev.vitalcv.com')).toBe(true);
      expect(isValidAudienceFormat('staging.vitalcv.com')).toBe(true);
      expect(isValidAudienceFormat('vitalcv.com')).toBe(true);
      expect(isValidAudienceFormat('production.vitalcv.com')).toBe(true);
    });

    it('should reject invalid audience formats', () => {
      expect(isValidAudienceFormat('invalid.com')).toBe(false);
      expect(isValidAudienceFormat('vitalcv.org')).toBe(false);
      expect(isValidAudienceFormat('not-a-domain')).toBe(false);
      expect(isValidAudienceFormat('')).toBe(false);
    });
  });
});

