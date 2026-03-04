'use client';

/**
 * DemoController.tsx — Wave 60: Demo Playback Controls
 *
 * Play / Pause / Restart controls for the guided demo experience.
 * Manages step progression with timing and callbacks.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface DemoStep {
  id: string;
  label: string;
  description: string;
  durationMs: number;
  data: Record<string, unknown>;
}

interface DemoControllerProps {
  steps: DemoStep[];
  onStepChange: (stepIndex: number, step: DemoStep) => void;
  onComplete: () => void;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function DemoController({ steps, onStepChange, onComplete, className = '' }: DemoControllerProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
  }, []);

  const advanceStep = useCallback((index: number) => {
    if (index >= steps.length) {
      setPlaying(false);
      setProgress(100);
      onComplete();
      return;
    }

    const step = steps[index];
    setCurrentStep(index);
    setProgress(0);
    onStepChange(index, step);

    // Progress bar
    const interval = 50;
    const increments = step.durationMs / interval;
    let tick = 0;
    progressRef.current = setInterval(() => {
      tick++;
      setProgress((tick / increments) * 100);
    }, interval);

    // Advance after duration
    timerRef.current = setTimeout(() => {
      clearTimers();
      advanceStep(index + 1);
    }, step.durationMs);
  }, [steps, onStepChange, onComplete, clearTimers]);

  const play = useCallback(() => {
    setPlaying(true);
    advanceStep(currentStep < 0 ? 0 : currentStep);
  }, [advanceStep, currentStep]);

  const pause = useCallback(() => {
    setPlaying(false);
    clearTimers();
  }, [clearTimers]);

  const restart = useCallback(() => {
    clearTimers();
    setCurrentStep(-1);
    setProgress(0);
    setPlaying(true);
    // Small delay to reset UI
    setTimeout(() => advanceStep(0), 100);
  }, [clearTimers, advanceStep]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const activeStep = currentStep >= 0 && currentStep < steps.length ? steps[currentStep] : null;

  return (
    <div className={`glass rounded-xl p-4 ${className}`}>
      {/* Step indicator */}
      <div className="flex gap-1 mb-3">
        {steps.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/[0.06]">
            <motion.div
              className={`h-full rounded-full ${
                i < currentStep ? 'bg-emerald-500' :
                i === currentStep ? 'bg-emerald-400' : 'bg-transparent'
              }`}
              animate={{ width: i === currentStep ? `${progress}%` : i < currentStep ? '100%' : '0%' }}
              transition={{ duration: 0.05 }}
            />
          </div>
        ))}
      </div>

      {/* Current step info */}
      <div className="mb-3 min-h-[40px]">
        {activeStep ? (
          <motion.div key={activeStep.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-sm font-semibold text-zinc-200">{activeStep.label}</p>
            <p className="text-[11px] text-zinc-500">{activeStep.description}</p>
          </motion.div>
        ) : (
          <p className="text-sm text-zinc-500">
            {currentStep >= steps.length ? 'Demo complete ✓' : 'Ready to start'}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!playing ? (
          <button onClick={play}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors">
            {currentStep < 0 ? '▶ Play Demo' : currentStep >= steps.length ? '▶ Replay' : '▶ Resume'}
          </button>
        ) : (
          <button onClick={pause}
            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition-colors">
            ❚❚ Pause
          </button>
        )}
        <button onClick={restart}
          className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg text-sm transition-colors">
          ↻
        </button>
      </div>

      {/* Step counter */}
      <p className="text-[9px] text-zinc-600 text-center mt-2">
        Step {Math.max(currentStep + 1, 1)} of {steps.length}
      </p>
    </div>
  );
}

export default DemoController;
