/**
 * useRoleSwitch Hook
 * React hook for real-time role switching
 */

import { useCallback, useEffect, useState } from 'react';
import { roleEngine, RoleType, RoleProfile } from '../RoleEngine';

export interface UseRoleSwitchReturn {
  currentRole: RoleType | null;
  availableRoles: RoleProfile[];
  switchRole: (roleType: RoleType) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing role switching
 */
export function useRoleSwitch(did: string | null): UseRoleSwitchReturn {
  const [currentRole, setCurrentRole] = useState<RoleType | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RoleProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available roles and current role
  useEffect(() => {
    if (!did) {
      setCurrentRole(null);
      setAvailableRoles([]);
      return;
    }

    const profiles = roleEngine.getRoleProfiles(did);
    const activeProfiles = profiles.filter((p) => p.isActive);
    setAvailableRoles(activeProfiles);

    const active = roleEngine.getCurrentRole(did);
    setCurrentRole(active);
  }, [did]);

  const switchRole = useCallback(
    async (roleType: RoleType): Promise<boolean> => {
      if (!did) {
        setError('DID not available');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Check if role can be activated
        const { canActivate, blockers } = roleEngine.canActivateRole(did, roleType);
        if (!canActivate) {
          setError(`Cannot activate role: ${blockers.join(', ')}`);
          setIsLoading(false);
          return false;
        }

        // Perform switch
        const success = roleEngine.switchRole(did, roleType);
        if (success) {
          setCurrentRole(roleType);

          // Emit role switch event (for analytics/chain anchoring)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('role-switched', {
                detail: { did, roleType, timestamp: new Date() },
              })
            );
          }
        } else {
          setError('Failed to switch role');
        }

        setIsLoading(false);
        return success;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setIsLoading(false);
        return false;
      }
    },
    [did]
  );

  return {
    currentRole,
    availableRoles,
    switchRole,
    isLoading,
    error,
  };
}

