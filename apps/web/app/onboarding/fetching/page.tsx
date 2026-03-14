'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  "Locating NPPES identity...",
  "Verifying state medical licenses...",
  "Checking sanctions and exclusions...",
  "Compiling Trust Passport..."
];

export default function FetchingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentStep < STEPS.length) {
      interval = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 1500); // 1.5s per step for a calm, medical-grade feel
    } else {
      // Small delay after finishing before routing
      const finishTimeout = setTimeout(() => {
        router.push('/onboarding/readiness');
      }, 800);
      return () => clearTimeout(finishTimeout);
    }
    return () => clearTimeout(interval);
  }, [currentStep, router]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
      {/* Bioluminescent scanning glow */}
      <div className="relative w-32 h-32 mb-12 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
        <div className="absolute inset-0 rounded-full border border-emerald-500/10 scale-150" />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-full bg-emerald-400 blur-xl opacity-50"
        />
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-t-2 border-emerald-400"
        />
      </div>

      <div className="h-16 relative w-full text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-2xl md:text-3xl text-white/70 font-medium absolute inset-x-0"
          >
            {STEPS[currentStep] || "Finalizing..."}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
