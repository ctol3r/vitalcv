import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'rounded-[var(--vt-radius-pill)] border',
    'px-[var(--vt-space-12)] py-[var(--vt-space-4)]',
    'text-[length:var(--vt-type-caption-size)] leading-[var(--vt-line-tight)]',
    'font-[var(--vt-font-weight-semibold)] uppercase tracking-[0.16em]',
    'transition-[background-color,border-color,color] duration-[var(--vt-motion-fast)] ease-[var(--vt-ease-standard)]',
  ].join(' '),
  {
    variants: {
      variant: {
        neutral: 'border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] text-[var(--vt-text-secondary)]',
        accent: 'border-transparent bg-[var(--vt-accent)]/15 text-[var(--vt-accent)]',
        critical: 'border-transparent bg-[var(--vt-severity-critical)]/14 text-[var(--vt-severity-critical)]',
        warning: 'border-transparent bg-[var(--vt-severity-medium)]/18 text-[var(--vt-severity-medium)]',
        success: 'border-transparent bg-[var(--vt-status-resolved)]/16 text-[var(--vt-status-resolved)]',
        outline: 'border-[var(--vt-border)] bg-transparent text-[var(--vt-text-secondary)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
