import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const credentialId = params.id

    if (!credentialId) {
      return NextResponse.json({ error: "Credential ID is required" }, { status: 400 })
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"
    const response = await fetch(`${backendUrl}/status/${encodeURIComponent(credentialId)}`, { cache: "no-store" })
    const data = await response.json().catch(() => ({ error: "Invalid JSON from backend" }))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Status lookup error:", error)
    return NextResponse.json({ error: "Failed to retrieve status" }, { status: 500 })
  }
}
