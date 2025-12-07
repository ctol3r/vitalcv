/**
 * Admin Portal API Client
 *
 * Centralized API client for admin portal operations
 */

import {
  AdminDashboardData,
  UserSearchResult,
  FacilitySearchResult,
  ChainHealthStatus,
  AnchorBacklog,
  AIDecisionLog,
  PlatformAnalytics,
  ComplianceMetrics,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

/**
 * Get auth headers with admin session
 */
function getAuthHeaders(): HeadersInit {
  const session = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('vitalcv-admin-session') || '{}')
    : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }

  return headers;
}

/**
 * Admin Dashboard API
 */
export const adminDashboardApi = {
  async getDashboardData(): Promise<AdminDashboardData> {
    const response = await fetch(`${API_BASE}/api/admin/dashboard`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
    }

    return response.json();
  },
};

/**
 * User Management API
 */
export const adminUserApi = {
  async searchUsers(query: string, filters?: {
    role?: string;
    claimLevel?: number;
    complianceStatus?: string;
  }): Promise<UserSearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (filters?.role) params.append('role', filters.role);
    if (filters?.claimLevel !== undefined) params.append('claimLevel', String(filters.claimLevel));
    if (filters?.complianceStatus) params.append('complianceStatus', filters.complianceStatus);

    const response = await fetch(`${API_BASE}/api/admin/users/search?${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to search users: ${response.statusText}`);
    }

    return response.json();
  },

  async getUserDetails(userId: string): Promise<UserSearchResult> {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user details: ${response.statusText}`);
    }

    return response.json();
  },

  async resendInvite(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/resend-invite`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to resend invite: ${response.statusText}`);
    }
  },

  async clearStuckTasks(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/clear-tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to clear stuck tasks: ${response.statusText}`);
    }
  },

  async renewChainAnchors(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/renew-anchors`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to renew chain anchors: ${response.statusText}`);
    }
  },

  async refreshCredentials(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/refresh-credentials`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh credentials: ${response.statusText}`);
    }
  },

  async forceVerificationRerun(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/force-verification`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to force verification rerun: ${response.statusText}`);
    }
  },

  async blockUser(userId: string, reason: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/block`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw new Error(`Failed to block user: ${response.statusText}`);
    }
  },

  async unblockUser(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/unblock`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to unblock user: ${response.statusText}`);
    }
  },
};

/**
 * Facility Management API
 */
export const adminFacilityApi = {
  async searchFacilities(query: string, filters?: {
    type?: string;
    status?: string;
  }): Promise<FacilitySearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE}/api/admin/facilities/search?${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to search facilities: ${response.statusText}`);
    }

    return response.json();
  },

  async getFacilityDetails(facilityId: string): Promise<FacilitySearchResult> {
    const response = await fetch(`${API_BASE}/api/admin/facilities/${facilityId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch facility details: ${response.statusText}`);
    }

    return response.json();
  },

  async getFacilityHealth(facilityId: string): Promise<{
    apiUptime: number;
    oidcConfigured: boolean;
    chainSync: 'synced' | 'pending' | 'error';
    lastSyncAt: string;
  }> {
    const response = await fetch(`${API_BASE}/api/admin/facilities/${facilityId}/health`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch facility health: ${response.statusText}`);
    }

    return response.json();
  },

  async freezeFacility(facilityId: string, reason: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/facilities/${facilityId}/freeze`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw new Error(`Failed to freeze facility: ${response.statusText}`);
    }
  },

  async unfreezeFacility(facilityId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/facilities/${facilityId}/unfreeze`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to unfreeze facility: ${response.statusText}`);
    }
  },
};

/**
 * Chain Monitoring API
 */
export const adminChainApi = {
  async getChainHealth(): Promise<ChainHealthStatus> {
    const response = await fetch(`${API_BASE}/api/admin/chain/health`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chain health: ${response.statusText}`);
    }

    return response.json();
  },

  async getAnchorBacklog(): Promise<AnchorBacklog> {
    const response = await fetch(`${API_BASE}/api/admin/chain/backlog`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch anchor backlog: ${response.statusText}`);
    }

    return response.json();
  },

  async exploreChainEvent(blockHash: string): Promise<{
    block: any;
    anchors: any[];
    vcs: any[];
  }> {
    const response = await fetch(`${API_BASE}/api/admin/chain/events/${blockHash}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to explore chain event: ${response.statusText}`);
    }

    return response.json();
  },
};

/**
 * AI Decision Logs API
 */
export const adminAIApi = {
  async getDecisionLogs(filters?: {
    type?: string;
    reviewed?: boolean;
    limit?: number;
  }): Promise<AIDecisionLog[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.reviewed !== undefined) params.append('reviewed', String(filters.reviewed));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await fetch(`${API_BASE}/api/admin/ai/decisions?${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AI decision logs: ${response.statusText}`);
    }

    return response.json();
  },

  async overrideDecision(decisionId: string, override: 'safe' | 'escalate' | 'ignore', reason: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/admin/ai/decisions/${decisionId}/override`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ override, reason }),
    });

    if (!response.ok) {
      throw new Error(`Failed to override decision: ${response.statusText}`);
    }
  },
};

/**
 * Analytics API
 */
export const adminAnalyticsApi = {
  async getPlatformAnalytics(): Promise<PlatformAnalytics> {
    const response = await fetch(`${API_BASE}/api/admin/analytics/platform`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch platform analytics: ${response.statusText}`);
    }

    return response.json();
  },

  async getComplianceMetrics(): Promise<ComplianceMetrics> {
    const response = await fetch(`${API_BASE}/api/admin/analytics/compliance`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch compliance metrics: ${response.statusText}`);
    }

    return response.json();
  },

  async generateNCQAReport(startDate: string, endDate: string): Promise<Blob> {
    const params = new URLSearchParams({ startDate, endDate });
    const response = await fetch(`${API_BASE}/api/admin/analytics/ncqa-report?${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate NCQA report: ${response.statusText}`);
    }

    return response.blob();
  },

  async exportTrustStateReport(userId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/api/admin/analytics/trust-state/${userId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to export trust state report: ${response.statusText}`);
    }

    return response.blob();
  },
};

/**
 * Activity Log API
 */
export const adminActivityApi = {
  async getActivityLogs(filters?: {
    adminId?: string;
    resourceType?: string;
    limit?: number;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.adminId) params.append('adminId', filters.adminId);
    if (filters?.resourceType) params.append('resourceType', filters.resourceType);
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await fetch(`${API_BASE}/api/admin/activity?${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch activity logs: ${response.statusText}`);
    }

    return response.json();
  },
};

