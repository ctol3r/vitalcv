import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { credentialId, nonce, audience, privacyMode, disclosureType } = await request.json()

    if (!credentialId || !nonce || !audience) {
      return NextResponse.json({ error: "credentialId, nonce, and audience are required" }, { status: 400 })
    }

    const status = getMockVerificationStatus(credentialId)

    const mockResponse = {
      credentialId,
      status,
      details: {
        issuer: "California Medical Board",
        subject: "Dr. Sarah Johnson",
        type: "Medical License",
        issuedAt: "2024-01-15T10:30:00Z",
        expiresAt: "2025-01-15T10:30:00Z",
        verificationMethod: "did:web:vitalcv.com#key-1",
        nonce,
        audience,
        privacyMode: privacyMode || false,
        reason: status !== "valid" ? getVerificationReason(status) : undefined,
        disclosureType: getDisclosureTypeLabel(disclosureType),
      },
      auditRef: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      verifiedAt: new Date().toISOString(),
    }

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

function getDisclosureTypeLabel(disclosureType?: string): string {
  switch (disclosureType) {
    case "bbs":
      return "BBS+ selective disclosure"
    case "zk":
      return "Zero-knowledge proof"
    case "plain":
    default:
      return "Full disclosure"
  }
}
