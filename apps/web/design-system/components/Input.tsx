import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-[var(--vt-radius-md)] border border-[var(--vt-border)] bg-[var(--vt-surface)]',
        'px-[var(--vt-space-16)] py-[var(--vt-space-12)]',
        'text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-primary)] placeholder:text-[var(--vt-text-muted)]',
        'transition-[border-color,box-shadow] duration-[var(--vt-motion-control)] ease-[var(--vt-ease-standard)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vt-bg)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
