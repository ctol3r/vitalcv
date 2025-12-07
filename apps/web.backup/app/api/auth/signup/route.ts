import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, fingerprint } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Basic password validation
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Forward to backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

    try {
        const backendRes = await fetch(`${backendUrl}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, fingerprint })
        });

        const data = await backendRes.json();

        if (!backendRes.ok) {
             return NextResponse.json(data, { status: backendRes.status });
        }

        const response = NextResponse.json(
          {
            message: "Account created successfully",
            user: data.user,
          },
          { status: 201 },
        )

        // Set authentication cookie
        if (data.token) {
            response.cookies.set("auth-token", data.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 24 * 7, // 7 days
            })
        }

        return response
    } catch (err) {
        console.error("Backend connection error:", err);
        return NextResponse.json({ error: "Failed to connect to backend" }, { status: 503 });
    }

  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
