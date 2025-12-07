/**
 * Deep link handler for delegation flows
 * Supports: vitalcv://delegation?action=assign&delegatorId=xxx&delegateeId=yyy
 */

export interface DelegationDeepLinkParams {
  action?: 'assign' | 'view' | 'revoke';
  delegatorId?: string;
  delegateeId?: string;
  edgeId?: string;
  clinicianId?: string;
  department?: string;
}

export function parseDelegationDeepLink(url: string): DelegationDeepLinkParams | null {
  if (!url.startsWith('vitalcv://delegation')) {
    return null;
  }

  try {
    const parsed = new URL(url.replace('vitalcv://', 'https://'));
    const params: DelegationDeepLinkParams = {};

    if (parsed.searchParams.has('action')) {
      const action = parsed.searchParams.get('action');
      if (action === 'assign' || action === 'view' || action === 'revoke') {
        params.action = action;
      }
    }

    if (parsed.searchParams.has('delegatorId')) {
      params.delegatorId = parsed.searchParams.get('delegatorId') || undefined;
    }

    if (parsed.searchParams.has('delegateeId')) {
      params.delegateeId = parsed.searchParams.get('delegateeId') || undefined;
    }

    if (parsed.searchParams.has('edgeId')) {
      params.edgeId = parsed.searchParams.get('edgeId') || undefined;
    }

    if (parsed.searchParams.has('clinicianId')) {
      params.clinicianId = parsed.searchParams.get('clinicianId') || undefined;
    }

    if (parsed.searchParams.has('department')) {
      params.department = parsed.searchParams.get('department') || undefined;
    }

    return params;
  } catch (error) {
    console.error('[delegation] Failed to parse deep link:', error);
    return null;
  }
}

export function createDelegationDeepLink(params: DelegationDeepLinkParams): string {
  const url = new URL('vitalcv://delegation');

  if (params.action) {
    url.searchParams.set('action', params.action);
  }
  if (params.delegatorId) {
    url.searchParams.set('delegatorId', params.delegatorId);
  }
  if (params.delegateeId) {
    url.searchParams.set('delegateeId', params.delegateeId);
  }
  if (params.edgeId) {
    url.searchParams.set('edgeId', params.edgeId);
  }
  if (params.clinicianId) {
    url.searchParams.set('clinicianId', params.clinicianId);
  }
  if (params.department) {
    url.searchParams.set('department', params.department);
  }

  return url.toString().replace('https://', 'vitalcv://');
}

