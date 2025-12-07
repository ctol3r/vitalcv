import { NextResponse } from "next/server";

export async function GET() {
  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_AGENT_BASE || "http://localhost:4000";

    const response = await fetch(`${backendUrl}/_debug/mcps`, {
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
    console.error("Error proxying MCPs:", error);
    return NextResponse.json(
      { error: error.message, tools: [] },
      { status: 500 }
    );
  }
}

