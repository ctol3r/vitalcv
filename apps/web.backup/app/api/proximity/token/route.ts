import { type NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"

// In-memory store for proximity tokens (in production, use Redis)
const tokenStore = new Map<
  string,
  {
    token: string
    expiresAt: number
    credentialId?: string
    metadata?: Record<string, unknown>
  }
>()

// Cleanup expired tokens every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of tokenStore.entries()) {
    if (value.expiresAt < now) {
      tokenStore.delete(key)
    }
  }
}, 60000)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { credentialId, metadata } = body

    // Generate a random token
    const token = randomBytes(32).toString("hex")
    const expiresAt = Date.now() + 60 * 1000 // 60 seconds TTL

    // Store token
    tokenStore.set(token, {
      token,
      expiresAt,
      credentialId,
      metadata,
    })

    // Create deep link URL that requests VP token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const deepLink = `${baseUrl}/wallet/present?token=${token}`

    return NextResponse.json(
      {
        token,
        deepLink,
        expiresAt: new Date(expiresAt).toISOString(),
        expiresIn: 60,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Proximity token generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate proximity token" },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const stored = tokenStore.get(token)

    if (!stored) {
      return NextResponse.json({ error: "Token not found or expired" }, { status: 404 })
    }

    if (stored.expiresAt < Date.now()) {
      tokenStore.delete(token)
      return NextResponse.json({ error: "Token expired" }, { status: 410 })
    }

    return NextResponse.json(
      {
        token: stored.token,
        credentialId: stored.credentialId,
        metadata: stored.metadata,
        expiresAt: new Date(stored.expiresAt).toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Proximity token lookup error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to lookup proximity token" },
      { status: 500 },
    )
  }
}

