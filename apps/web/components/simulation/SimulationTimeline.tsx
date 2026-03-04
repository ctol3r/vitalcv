'use client';

import { cn } from '@/lib/utils'; // Assuming this utility exists
import { motion } from 'framer-motion';
import { CheckCircle2, FileWarning, ShieldCheck, Zap } from 'lucide-react';

export type SimulationPhase = 'idle' | 'verification' | 'decision' | 'revocation' | 'cascade';

interface SimulationTimelineProps {
  currentPhase: SimulationPhase;
}

const PHASES = [
  { id: 'verification', label: 'Verification', icon: ShieldCheck },
  { id: 'decision', label: 'Decision', icon: CheckCircle2 },
  { id: 'revocation', label: 'Revocation', icon: FileWarning },
  { id: 'cascade', label: 'Cascade', icon: Zap },
];

export function SimulationTimeline({ currentPhase }: SimulationTimelineProps) {
  const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-8 py-4 shadow-2xl">
      <div className="flex items-center gap-12 relative">
        {/* Connection Line */}
        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white/10 -translate-y-1/2 -z-10" />

        {/* Active Progress Line */}
        {currentIndex >= 0 && (
          <motion.div
            className="absolute top-1/2 left-4 h-0.5 bg-blue-500 -translate-y-1/2 -z-10 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
            initial={{ width: '0%' }}
            animate={{
              width: currentIndex === 0 ? '0%' :
                     currentIndex === PHASES.length - 1 ? 'calc(100% - 32px)' :
                     `${(currentIndex / (PHASES.length - 1)) * 100}%`
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.8 }}
          />
        )}

        {PHASES.map((phase, i) => {
          const isActive = phase.id === currentPhase;
          const isPast = currentIndex > i;
          const isFuture = currentIndex < i;
          const Icon = phase.icon;

          return (
            <div key={phase.id} className="relative flex flex-col items-center gap-2 group">
              <motion.div
                animate={{
                  scale: isActive ? 1.2 : 1,
                  backgroundColor: isActive ? 'rgba(59, 130, 246, 1)' :
                                   isPast ? 'rgba(59, 130, 246, 0.2)' :
                                   'rgba(0, 0, 0, 0.8)',
                  borderColor: isActive || isPast ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors shadow-lg",
                  isActive && "shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5",
                  isActive ? "text-white" :
                  isPast ? "text-blue-400" :
                  "text-zinc-500"
                )} />

                {/* Ping effect for active state */}
                {isActive && (
                  <motion.div
                    animate={{
                      scale: [1, 2],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                    className="absolute inset-0 rounded-full bg-blue-500"
                  />
                )}
              </motion.div>

              <span className={cn(
                "absolute -bottom-8 text-xs font-semibold whitespace-nowrap tracking-wider uppercase transition-colors duration-300",
                isActive ? "text-blue-400" :
                isPast ? "text-blue-200/60" :
                "text-zinc-600"
              )}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
