'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div 
      className="min-h-screen flex flex-col justify-center items-center p-6 md:p-12 overflow-x-hidden relative"
      style={{
        background: 'linear-gradient(145deg, #080e1a 0%, #0b1220 50%, #07101e 100%)',
      }}
    >
      {/* Precision grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #a0c4ff 1px, transparent 1px), linear-gradient(to bottom, #a0c4ff 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(16,185,129,0.05) 0%, transparent 60%)',
        }}
      />
      
      <div className="relative z-10 w-full max-w-5xl mx-auto">
        {children}
      </div>
    </div>
  );
}
