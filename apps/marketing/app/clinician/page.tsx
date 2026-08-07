import { redirect } from 'next/navigation';
import { buildWebAppUrl } from '../../lib/webAppUrl';

/**
 * Clinician page — redirects to the real live wedge on vitalcv.com.
 * The placeholder credential profile has been replaced by the live passport flow.
 */
export default async function ClinicianPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const npi = typeof params.npi === 'string' ? params.npi : null;

  if (npi) {
    redirect(buildWebAppUrl('/onboarding'));
  } else {
    redirect(buildWebAppUrl('/onboarding'));
  }
}
