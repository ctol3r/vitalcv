'use client';

import React from 'react';
import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <HeroWithAuthPrompt />
    </div>
  );
}
