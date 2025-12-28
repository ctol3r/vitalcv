import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 })
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"
    const response = await fetch(
      `${backendUrl}/analytics/match-gaps?jobId=${encodeURIComponent(jobId)}`,
      { cache: "no-store" }
    )
    const data = await response.json().catch(() => ({ error: "Invalid JSON from backend" }))

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Match gap fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch match gap analytics" }, { status: 500 })
  }
}
