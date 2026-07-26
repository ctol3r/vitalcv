import { redirect } from 'next/navigation';

/**
 * Legacy entry retained only for existing bookmarks. Canonical review now
 * starts at the employer application route so the queue and detail path share
 * one stable route family.
 */
export default async function LegacyEmployerReviewRedirect({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/employer/applications/${encodeURIComponent(applicationId)}`);
}
