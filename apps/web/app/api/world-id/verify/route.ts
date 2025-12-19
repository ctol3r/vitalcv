import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

    const resp = await fetch(`${backendUrl}/worldid/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const data = await resp.json().catch(() => ({ error: "Invalid JSON from backend" }))
    return NextResponse.json(data, { status: resp.status })
  } catch (error) {
    console.error("World ID verify error:", error)
    return NextResponse.json({ error: "Failed to verify World ID proof" }, { status: 502 })
  }
}


