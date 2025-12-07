/**
 * useRoleProfile Hook
 * React hook for accessing role profile data
 */

import { useMemo } from 'react';
import { roleEngine, RoleType, RoleProfile, RoleMetadata } from '../RoleEngine';

export interface UseRoleProfileReturn {
  profile: RoleProfile | null;
  metadata: RoleMetadata | null;
  trustScore: number;
  complianceScore: number;
  canActivate: boolean;
  blockers: string[];
  nextSteps: string[];
}

/**
 * Hook for accessing role profile information
 */
export function useRoleProfile(
  did: string | null,
  roleType: RoleType | null
): UseRoleProfileReturn {
  return useMemo(() => {
    if (!did || !roleType) {
      return {
        profile: null,
        metadata: null,
        trustScore: 0,
        complianceScore: 0,
        canActivate: false,
        blockers: [],
        nextSteps: [],
      };
    }

    const profile = roleEngine.getRoleProfile(did, roleType);
    const metadata = profile ? roleEngine.getRoleMetadata(roleType) : null;
    const { canActivate, blockers, nextSteps } = profile
      ? roleEngine.canActivateRole(did, roleType)
      : { canActivate: false, blockers: ['Profile not found'], nextSteps: [] };

    // Recalculate compliance score
    const complianceScore = profile
      ? roleEngine.recalculateComplianceScore(profile)
      : 0;

    return {
      profile,
      metadata,
      trustScore: profile?.trustScore || 0,
      complianceScore,
      canActivate,
      blockers,
      nextSteps,
    };
  }, [did, roleType]);
}

