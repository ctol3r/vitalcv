import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <article
      className={cn(
        'rounded-[var(--vt-radius-lg)] border border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-primary)] shadow-[var(--vt-shadow-card)]',
        'p-[var(--vt-space-24)]',
        interactive ? 'transition-all duration-[var(--vt-motion-control)] ease-[var(--vt-ease-spring)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[var(--vt-border)]/20' : '',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-[var(--vt-space-8)]', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-[length:var(--vt-type-h3-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-[var(--vt-space-16)]', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-[var(--vt-space-20)] flex items-center gap-[var(--vt-space-12)]', className)} {...props} />;
}
