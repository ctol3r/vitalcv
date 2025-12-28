import { type NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const resp = await fetch(`${BACKEND_URL}/api/early-access/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await resp.json().catch(() => ({ error: "Invalid response from backend" }))
    return NextResponse.json(data, { status: resp.status })
  } catch (error) {
    console.error("Early access request failed:", error)
    return NextResponse.json({ error: "Failed to submit early access request" }, { status: 500 })
  }
}
