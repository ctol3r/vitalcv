import { NextResponse } from "next/server";

export async function GET() {
  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_AGENT_BASE || "http://localhost:4000";

    const response = await fetch(`${backendUrl}/_debug/traces`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error proxying traces:", error);
    return NextResponse.json(
      { error: error.message, rows: [] },
      { status: 500 }
    );
  }
}
