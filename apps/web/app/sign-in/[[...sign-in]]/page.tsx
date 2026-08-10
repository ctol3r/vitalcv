import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AuthDisclosureCard } from '@/components/auth/AuthDisclosureCard';
import { AuthUnavailableNotice } from '@/components/auth/AuthUnavailableNotice';
import DevKeysNotice from '@/components/auth/DevKeysNotice';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { authCardAppearance } from '@/lib/clerkAppearance';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Welcome back to VitalCV. Access your profile, readiness progress, opportunities, applications, and shared evidence.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Keyless environments (local prod builds, e2e) render the honest
  // unavailable card — mounting Clerk's component without ClerkProvider throws.
  if (!CLERK_PROVIDER_ENABLED) {
    return <AuthUnavailableNotice mode="sign-in" />;
  }

  // A signed-in visitor gets their workspace, not the app shell rendering a
  // sign-in card. /holder/home is safe for every role: the middleware's
  // role-mismatch redirect forwards non-clinicians to their own landing.
  const session = await auth();
  if (session.userId) {
    const sp = (await searchParams) ?? {};
    const raw = sp.redirect_url;
    const target =
      typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')
        ? raw
        : '/holder/home';
    redirect(target);
  }
  return (
    <>
      <DevKeysNotice />
      <AuthDisclosureCard mode="sign-in">
        <SignIn appearance={authCardAppearance} />
      </AuthDisclosureCard>
    </>
  );
}
