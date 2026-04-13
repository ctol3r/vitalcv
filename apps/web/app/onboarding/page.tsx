import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OnboardingPage({ searchParams }: Props) {
  const params = await searchParams;
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const npi = typeof params.npi === 'string' ? params.npi : undefined;

  const dest = new URL('/passport', 'http://localhost');
  if (npi) dest.searchParams.set('npi', npi);
  if (returnTo) dest.searchParams.set('returnTo', returnTo);

  redirect(`${dest.pathname}${dest.search}`);
}
