import { NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"

export async function GET() {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/metrics/summary`, { cache: "no-store" })
    const data = await resp.json().catch(() => ({ error: "Invalid response from backend" }))
    return NextResponse.json(data, { status: resp.status })
  } catch (error) {
    console.error("Metrics summary fetch failed:", error)
    return NextResponse.json({ error: "Failed to load metrics summary" }, { status: 500 })
  }
}
