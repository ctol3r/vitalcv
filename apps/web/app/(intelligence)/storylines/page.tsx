import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildLegacyRedirectHref } from '@/lib/intelligence/routes';

export const metadata: Metadata = {
  title: 'Storylines | VitalCV',
  description: 'Operational storyline clusters with detail routes, linked findings, and triage controls.',
};

export default async function StorylinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  redirect(buildLegacyRedirectHref('storylines', resolvedSearchParams));
}
