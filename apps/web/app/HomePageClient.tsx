'use client';

import React from 'react';
import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';
import { TrustStrip } from '@/components/home/PublicTruthSections';
import { BuyerPilotSection, HowItWorksSection } from '@/components/marketing/HomeSections';

export default function HomePageClient() {
  return (
    <div className="min-h-screen bg-background">
      <HeroWithAuthPrompt />
      <TrustStrip />
      <HowItWorksSection />
      <BuyerPilotSection />
    </div>
  );
}
