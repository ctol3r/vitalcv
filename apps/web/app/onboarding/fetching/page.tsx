import { redirect } from 'next/navigation';

export default async function FetchingPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : null;

  redirect(returnTo ? `/onboarding?returnTo=${encodeURIComponent(returnTo)}` : '/onboarding');
}
