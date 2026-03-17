import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildLegacyRedirectHref } from '@/lib/intelligence/routes';

export const metadata: Metadata = {
  title: 'Actions | VitalCV',
  description: 'Recommended action queue with triage mutations, pagination, and detail routes.',
};

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  redirect(buildLegacyRedirectHref('actions', resolvedSearchParams));
}
