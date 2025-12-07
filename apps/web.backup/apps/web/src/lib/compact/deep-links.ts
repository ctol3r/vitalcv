/**
 * Deep link handlers for compact features
 *
 * Supports: vitalcv://compact
 */

export interface CompactDeepLinkParams {
  compactType?: string;
  state?: string;
  clinicianId?: string;
  action?: 'evaluate' | 'view' | 'apply';
}

/**
 * Parse compact deep link
 */
export function parseCompactDeepLink(url: string): CompactDeepLinkParams | null {
  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== 'vitalcv:') {
      return null;
    }

    if (urlObj.hostname !== 'compact') {
      return null;
    }

    const params: CompactDeepLinkParams = {};

    if (urlObj.searchParams.has('type')) {
      params.compactType = urlObj.searchParams.get('type') || undefined;
    }
    if (urlObj.searchParams.has('state')) {
      params.state = urlObj.searchParams.get('state') || undefined;
    }
    if (urlObj.searchParams.has('clinicianId')) {
      params.clinicianId = urlObj.searchParams.get('clinicianId') || undefined;
    }
    if (urlObj.searchParams.has('action')) {
      params.action = urlObj.searchParams.get('action') as CompactDeepLinkParams['action'] || undefined;
    }

    return params;
  } catch {
    return null;
  }
}

/**
 * Generate compact deep link
 */
export function generateCompactDeepLink(params: CompactDeepLinkParams): string {
  const url = new URL('vitalcv://compact');

  if (params.compactType) {
    url.searchParams.set('type', params.compactType);
  }
  if (params.state) {
    url.searchParams.set('state', params.state);
  }
  if (params.clinicianId) {
    url.searchParams.set('clinicianId', params.clinicianId);
  }
  if (params.action) {
    url.searchParams.set('action', params.action);
  }

  return url.toString();
}

/**
 * Handle compact deep link navigation
 */
export function handleCompactDeepLink(params: CompactDeepLinkParams): string {
  // Return route path for navigation
  if (params.action === 'apply') {
    return `/compact/apply?type=${params.compactType || ''}&state=${params.state || ''}`;
  }
  if (params.action === 'view') {
    return `/compact/view?type=${params.compactType || ''}&state=${params.state || ''}`;
  }
  return `/compact/evaluate?type=${params.compactType || ''}&state=${params.state || ''}`;
}

