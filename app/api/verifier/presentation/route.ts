import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { credentialId, nonce, audience, privacyMode, disclosureType, dcqlRequest } = await request.json()

    if (!credentialId) {
      return NextResponse.json({ error: "credentialId is required" }, { status: 400 })
    }

    // Validate nonce if provided (5-minute freshness check)
    if (nonce) {
      try {
        const parts = nonce.split('.')
        if (parts.length >= 3) {
          const timestamp = parseInt(parts[0], 36)
          const age = Date.now() - timestamp
          if (age > 5 * 60 * 1000) {
            return NextResponse.json(
              { error: "Nonce has expired", status: "fail" },
              { status: 400 }
            )
          }
        }
      } catch (err) {
        console.warn('[Verifier] Nonce validation warning:', err)
      }
    }

    const status = getMockVerificationStatus(credentialId)

    // Extract claims if DCQL request provided
    const claims = dcqlRequest ? extractMockClaims(credentialId, dcqlRequest) : undefined

    const mockResponse = {
      credentialId,
      status,
      claims,
      issuer: "California Medical Board",
      issuedDate: "2024-01-15",
      expiryDate: "2025-01-15",
      reason: status !== "valid" ? getVerificationReason(status) : undefined,
      auditRef: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      verifiedAt: new Date().toISOString(),
    }

    // Track analytics
    console.log('[Verifier] Presentation verified:', {
      credentialId,
      status,
      dcqlUsed: !!dcqlRequest,
      privacyMode,
    })

    const delay = privacyMode ? 1500 : 500 // ZK proofs take longer
    await new Promise((resolve) => setTimeout(resolve, delay))

    return NextResponse.json(mockResponse, { status: 200 })
  } catch (error) {
    console.error("Presentation verification error:", error)
    return NextResponse.json({ error: "Failed to verify presentation" }, { status: 500 })
  }
}

function getMockVerificationStatus(credentialId: string): "valid" | "revoked" | "unknown" {
  if (credentialId.includes("revoked")) return "revoked"
  if (credentialId.includes("unknown")) return "unknown"
  if (credentialId.includes("CRED-12345")) return "valid"

  // Default to valid for most test cases
  return "valid"
}

function getVerificationReason(status: string): string {
  switch (status) {
    case "revoked":
      return "Credential has been revoked by the issuing authority"
    case "unknown":
      return "Credential could not be verified - not found in registry"
    default:
      return "Verification completed"
  }
}

function extractMockClaims(credentialId: string, dcqlRequest: any): Record<string, unknown> {
  // Mock claim extraction based on DCQL request
  const mockClaims: Record<string, unknown> = {
    licenseNumber: `MD-${credentialId.substring(5, 10).toUpperCase()}`,
    issuer: 'California Medical Board',
    expiryDate: '2025-12-31',
    subjectId: `did:example:${credentialId.toLowerCase()}`,
  }

  // Filter claims based on DCQL required fields if specified
  if (dcqlRequest?.query?.input_descriptors?.[0]?.constraints?.fields) {
    const fields = dcqlRequest.query.input_descriptors[0].constraints.fields
    const requestedFields = fields.map((f: any) => {
      const path = f.path[0] || f.path
      return path.split('.').pop()
    })

    const filteredClaims: Record<string, unknown> = {}
    for (const field of requestedFields) {
      if (field in mockClaims) {
        filteredClaims[field] = mockClaims[field]
      }
    }
    return filteredClaims
  }

  return mockClaims
}
