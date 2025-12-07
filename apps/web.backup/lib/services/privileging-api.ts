/**
 * Privileging API Client
 * Centralized API client for privileging system endpoints
 */

import {
  PrivilegeSet,
  CreatePrivilegeSetRequest,
  ListPrivilegeSetsResponse,
  CreatePrivilegeSetResponse,
  GetPrivilegeSetResponse,
  PrivilegeRequest,
  ListPrivilegeRequestsResponse,
  GetPrivilegeRequestResponse,
  ApproveRequestBody,
  DenyRequestBody,
  OppeRecord,
  ListOppeRecordsResponse,
  FppeEvaluation,
  GetFppeEvaluationResponse,
  SubmitFppeEvaluationRequest,
  OppeEvaluation,
  GetOppeEvaluationResponse,
  SubmitOppeEvaluationRequest,
} from "@/lib/types/privileging";

const API_BASE = "/api/org";

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API Error: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// PRIVILEGE SETS
// ============================================================================

export const privilegeSetsAPI = {
  /**
   * List all privilege sets
   */
  async list(params?: {
    status?: string;
    department?: string;
    search?: string;
  }): Promise<PrivilegeSet[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.department) searchParams.set("department", params.department);
    if (params?.search) searchParams.set("search", params.search);

    const url = `${API_BASE}/privilege-sets${
      searchParams.toString() ? `?${searchParams}` : ""
    }`;

    const response = await fetchAPI<ListPrivilegeSetsResponse>(url);
    return response.data || [];
  },

  /**
   * Get a specific privilege set by ID
   */
  async get(id: string): Promise<PrivilegeSet> {
    const response = await fetchAPI<GetPrivilegeSetResponse>(
      `${API_BASE}/privilege-sets/${id}`
    );

    if (!response.data) {
      throw new Error("Privilege set not found");
    }

    return response.data;
  },

  /**
   * Create a new privilege set
   */
  async create(data: CreatePrivilegeSetRequest): Promise<PrivilegeSet> {
    const response = await fetchAPI<CreatePrivilegeSetResponse>(
      `${API_BASE}/privilege-sets`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );

    if (!response.data) {
      throw new Error("Failed to create privilege set");
    }

    return response.data;
  },
};

// ============================================================================
// PRIVILEGE REQUESTS
// ============================================================================

export const privilegeRequestsAPI = {
  /**
   * List all privilege requests
   */
  async list(params?: {
    status?: string;
    department?: string;
    search?: string;
  }): Promise<PrivilegeRequest[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.department) searchParams.set("department", params.department);
    if (params?.search) searchParams.set("search", params.search);

    const url = `${API_BASE}/privilege-requests${
      searchParams.toString() ? `?${searchParams}` : ""
    }`;

    const response = await fetchAPI<ListPrivilegeRequestsResponse>(url);
    return response.data || [];
  },

  /**
   * Get a specific privilege request by ID
   */
  async get(id: string): Promise<PrivilegeRequest> {
    const response = await fetchAPI<GetPrivilegeRequestResponse>(
      `${API_BASE}/privilege-requests/${id}`
    );

    if (!response.data) {
      throw new Error("Privilege request not found");
    }

    return response.data;
  },

  /**
   * Approve a privilege request
   */
  async approve(id: string, notes?: string): Promise<void> {
    await fetchAPI(`${API_BASE}/privilege-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes } as ApproveRequestBody),
    });
  },

  /**
   * Deny a privilege request
   */
  async deny(id: string, notes: string, reason: string): Promise<void> {
    await fetchAPI(`${API_BASE}/privilege-requests/${id}/deny`, {
      method: "POST",
      body: JSON.stringify({ notes, reason } as DenyRequestBody),
    });
  },
};

// ============================================================================
// OPPE RECORDS
// ============================================================================

export const oppeRecordsAPI = {
  /**
   * List all OPPE records
   */
  async list(params?: {
    type?: "FPPE" | "OPPE";
    status?: string;
    department?: string;
    search?: string;
  }): Promise<OppeRecord[]> {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set("type", params.type);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.department) searchParams.set("department", params.department);
    if (params?.search) searchParams.set("search", params.search);

    const url = `${API_BASE}/oppe-records${
      searchParams.toString() ? `?${searchParams}` : ""
    }`;

    const response = await fetchAPI<ListOppeRecordsResponse>(url);
    return response.data || [];
  },
};

// ============================================================================
// FPPE EVALUATIONS
// ============================================================================

export const fppeEvaluationsAPI = {
  /**
   * Get a specific FPPE evaluation by record ID
   */
  async get(recordId: string): Promise<FppeEvaluation> {
    const response = await fetchAPI<GetFppeEvaluationResponse>(
      `${API_BASE}/fppe-evaluations/${recordId}`
    );

    if (!response.data) {
      throw new Error("FPPE evaluation not found");
    }

    return response.data;
  },

  /**
   * Submit a FPPE evaluation
   */
  async submit(
    recordId: string,
    data: SubmitFppeEvaluationRequest
  ): Promise<void> {
    await fetchAPI(`${API_BASE}/fppe-evaluations/${recordId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// ============================================================================
// OPPE EVALUATIONS
// ============================================================================

export const oppeEvaluationsAPI = {
  /**
   * Get a specific OPPE evaluation by record ID
   */
  async get(recordId: string): Promise<OppeEvaluation> {
    const response = await fetchAPI<GetOppeEvaluationResponse>(
      `${API_BASE}/oppe-evaluations/${recordId}`
    );

    if (!response.data) {
      throw new Error("OPPE evaluation not found");
    }

    return response.data;
  },

  /**
   * Submit or save draft of OPPE evaluation
   */
  async submit(
    recordId: string,
    data: SubmitOppeEvaluationRequest
  ): Promise<void> {
    await fetchAPI(`${API_BASE}/oppe-evaluations/${recordId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export const privilegingAPI = {
  privilegeSets: privilegeSetsAPI,
  privilegeRequests: privilegeRequestsAPI,
  oppeRecords: oppeRecordsAPI,
  fppeEvaluations: fppeEvaluationsAPI,
  oppeEvaluations: oppeEvaluationsAPI,
};

export default privilegingAPI;

