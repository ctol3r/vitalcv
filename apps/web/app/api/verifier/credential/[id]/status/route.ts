import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const credentialId = params.id

    if (!credentialId) {
      return NextResponse.json({ error: "Credential ID is required" }, { status: 400 })
    }

    const mockResponse = {
      credentialId,
      status: getMockStatus(credentialId),
      issuer: "California Medical Board",
      issuedDate: "2024-01-15T10:30:00Z",
      expiryDate: "2025-01-15T10:30:00Z",
      lastUpdated: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      auditRef: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      statusReason: getStatusReason(getMockStatus(credentialId)),
    }

    return NextResponse.json(mockResponse, { status: 200 })
  } catch (error) {
    console.error("Status lookup error:", error)
    return NextResponse.json({ error: "Failed to retrieve credential status" }, { status: 500 })
  }
}

function getMockStatus(credentialId: string): "valid" | "revoked" | "unknown" {
  // Deterministic status based on credential ID for consistent testing
  if (credentialId.includes("revoked")) return "revoked"
  if (credentialId.includes("unknown")) return "unknown"
  if (credentialId.includes("CRED-12345")) return "valid"

  // Random status for other IDs
  const statuses: ("valid" | "revoked" | "unknown")[] = ["valid", "revoked", "unknown"]
  const hash = credentialId.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)
  return statuses[Math.abs(hash) % statuses.length]
}

function getStatusReason(status: string): string | undefined {
  switch (status) {
    case "revoked":
      return "License expired or voluntarily revoked"
    case "unknown":
      return "Credential not found in verification system"
    default:
      return undefined
  }
}
