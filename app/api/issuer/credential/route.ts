import { type NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.subjectId || !body.type) {
      return NextResponse.json({ error: "subjectId and type are required" }, { status: 400 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(`${BACKEND_URL}/issuer/credential`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to issue credential" }))
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
    console.error("Credential issuance error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to issue credential" },
      { status: 500 },
    )
  }
}
