'use client';

import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';
import { SignedIn } from '@clerk/nextjs';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';

export default function HomePageClient() {
  return (
    <div className="bg-background">
      {CLERK_PROVIDER_ENABLED && (
        <SignedIn>
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 py-2.5 px-4 text-center">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              You are signed in securely.
              <Link href="/holder" className="underline font-semibold ml-2 hover:text-emerald-500 transition-colors">
                Go to Workspace →
              </Link>
            </p>
          </div>
        </SignedIn>
      )}
      <HeroWithAuthPrompt />
    </div>
  );
}
