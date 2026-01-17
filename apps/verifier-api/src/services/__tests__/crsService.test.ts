import { describe, it, expect } from 'vitest';
import {
  computeCRS,
  CRSInput,
  CRSRequirementKey,
  CRS_REQUIREMENT_KEYS,
  DEFAULT_CRS_CONFIG,
} from '../crsService';

describe('CRS Service - computeCRS', () => {
  it('should return 100 when all requirements are met', () => {
    const requirements = CRS_REQUIREMENT_KEYS.reduce<Record<CRSRequirementKey, boolean>>(
      (acc, key) => {
        acc[key] = true;
        return acc;
      },
      {} as Record<CRSRequirementKey, boolean>
    );
    const input: CRSInput = { requirements };
    const result = computeCRS(input);
    expect(result.score).toBe(100);
    expect(result.missingRequirements).toEqual([]);
  });

  it('should list all missing requirements when none are provided', () => {
    const result = computeCRS({});
    expect(result.score).toBe(0);
    expect(result.missingRequirements).toEqual([...CRS_REQUIREMENT_KEYS]);
  });

  it('should compute score for partial completion and report missing list', () => {
    const input: CRSInput = {
      requirements: {
        license_active: true,
        board_certified: true,
        sanctions_clear: true,
      },
    };
    const result = computeCRS(input);
    // 3 of 7 requirements met -> 43
    expect(result.score).toBe(43);
    expect(result.missingRequirements).toEqual([
      'background_check_clear',
      'enrollment_complete',
      'malpractice_clear',
      'references_verified',
    ]);
  });

  it('should respect custom weights', () => {
    const config = {
      ...DEFAULT_CRS_CONFIG,
      weights: {
        ...DEFAULT_CRS_CONFIG.weights,
        license_active: 2,
      },
    };
    const input: CRSInput = {
      requirements: {
        license_active: true,
        board_certified: true,
      },
    };
    const result = computeCRS(input, config);
    // weights: license(2) + board(1) / total(8) = 37.5 -> 38
    expect(result.score).toBe(38);
  });
});
