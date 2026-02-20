import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

const PASSWORD = process.env.INTERNAL_DASH_PASSWORD ?? "";

function isAuthed(cookieStore: Awaited<ReturnType<typeof cookies>>): boolean {
  return cookieStore.get("internal_auth")?.value === PASSWORD && PASSWORD !== "";
}

/**
 * GET /api/internal/metrics
 * Returns traction metrics. Protected by INTERNAL_DASH_PASSWORD.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  if (!isAuthed(cookieStore)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const organizationId =
    requestUrl.searchParams.get('organizationId')?.trim() ??
    request.headers.get('x-org-id')?.trim();

  const organizationFilter = organizationId ? { organizationId } : {};

  const [
    totalLookups,
    totalShareLinks,
    totalViews,
    totalExports,
  ] = await Promise.all([
    prisma.eventLog.count({ where: { eventType: "npi_lookup", ...organizationFilter } }),
    prisma.eventLog.count({ where: { eventType: "share_link_created", ...organizationFilter } }),
    prisma.eventLog.count({ where: { eventType: "artifact_viewed", ...organizationFilter } }),
    prisma.eventLog.count({ where: { eventType: "artifact_exported", ...organizationFilter } }),
  ]);

  // Avg time from share_link_created → artifact_viewed (derived from ShareLink.firstViewAt)
  const viewedLinks = await prisma.shareLink.findMany({
    where: { firstViewAt: { not: null }, ...organizationFilter },
    select: { createdAt: true, firstViewAt: true },
  });

  let avgTimeToViewMs: number | null = null;
  if (viewedLinks.length > 0) {
    const totalMs = viewedLinks.reduce((sum: number, link) => {
      return sum + (link.firstViewAt!.getTime() - link.createdAt.getTime());
    }, 0);
    avgTimeToViewMs = totalMs / viewedLinks.length;
  }

  return NextResponse.json({
    totalLookups,
    totalShareLinks,
    totalViews,
    totalExports,
    avgTimeToViewMs,
    avgTimeToViewFormatted: avgTimeToViewMs
      ? formatDuration(avgTimeToViewMs)
      : "N/A",
  });
}

/**
 * POST /api/internal/metrics
 * Authenticate with password.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const password = (body as { password?: string }).password ?? "";

  if (password !== PASSWORD || PASSWORD === "") {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("internal_auth", password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });

  return response;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
