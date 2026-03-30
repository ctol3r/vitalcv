import { redirect } from 'next/navigation';

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

  const webBase = process.env.NEXT_PUBLIC_WEB_APP_URL ?? 'https://vitalcv.com';

  if (npi) {
    redirect(`${webBase}/passport?npi=${npi}`);
  } else {
    redirect(`${webBase}/passport`);
  }
}
