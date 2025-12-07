/**
 * Facility Privileging Engine - Deep Link Handler
 * Phase 1: Deep link: vitalcv://privileges
 */

/**
 * Handle deep link: vitalcv://privileges
 * Supports:
 * - vitalcv://privileges - Open privileges page
 * - vitalcv://privileges?code=CARD-CATH-ADULT - Open specific privilege
 * - vitalcv://privileges?clinicianId=xxx - View privileges for clinician
 * - vitalcv://privileges?request=xxx - View privilege request
 */
export function handlePrivilegeDeepLink(url: string): {
  route: string;
  params: Record<string, string>;
} {
  // Parse vitalcv://privileges URL
  const urlObj = new URL(url.replace('vitalcv://', 'https://'));
  const path = urlObj.pathname;
  const params: Record<string, string> = {};

  // Extract query parameters
  urlObj.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  // Determine route
  if (path === '/privileges' || path === 'privileges') {
    if (params.code) {
      return {
        route: '/privileges',
        params: { code: params.code },
      };
    }
    if (params.clinicianId) {
      return {
        route: '/privileges',
        params: { clinicianId: params.clinicianId },
      };
    }
    if (params.request) {
      return {
        route: '/privileges/request',
        params: { id: params.request },
      };
    }
    return {
      route: '/privileges',
      params: {},
    };
  }

  return {
    route: '/privileges',
    params: {},
  };
}

/**
 * Generate deep link for a privilege
 */
export function generatePrivilegeDeepLink(
  privilegeCode: string,
  options?: { clinicianId?: string; facilityId?: string }
): string {
  const params = new URLSearchParams();
  params.set('code', privilegeCode);
  if (options?.clinicianId) {
    params.set('clinicianId', options.clinicianId);
  }
  if (options?.facilityId) {
    params.set('facilityId', options.facilityId);
  }
  return `vitalcv://privileges?${params.toString()}`;
}

/**
 * Generate deep link for a privilege request
 */
export function generatePrivilegeRequestDeepLink(requestId: string): string {
  return `vitalcv://privileges?request=${requestId}`;
}

