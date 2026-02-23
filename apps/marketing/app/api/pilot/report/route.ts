import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

/**
 * GET /api/pilot/report
 *
 * Pure metrics JSON — no marketing language.
 * Protected by INTERNAL_DASH_PASSWORD (same as metrics dashboard).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const password = process.env.INTERNAL_DASH_PASSWORD ?? "";

  // Simple bearer token auth for API consumers
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  if (token !== password || password === "") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalShareLinks, totalViews, totalExports] = await Promise.all([
    prisma.shareLink.count(),
    prisma.eventLog.count({ where: { eventType: "artifact_viewed" } }),
    prisma.eventLog.count({ where: { eventType: "artifact_exported" } }),
  ]);

  // Compute avg time-to-view from ShareLink records with firstViewAt
  const viewedLinks = await prisma.shareLink.findMany({
    where: { firstViewAt: { not: null } },
    select: { createdAt: true, firstViewAt: true },
  });

  let avgTimeToViewMs: number | null = null;
  if (viewedLinks.length > 0) {
    const totalMs = viewedLinks.reduce((sum: number, link) => {
      return sum + (link.firstViewAt!.getTime() - link.createdAt.getTime());
    }, 0);
    avgTimeToViewMs = Math.round(totalMs / viewedLinks.length);
  }

  return NextResponse.json({
    totalShareLinks,
    totalViews,
    avgTimeToViewMs,
    totalExports,
  });
}
