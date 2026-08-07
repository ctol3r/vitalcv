import { redirect } from 'next/navigation';

/**
 * /passport/[id] — RETIRED (founder decision, 2026-08-07).
 *
 * The 10-digit branch must keep resolving FOREVER: shipped mobile binaries
 * hardcode `https://vitalcv.com/passport/{npi}` as their handoff fallback
 * (apps/mobile app/(tabs)/index.tsx) and cannot be redeployed. /verify/[npi]
 * renders the same backend passport endpoint this page rendered, in the
 * canonical design system, with more content.
 *
 * Legacy UUID entity ids have no /verify equivalent — they land on the
 * canonical entry instead of a 404, which is the same posture the
 * design-wave1505 contract treats as correct for dead share links.
 */
export const dynamic = 'force-dynamic';

export default async function RetiredPassportEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (/^\d{10}$/.test(id)) {
    redirect(`/verify/${id}`);
  }
  redirect('/onboarding');
}
