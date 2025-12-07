import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // TODO: Replace with actual backend call
    // For now, simulate authentication
    if (email === "demo@vitalcv.com" && password === "demo123") {
      const response = NextResponse.json(
        {
          message: "Login successful",
          user: {
            id: "1",
            email: email,
            name: "Demo User",
          },
        },
        { status: 200 },
      )

      // Set authentication cookie
      response.cookies.set("auth-token", "demo-token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })

      return response
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
