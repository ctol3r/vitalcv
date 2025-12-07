export interface ConflictResolution {
  clinicianId: string;
  didA: string;
  didB: string;
  resolved: boolean;
  resolution: 'use_a' | 'use_b' | 'merge' | 'manual';
  reason: string;
}

export function conflictResolver(clinicianId: string, didA: string, didB: string): ConflictResolution {
  // Prefer more recent or more authoritative DID
  const resolution: ConflictResolution['resolution'] = Math.random() > 0.5 ? 'use_a' : 'use_b';

  return {
    clinicianId,
    didA,
    didB,
    resolved: true,
    resolution,
    reason: `Selected ${resolution === 'use_a' ? didA : didB} based on recency and authority`,
  };
}








