// VitalCV API Client - Centralized backend integration layer
// Handles all communication with the VitalCV backend services

interface ApiResponse<T = any> {
  data?: T
  error?: string
  status: number
}

interface CredentialStatus {
  credentialId: string
  status: "valid" | "revoked" | "unknown" | "suspended" | "expired"
  statusReason?: string
  lastUpdated: string
  nextUpdate?: string
  issuer?: string
  issuedDate?: string
  expiryDate?: string
  auditRef?: string
}

interface VerificationRequest {
  credentialId: string
  nonce: string
  audience: string
  privacyMode?: boolean
  disclosureType?: "plain" | "bbs" | "zk"
}

interface VerificationResult {
  credentialId: string
  status: "valid" | "revoked" | "unknown"
  details?: {
    issuer?: string
    subject?: string
    type?: string
    issuedAt?: string
    expiresAt?: string
    verificationMethod?: string
    nonce?: string
    audience?: string
    privacyMode?: boolean
    reason?: string
    disclosureType?: string
  }
  auditRef?: string
  verifiedAt?: string
}

class VitalCVApiClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl?: string, timeout = 5000) {
    // Use environment variable pointing to backend at localhost:4000
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_BACKEND_URL || ""
    this.timeout = timeout
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = `${this.baseUrl}${endpoint}`
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      return {
        data: response.ok ? data : undefined,
        error: response.ok ? undefined : data.error || `HTTP ${response.status}`,
        status: response.status,
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return { error: "Request timeout", status: 408 }
        }
        return { error: error.message, status: 500 }
      }

      return { error: "Unknown error occurred", status: 500 }
    }
  }

  // Health check endpoints
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.makeRequest("/api/healthz")
  }

  async readinessCheck(): Promise<ApiResponse<{ status: string; services: Record<string, boolean> }>> {
    return this.makeRequest("/api/readyz")
  }

  // Credential status checking
  async getCredentialStatus(credentialId: string): Promise<ApiResponse<CredentialStatus>> {
    if (!credentialId?.trim()) {
      return { error: "Credential ID is required", status: 400 }
    }

    return this.makeRequest(`/api/status/${encodeURIComponent(credentialId.trim())}`)
  }

  // Verifier endpoints
  async getCredentialStatusByVerifier(credentialId: string): Promise<ApiResponse<CredentialStatus>> {
    if (!credentialId?.trim()) {
      return { error: "Credential ID is required", status: 400 }
    }

    return this.makeRequest(`/api/verifier/credential/${encodeURIComponent(credentialId.trim())}/status`)
  }

  async verifyPresentation(request: VerificationRequest): Promise<ApiResponse<VerificationResult>> {
    const { credentialId, nonce, audience } = request

    if (!credentialId?.trim() || !nonce?.trim() || !audience?.trim()) {
      return {
        error: "credentialId, nonce, and audience are required",
        status: 400,
      }
    }

    return this.makeRequest("/api/verifier/presentation", {
      method: "POST",
      body: JSON.stringify(request),
    })
  }

  // Credential revocation
  async revokeCredential(
    credentialId: string,
    reason?: string,
  ): Promise<ApiResponse<{ success: boolean; auditRef: string }>> {
    if (!credentialId?.trim()) {
      return { error: "Credential ID is required", status: 400 }
    }

    return this.makeRequest("/api/status/revoke", {
      method: "POST",
      body: JSON.stringify({ credentialId: credentialId.trim(), reason }),
    })
  }

  // Authentication endpoints
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> {
    if (!email?.trim() || !password?.trim()) {
      return { error: "Email and password are required", status: 400 }
    }

    return this.makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password }),
    })
  }

  async signup(email: string, password: string, name?: string): Promise<ApiResponse<{ token: string; user: any }>> {
    if (!email?.trim() || !password?.trim()) {
      return { error: "Email and password are required", status: 400 }
    }

    return this.makeRequest("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password, name: name?.trim() }),
    })
  }

  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    return this.makeRequest("/api/auth/logout", {
      method: "POST",
    })
  }

  // Issuer endpoints
  async issueCredential(credentialData: any): Promise<ApiResponse<any>> {
    return this.makeRequest("/api/issuer/credential", {
      method: "POST",
      body: JSON.stringify(credentialData),
    })
  }

  async getPendingClaims(): Promise<ApiResponse<any[]>> {
    return this.makeRequest("/api/issuer/claims")
  }

  async getClaimDetails(id: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/api/issuer/claims/${id}`)
  }

  async approveClaim(id: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/api/issuer/claims/${id}/approve`, {
      method: "POST",
    })
  }

  async rejectClaim(id: string, reason?: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/api/issuer/claims/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
  }

  // Delegation endpoints
  async assignDelegation(data: { delegateEmail: string; scopes: string[] }): Promise<ApiResponse<any>> {
    return this.makeRequest("/api/delegation/assign", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async removeDelegation(id: string): Promise<ApiResponse<any>> {
    return this.makeRequest("/api/delegation/remove", {
      method: "POST",
      body: JSON.stringify({ id }),
    })
  }

  async listDelegations(): Promise<ApiResponse<any>> {
    return this.makeRequest("/api/delegation/list")
  }

  // File upload endpoints
  async uploadCV(file: File): Promise<ApiResponse<{ fileId: string; analysis: any }>> {
    const formData = new FormData()
    formData.append("cv", file)

    return this.makeRequest("/api/upload/cv", {
      method: "POST",
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    })
  }

  // Hiring endpoints
  async getHiringRecommendations(orgId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/api/hiring/recommend/${orgId}`)
  }

  // Admin endpoints
  async getRiskScores(): Promise<ApiResponse<any[]>> {
    return this.makeRequest("/api/admin/risk")
  }

  // NPI sync for clinicians
  async syncNPI(npiNumber: string): Promise<ApiResponse<{ success: boolean; data: any }>> {
    if (!npiNumber?.trim()) {
      return { error: "NPI number is required", status: 400 }
    }

    return this.makeRequest("/api/clinician/npi-sync", {
      method: "POST",
      body: JSON.stringify({ npiNumber: npiNumber.trim() }),
    })
  }
}

// Export singleton instance
export const apiClient = new VitalCVApiClient()

// Export types for use in components
export type { ApiResponse, CredentialStatus, VerificationRequest, VerificationResult }
