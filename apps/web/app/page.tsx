'use client';

import React from 'react';
import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';
import { TrustStrip } from '@/components/home/PublicTruthSections';
import { HowItWorksSection } from '@/components/marketing/HomeSections';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <HeroWithAuthPrompt />
      <TrustStrip />
      <HowItWorksSection />
    </div>
  );
}
