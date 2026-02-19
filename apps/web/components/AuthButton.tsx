'use client';

import { UserButton } from '@clerk/nextjs';

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function AuthButton() {
  if (!clerkEnabled) {
    return null;
  }

  return <UserButton afterSignOutUrl="/" />;
}
