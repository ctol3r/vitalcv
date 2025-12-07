'use client';

/**
 * Session Context - Manages user session, roles, and claim level
 */

import { UserRole, UserSession } from '@/lib/npi-types';
import { ReactNode, createContext, useContext, useEffect, useState } from 'react';

interface SessionContextValue {
  session: UserSession | null;
  isLoading: boolean;
  updateSession: (updates: Partial<UserSession>) => void;
  hasRole: (role: UserRole) => boolean;
  canAccessIssuer: () => boolean;
  canAccessVerifier: () => boolean;
  canAccessRecruiter: () => boolean;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from server/localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        // In production, fetch from server
        // const response = await fetch('/api/auth/session');
        // const data = await response.json();

        // For now, load from localStorage for demo
        const stored = localStorage.getItem('vital-cv-session');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSession(parsed);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  const updateSession = (updates: Partial<UserSession>) => {
    setSession((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };

      // Persist to localStorage
      try {
        localStorage.setItem('vital-cv-session', JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save session:', error);
      }

      return updated;
    });
  };

  const hasRole = (role: UserRole): boolean => {
    return session?.roles.includes(role) ?? false;
  };

  const canAccessIssuer = (): boolean => {
    // Issuer requires issuer role AND claim level 3 (organization)
    return hasRole('issuer') && (session?.claimLevel ?? 0) >= 3;
  };

  const canAccessVerifier = (): boolean => {
    // Verifier requires verifier role (organization or enterprise)
    return hasRole('verifier');
  };

  const canAccessRecruiter = (): boolean => {
    // Recruiter requires recruiter role
    return hasRole('recruiter');
  };

  const logout = () => {
    setSession(null);
    try {
      localStorage.removeItem('vital-cv-session');
      localStorage.removeItem('vital-cv-selected-role');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };

  return (
    <SessionContext.Provider
      value={{
        session,
        isLoading,
        updateSession,
        hasRole,
        canAccessIssuer,
        canAccessVerifier,
        canAccessRecruiter,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
