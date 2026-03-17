import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

function resolveRedirectUrl(nextUrl: string | null): string {
  if (!nextUrl) {
    return '/intelligence';
  }

  if (nextUrl.startsWith('/')) {
    return nextUrl;
  }

  try {
    const parsed = new URL(nextUrl);
    const candidate = `${parsed.pathname}${parsed.search}`;
    return candidate.startsWith('/') ? candidate : '/intelligence';
  } catch {
    return '/intelligence';
  }
}

export default async function IntelligenceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session.userId) {
    const requestHeaders = await headers();
    const redirectUrl = resolveRedirectUrl(requestHeaders.get('next-url'));
    redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
  }

  return children;
}
