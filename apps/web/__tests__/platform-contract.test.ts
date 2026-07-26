import { describe, expect, it } from 'vitest';
import { PLATFORM_API_VERSION, PLATFORM_ENDPOINTS, isPlatformSchema, platformPath } from '../lib/platform/contract';

describe('platform contract (W330-C1/C2)', () => {
  it('pins the platform version and every endpoint is v1 + public + GET', () => {
    expect(PLATFORM_API_VERSION).toBe('v1');
    for (const ep of PLATFORM_ENDPOINTS) {
      expect(ep.schema.endsWith('.v1')).toBe(true);
      expect(ep.visibility).toBe('public');
      expect(ep.method).toBe('GET');
    }
  });

  it('builds encoded paths and rejects unknown endpoints', () => {
    expect(platformPath('evidence', 'entity-1')).toBe('/api/evidence/entity-1');
    expect(platformPath('mobility-readiness', 'a/b')).toBe('/api/mobility/a%2Fb/readiness');
    // @ts-expect-error unknown id
    expect(() => platformPath('nope', 'x')).toThrow();
  });

  it('validates versioned platform schemas (fail-closed on drift)', () => {
    expect(isPlatformSchema('vitalcv.evidence-collection.v1')).toBe(true);
    expect(isPlatformSchema('vitalcv.evidence-collection.v2')).toBe(false);
    expect(isPlatformSchema('something.else')).toBe(false);
    expect(isPlatformSchema(null)).toBe(false);
  });
});
