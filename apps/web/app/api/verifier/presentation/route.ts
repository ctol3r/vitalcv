import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { credentialId, nonce, audience } = body

    if (!credentialId || !nonce || !audience) {
      return NextResponse.json({ error: "credentialId, nonce, and audience are required" }, { status: 400 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const token = cookies().get("auth-token")?.value
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (token) headers.Authorization = `Bearer ${token}`
      const response = await fetch(`${BACKEND_URL}/verifier/presentation`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to verify presentation" }))
        return NextResponse.json(
          { error: errorData.error || `Backend error: ${response.status}` },
          { status: response.status },
        )
      }

      const data = await response.json()
      return NextResponse.json(data, { status: 200 })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json({ error: "Request timeout - backend took too long to respond" }, { status: 408 })
      }
      throw fetchError
    }
  } catch (error) {
    console.error("Presentation verification error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify presentation" },
      { status: 500 },
    )
  }
}
