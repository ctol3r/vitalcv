import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildLegacyRedirectHref } from '@/lib/intelligence/routes';

export const metadata: Metadata = {
  title: 'Investigator Calibration | VitalCV',
  description: 'Investigator accuracy, false positive rates, evidence quality, and learning loop metrics.',
};

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  redirect(buildLegacyRedirectHref('calibration', resolvedSearchParams));
}
