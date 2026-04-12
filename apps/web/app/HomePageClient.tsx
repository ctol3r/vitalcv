'use client';

import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';
import { HeroPreviewReveal } from '@/components/motion/HeroPreviewReveal';
import { HeroAppPreview } from '@/components/marketing/HeroAppPreview';
import {
  ProblemSection,
  HowItWorksSection,
  AudienceSplitSection,
  TractionSection,
  WhyNowSection,
  BuyerPilotSection,
} from '@/components/marketing/HomeSections';
import { StatsSection } from '@/components/marketing/StatsSection';
import { JobsPreview } from '@/components/marketing/JobsPreview';
import { DeveloperPreview } from '@/components/marketing/DeveloperPreview';

export default function HomePageClient() {
  return (
    <div className="bg-background">
      <HeroWithAuthPrompt />

      {/* App preview with orchestrated reveal */}
      <div className="px-6 pb-16 -mt-4">
        <HeroPreviewReveal delay={0.6}>
          <HeroAppPreview />
        </HeroPreviewReveal>
      </div>

      <StatsSection />
      <ProblemSection />
      <HowItWorksSection />
      <JobsPreview />
      <AudienceSplitSection />
      <DeveloperPreview />
      <TractionSection />
      <WhyNowSection />
      <BuyerPilotSection />
    </div>
  );
}
