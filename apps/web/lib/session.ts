/**
 * Session Management
 * Persist user session state including claim level and roles
 */

import { ClaimLevel, UserRole } from '@/config/features';

const SESSION_STORAGE_KEY = 'vital_cv_session';
const SESSION_COOKIE_NAME = 'vital_cv_session';

export interface UserSession {
  userId?: string;
  npi?: string;
  email?: string;
  phone?: string;
  claimLevel: ClaimLevel;
  roles: UserRole[];
  verifiedHuman?: boolean;
  verifiedHumanProvider?: 'worldid';
  verifiedHumanVerifiedAt?: string;
  verifiedAt?: string;
  expiresAt?: string;
}

const DEFAULT_SESSION: UserSession = {
  claimLevel: 0,
  roles: ['holder'],
};

/**
 * Get current session from localStorage and cookie
 */
export function getSession(): UserSession {
  if (typeof window === 'undefined') {
    return DEFAULT_SESSION;
  }

  try {
    // Try localStorage first
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const session = JSON.parse(stored) as UserSession;
      return { ...DEFAULT_SESSION, ...session };
    }

    // Fall back to cookie
    const cookieSession = getCookieSession();
    if (cookieSession) {
      return cookieSession;
    }
  } catch (error) {
    console.error('Failed to load session:', error);
  }

  return DEFAULT_SESSION;
}

/**
 * Save session to localStorage and cookie
 */
export function saveSession(session: Partial<UserSession>): void {
  if (typeof window === 'undefined') return;

  try {
    const currentSession = getSession();
    const updatedSession: UserSession = {
      ...currentSession,
      ...session,
    };

    // Save to localStorage
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));

    // Save to cookie (for server-side access)
    const expires =
      session.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify(updatedSession),
    )}; expires=${new Date(expires).toUTCString()}; path=/; SameSite=Strict`;

    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('sessionUpdated', { detail: updatedSession }));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

/**
 * Clear session
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    document.cookie = `${SESSION_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    window.dispatchEvent(new CustomEvent('sessionCleared'));
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

/**
 * Update claim level
 */
export function updateClaimLevel(level: ClaimLevel): void {
  const session = getSession();
  saveSession({ ...session, claimLevel: level, verifiedAt: new Date().toISOString() });
}

/**
 * Mark a user as "verified human" (anti-bot only; not licensure).
 */
export function setVerifiedHuman(provider: 'worldid'): void {
  const session = getSession();
  saveSession({
    ...session,
    verifiedHuman: true,
    verifiedHumanProvider: provider,
    verifiedHumanVerifiedAt: new Date().toISOString(),
  });
}

/**
 * Add role to session
 */
export function addRole(role: UserRole): void {
  const session = getSession();
  if (!session.roles.includes(role)) {
    saveSession({ ...session, roles: [...session.roles, role] });
  }
}

/**
 * Remove role from session
 */
export function removeRole(role: UserRole): void {
  const session = getSession();
  saveSession({
    ...session,
    roles: session.roles.filter((r) => r !== role),
  });
}

/**
 * Check if user has role
 */
export function hasRole(role: UserRole): boolean {
  const session = getSession();
  return session.roles.includes(role) || session.roles.includes('admin');
}

/**
 * Check if user has required level
 */
export function hasLevel(requiredLevel: ClaimLevel): boolean {
  const session = getSession();
  return session.claimLevel >= requiredLevel;
}

/**
 * Check if session is expired
 */
export function isSessionExpired(): boolean {
  const session = getSession();
  if (!session.expiresAt) return false;
  return new Date(session.expiresAt) < new Date();
}

/**
 * Get session from cookie (for server-side)
 */
function getCookieSession(): UserSession | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  const sessionCookie = cookies.find((c) => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!sessionCookie) return null;

  try {
    const value = sessionCookie.split('=')[1];
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
}

/**
 * Subscribe to session change events.
 */
export function createSessionListener(callback: (session: UserSession) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<UserSession>;
    callback(customEvent.detail || getSession());
  };

  window.addEventListener('sessionUpdated', handleUpdate);
  window.addEventListener('sessionCleared', handleUpdate);

  return () => {
    window.removeEventListener('sessionUpdated', handleUpdate);
    window.removeEventListener('sessionCleared', handleUpdate);
  };
}
