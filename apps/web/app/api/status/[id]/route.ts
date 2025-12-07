import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const credentialId = params.id

    if (!credentialId) {
      return NextResponse.json({ error: "Credential ID is required" }, { status: 400 })
    }

    // TODO: Replace with actual backend call
    // For now, simulate status lookup
    const mockStatuses = ["valid", "revoked", "suspended", "expired"]
    const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)]

    const mockResponse = {
      credentialId,
      status: randomStatus,
      statusReason: randomStatus === "revoked" ? "License expired" : null,
      lastUpdated: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    }

    return NextResponse.json(mockResponse, { status: 200 })
  } catch (error) {
    console.error("Status lookup error:", error)
    return NextResponse.json({ error: "Failed to retrieve status" }, { status: 500 })
  }
}
