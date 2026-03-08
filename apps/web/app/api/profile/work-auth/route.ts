import { getApiBase } from "@/lib/api";
import { type NextRequest, NextResponse } from "next/server";

const BACKEND = getApiBase();

export async function POST(req: NextRequest) {
  const url = `${BACKEND}/api/profile/work-auth`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  req.headers.forEach((v, k) => { if (k.startsWith("x-clerk-")) headers[k] = v; });
  const body = await req.text();
  const res = await fetch(url, { method: "POST", headers, body });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
