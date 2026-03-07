'use client';

/**
 * Skeleton — Wave 129: Uiverse Pattern Adoption
 *
 * Accessible skeleton loader with reduced-motion support.
 * Normalized to VitalCV design tokens.
 */

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  animate?: boolean;
}

export function Skeleton({
  className,
  width,
  height,
  rounded = 'lg',
  animate = true,
}: SkeletonProps) {
  const roundedMap = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'bg-zinc-800/60',
        roundedMap[rounded],
        animate && 'animate-pulse motion-reduce:animate-none',
        className
      )}
      style={{ width, height }}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          className={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3', className)} role="status" aria-label="Loading card">
      <div className="flex items-center gap-3">
        <Skeleton width={40} height={40} rounded="full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton height={14} className="w-1/2" />
          <Skeleton height={10} className="w-1/3" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}
