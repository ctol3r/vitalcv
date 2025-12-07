/**
 * Admin Authentication & Authorization
 *
 * Handles OAuth2 + DPoP + RBAC for admin portal access
 */

import { AdminRole } from './types';

export interface AdminAuthConfig {
  oauth2Provider: string;
  clientId: string;
  redirectUri: string;
  dpopEnabled: boolean;
}

export interface AdminSession {
  adminId: string;
  email: string;
  name: string;
  roles: AdminRole[];
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  dpopProof?: string;
}

/**
 * Check if user has required admin role(s)
 */
export function hasAdminRole(
  userRoles: AdminRole[],
  requiredRoles: AdminRole | AdminRole[]
): boolean {
  const required = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return required.some((role) => userRoles.includes(role));
}

/**
 * Check if user is SuperAdmin
 */
export function isSuperAdmin(userRoles: AdminRole[]): boolean {
  return userRoles.includes(AdminRole.SuperAdmin);
}

/**
 * Get required roles for specific admin actions
 */
export function getRequiredRolesForAction(action: string): AdminRole[] {
  const roleMap: Record<string, AdminRole[]> = {
    // User management
    'user.view': [AdminRole.SuperAdmin, AdminRole.Support, AdminRole.CustomerSuccess],
    'user.edit': [AdminRole.SuperAdmin, AdminRole.Support],
    'user.impersonate': [AdminRole.SuperAdmin, AdminRole.Support],
    'user.block': [AdminRole.SuperAdmin, AdminRole.Compliance],

    // Facility management
    'facility.view': [AdminRole.SuperAdmin, AdminRole.Support, AdminRole.CustomerSuccess],
    'facility.edit': [AdminRole.SuperAdmin, AdminRole.CustomerSuccess],
    'facility.onboard': [AdminRole.SuperAdmin, AdminRole.CustomerSuccess],
    'facility.offboard': [AdminRole.SuperAdmin],

    // Chain operations
    'chain.view': [AdminRole.SuperAdmin, AdminRole.Engineering, AdminRole.Auditor],
    'chain.anchor': [AdminRole.SuperAdmin, AdminRole.Engineering],

    // AI operations
    'ai.view': [AdminRole.SuperAdmin, AdminRole.Compliance, AdminRole.Auditor],
    'ai.override': [AdminRole.SuperAdmin, AdminRole.Compliance],

    // Analytics
    'analytics.view': [AdminRole.SuperAdmin, AdminRole.Auditor, AdminRole.CustomerSuccess],
    'analytics.export': [AdminRole.SuperAdmin, AdminRole.Auditor],

    // Compliance
    'compliance.view': [AdminRole.SuperAdmin, AdminRole.Compliance, AdminRole.Auditor],
    'compliance.export': [AdminRole.SuperAdmin, AdminRole.Compliance, AdminRole.Auditor],
  };

  return roleMap[action] || [AdminRole.SuperAdmin];
}

/**
 * Check if user can perform action
 */
export function canPerformAction(
  userRoles: AdminRole[],
  action: string
): boolean {
  if (isSuperAdmin(userRoles)) {
    return true; // SuperAdmin can do everything
  }

  const requiredRoles = getRequiredRolesForAction(action);
  return hasAdminRole(userRoles, requiredRoles);
}

/**
 * Generate DPoP proof (simplified - in production, use proper DPoP library)
 */
export async function generateDPoPProof(
  accessToken: string,
  method: string,
  url: string
): Promise<string> {
  // In production, this would:
  // 1. Generate a key pair
  // 2. Create a JWT with the HTTP method, URL, and access token hash
  // 3. Sign with the private key
  // For now, return a placeholder
  return `dpop-proof-${Date.now()}`;
}

/**
 * Validate admin session from storage
 */
export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem('vitalcv-admin-session');
    if (!stored) {
      return null;
    }

    const session = JSON.parse(stored) as AdminSession;

    // Check if expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      localStorage.removeItem('vitalcv-admin-session');
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to load admin session:', error);
    return null;
  }
}

/**
 * Save admin session to storage
 */
export function saveAdminSession(session: AdminSession): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('vitalcv-admin-session', JSON.stringify(session));
  } catch (error) {
    console.error('Failed to save admin session:', error);
  }
}

/**
 * Clear admin session
 */
export function clearAdminSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('vitalcv-admin-session');
}

