'use client';

import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';

export default function HomePageClient() {
  return (
    <div className="bg-background">
      <HeroWithAuthPrompt />
    </div>
  );
}
