'use client';

/**
 * Loader — Wave 129: Uiverse Pattern Adoption
 *
 * Animated loaders with reduced-motion fallback.
 */

import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'pulse';
  className?: string;
  label?: string;
}

export function Loader({ size = 'md', variant = 'spinner', className, label = 'Loading' }: LoaderProps) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

  if (variant === 'dots') {
    const dotSize = { sm: 'h-1 w-1', md: 'h-1.5 w-1.5', lg: 'h-2 w-2' }[size];
    return (
      <div className={cn('flex items-center gap-1', className)} role="status" aria-label={label}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              dotSize,
              'rounded-full bg-zinc-400 animate-bounce motion-reduce:animate-none'
            )}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('flex items-center justify-center', className)} role="status" aria-label={label}>
        <div className={cn(sizeMap[size], 'rounded-full bg-emerald-500/30 animate-ping motion-reduce:animate-none')} />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  // Spinner (default)
  return (
    <div className={cn('flex items-center justify-center', className)} role="status" aria-label={label}>
      <svg
        className={cn(sizeMap[size], 'animate-spin motion-reduce:animate-none text-zinc-400')}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
