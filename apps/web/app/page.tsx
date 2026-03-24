'use client';

import React from 'react';
import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';
import { InterviewModeTeaser, TrustStrip } from '@/components/home/PublicTruthSections';
import { HowItWorksSection } from '@/components/marketing/HomeSections';

export default function HomePage() {
  return (
    <div style={{ background: '#080e1a' }} className="min-h-screen">
      <HeroWithAuthPrompt />
      <TrustStrip />
      <HowItWorksSection />
      <InterviewModeTeaser />
    </div>
  );
}
