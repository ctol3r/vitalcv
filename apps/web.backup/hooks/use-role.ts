/**
 * Use Role Hook
 * Manages user role selection with localStorage persistence
 * Task: 1104-frontend-0010
 */

'use client';

import { UserRole } from '@/lib/npi-types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const ROLE_STORAGE_KEY = 'vitalcv:selected-role';
const ROLE_TIMESTAMP_KEY = 'vitalcv:role-timestamp';
const ROLE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface UseRoleReturn {
  selectedRole: UserRole | null;
  switchRole: (role: UserRole) => void;
  hasMultipleRoles: boolean;
  isHydrated: boolean;
}

export function useRole(availableRoles: UserRole[]): UseRoleReturn {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const router = useRouter();

  // Initialize role from localStorage or default to first available role
  useEffect(() => {
    const initializeRole = () => {
      if (availableRoles.length === 0) {
        setSelectedRole(null);
        setIsHydrated(true);
        return;
      }

      // Try to load from localStorage
      const storedRole = loadRoleFromStorage();

      if (storedRole && availableRoles.includes(storedRole)) {
        setSelectedRole(storedRole);
      } else {
        // Default to first available role
        const defaultRole = availableRoles[0];
        setSelectedRole(defaultRole);
        saveRoleToStorage(defaultRole);
      }

      setIsHydrated(true);
    };

    initializeRole();
  }, [availableRoles]);

  const switchRole = useCallback(
    (role: UserRole) => {
      if (!availableRoles.includes(role)) {
        console.warn(`Role ${role} is not available for this user`);
        return;
      }

      setSelectedRole(role);
      saveRoleToStorage(role);

      // Navigate to role-specific home page
      const roleRoutes: Record<UserRole, string> = {
        holder: '/wallet',
        issuer: '/issuer',
        verifier: '/verify',
      };

      const targetRoute = roleRoutes[role];
      if (targetRoute) {
        router.push(targetRoute);
      }
    },
    [availableRoles, router]
  );

  const hasMultipleRoles = availableRoles.length > 1;

  return {
    selectedRole,
    switchRole,
    hasMultipleRoles,
    isHydrated,
  };
}

/**
 * Load role from localStorage with expiry check
 */
function loadRoleFromStorage(): UserRole | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
    const storedTimestamp = localStorage.getItem(ROLE_TIMESTAMP_KEY);

    if (!storedRole || !storedTimestamp) {
      return null;
    }

    const timestamp = parseInt(storedTimestamp, 10);
    const now = Date.now();

    // Check if role has expired
    if (now - timestamp > ROLE_TTL) {
      // Clean up expired data
      localStorage.removeItem(ROLE_STORAGE_KEY);
      localStorage.removeItem(ROLE_TIMESTAMP_KEY);
      return null;
    }

    return storedRole as UserRole;
  } catch (error) {
    console.error('Failed to load role from storage:', error);
    return null;
  }
}

/**
 * Save role to localStorage with timestamp
 */
function saveRoleToStorage(role: UserRole): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
    localStorage.setItem(ROLE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Failed to save role to storage:', error);
  }
}

/**
 * Clear role from localStorage
 */
export function clearRoleFromStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(ROLE_STORAGE_KEY);
    localStorage.removeItem(ROLE_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Failed to clear role from storage:', error);
  }
}

/**
 * Get current role from storage without React state
 */
export function getCurrentRole(): UserRole | null {
  return loadRoleFromStorage();
}
