import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildLegacyRedirectHref } from '@/lib/intelligence/routes';

export const metadata: Metadata = {
  title: 'Providers | VitalCV',
  description: 'Provider directory with search, trust filtering, and linked detail views.',
};

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  redirect(buildLegacyRedirectHref('providers', resolvedSearchParams));
}
