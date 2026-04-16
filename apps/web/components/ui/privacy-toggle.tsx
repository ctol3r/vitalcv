'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PrivacyToggleProps {
  value: 'full' | 'proof';
  onChange: (value: 'full' | 'proof') => void;
  className?: string;
}

export function PrivacyToggle({ value, onChange, className }: PrivacyToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg bg-muted/50 p-0.5 text-xs font-medium',
        className,
      )}
      role="radiogroup"
      aria-label="Disclosure level"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'full'}
        onClick={() => onChange('full')}
        className={cn(
          'rounded-md px-3 py-1.5 transition-all',
          value === 'full'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Full Credential
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'proof'}
        onClick={() => onChange('proof')}
        className={cn(
          'rounded-md px-3 py-1.5 transition-all',
          value === 'proof'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Proof of Status Only
      </button>
    </div>
  );
}
