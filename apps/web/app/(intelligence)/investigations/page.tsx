import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildLegacyRedirectHref } from '@/lib/intelligence/routes';

export const metadata: Metadata = {
  title: 'Investigations | VitalCV',
  description: 'Focused provider investigations linked from findings, storylines, actions, and provider detail.',
};

export default async function InvestigationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  redirect(buildLegacyRedirectHref('investigations', resolvedSearchParams));
}
