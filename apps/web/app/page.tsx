'use client';

import React from 'react';
import Link from 'next/link';
import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';
import { TrustStrip } from '@/components/home/PublicTruthSections';
import { HowItWorksSection } from '@/components/marketing/HomeSections';

export default function HomePage() {
  return (
    <div className="bg-background">
      <HeroWithAuthPrompt />
      <TrustStrip />
      {/* Secondary CTAs — employer review + packet sample */}
      <div className="border-b border-white/6 bg-white/[0.015] px-4 sm:px-6 py-4">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-center gap-6 text-xs text-white/35">
          <Link
            href="/review"
            className="transition hover:text-white/55"
          >
            Employer? See how review works →
          </Link>
          <span className="hidden sm:inline text-white/10">|</span>
          <Link
            href="/passport"
            className="transition hover:text-white/55"
          >
            Already have an NPI? Go to passport →
          </Link>
        </div>
      </div>
      <HowItWorksSection />
    </div>
  );
}
