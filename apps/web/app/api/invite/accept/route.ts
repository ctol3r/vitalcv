import { NextResponse, type NextRequest } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const resp = await fetch(`${BACKEND_URL}/api/invite/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await resp.json().catch(() => ({ error: "Invalid response from backend" }))
    if (!resp.ok) return NextResponse.json(data, { status: resp.status })

    const response = NextResponse.json(data, { status: 200 })
    if (data?.token) {
      response.cookies.set("auth-token", String(data.token), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      })
    }
    return response
  } catch (error) {
    console.error("Invite acceptance failed:", error)
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 })
  }
}
