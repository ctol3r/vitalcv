import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"

export async function GET() {
  try {
    const token = cookies().get("auth-token")?.value
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    const resp = await fetch(`${BACKEND_URL}/issuer/credentials`, {
      cache: "no-store",
      headers,
    })

    const data = await resp.json().catch(() => ({ error: "Invalid response from backend" }))
    return NextResponse.json(data, { status: resp.status })
  } catch (error) {
    console.error("Failed to load issued credentials:", error)
    return NextResponse.json({ error: "Unable to fetch credentials" }, { status: 500 })
  }
}
