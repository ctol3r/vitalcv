/**
 * Hook for managing user role selection and persistence
 */

import { UserRole } from '@/lib/npi-types';
import { useEffect, useState } from 'react';

const ROLE_STORAGE_KEY = 'vital-cv-selected-role';

export function useRole(availableRoles: UserRole[] = []) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ROLE_STORAGE_KEY);
      if (stored && availableRoles.includes(stored as UserRole)) {
        setSelectedRole(stored as UserRole);
      } else if (availableRoles.length > 0) {
        // Default to first available role
        setSelectedRole(availableRoles[0]);
      }
    } catch (error) {
      console.error('Failed to load role from localStorage:', error);
    } finally {
      setIsHydrated(true);
    }
  }, [availableRoles]);

  // Persist to localStorage when role changes
  const switchRole = (role: UserRole) => {
    if (!availableRoles.includes(role)) {
      console.warn(`Role ${role} not available for user`);
      return;
    }

    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
      setSelectedRole(role);
    } catch (error) {
      console.error('Failed to save role to localStorage:', error);
    }
  };

  return {
    selectedRole,
    switchRole,
    availableRoles,
    hasMultipleRoles: availableRoles.length > 1,
    isHydrated,
  };
}
