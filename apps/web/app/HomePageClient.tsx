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
      {/* Credibility anchor — links to real pilot evidence */}
      <div className="border-t border-slate-100 py-6 px-4">
        <div className="max-w-lg mx-auto text-center">
          <Link
            href="/p/norcal-pa-pilot-1"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors group"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            See real pilot results — identity verified in 1.8 min
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
