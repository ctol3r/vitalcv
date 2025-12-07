import { NextResponse } from "next/server"

export async function GET() {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    // Assuming we call the backend endpoint we created at /api/auth/bots
    // We might want to secure this endpoint with middleware or session check
    const res = await fetch(`${backendUrl}/api/auth/bots`);

    if (!res.ok) {
        return NextResponse.json({ error: "Failed to fetch from backend" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

