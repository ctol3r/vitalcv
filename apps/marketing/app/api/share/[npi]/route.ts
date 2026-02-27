import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { logEvent } from "../../../../lib/events";

const NPI_PATTERN = /^\d{10}$/;

/**
 * POST /api/share/:npi
 *
 * Create a share link for the given NPI.
 * Returns the share link ID for verifier access.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ npi: string }> },
): Promise<NextResponse> {
  const { npi } = await params;

  if (!NPI_PATTERN.test(npi)) {
    return NextResponse.json(
      { error: "NPI must be exactly 10 digits" },
      { status: 400 },
    );
  }

  const exists = npi.startsWith("1");
  if (!exists) {
    return NextResponse.json(
      { error: "NPI not found" },
      { status: 404 },
    );
  }

  const requestUrl = new URL(request.url);
  const organizationId = requestUrl.searchParams.get('organizationId') ?? request.headers.get('x-org-id');
  const normalizedOrganizationId = organizationId?.trim() ?? undefined;
  const shareUrlOrganizationParam = normalizedOrganizationId
    ? `?organizationId=${encodeURIComponent(normalizedOrganizationId)}`
    : '';

  const shareLink = await prisma.shareLink.create({
    data: {
      npi,
      ...(normalizedOrganizationId ? { organizationId: normalizedOrganizationId } : {}),
    },
  });

  void logEvent("share_link_created", npi, { shareId: shareLink.id }, normalizedOrganizationId);

  return NextResponse.json({
    shareId: shareLink.id,
    url: `/verify/${npi}${shareUrlOrganizationParam}`,
  });
}
