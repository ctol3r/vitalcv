import { NextResponse } from "next/server"

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"
    const response = await fetch(`${backendUrl}/readyz`, { cache: "no-store" })
    const data = await response.json().catch(() => ({ error: "Invalid JSON from backend" }))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Readiness check error:", error)
    return NextResponse.json(
      {
        status: "not_ready",
        timestamp: new Date().toISOString(),
        error: "Readiness check failed",
      },
      { status: 503 },
    )
  }
}
