/**
 * TrustRing Component
 * Animated trust ring visualization behind credential icon
 */

'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

interface TrustRingProps {
  trustScore: number; // 0-1
  className?: string;
}

export function TrustRing({ trustScore, className }: TrustRingProps) {
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ringRef.current) return;

    // Animate trust ring pulse
    const ring = ringRef.current;
    const pulse = () => {
      ring.style.transform = 'scale(1.1)';
      ring.style.opacity = '0.3';
      setTimeout(() => {
        ring.style.transform = 'scale(1)';
        ring.style.opacity = '0.1';
      }, 600);
    };

    const interval = setInterval(pulse, 2000);
    return () => clearInterval(interval);
  }, []);

  const getColor = () => {
    if (trustScore >= 0.8) return 'emerald';
    if (trustScore >= 0.5) return 'amber';
    return 'red';
  };

  const color = getColor();
  const circumference = 2 * Math.PI * 40; // radius = 40
  const offset = circumference * (1 - trustScore);

  return (
    <div className={cn('absolute inset-0 flex items-center justify-center', className)}>
      <svg
        className="w-32 h-32 transform -rotate-90"
        viewBox="0 0 100 100"
        ref={ringRef}
      >
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/20"
        />
        {/* Trust score arc */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'transition-all duration-1000',
            color === 'emerald' && 'text-emerald-500',
            color === 'amber' && 'text-amber-500',
            color === 'red' && 'text-red-500',
          )}
        />
      </svg>
    </div>
  );
}

