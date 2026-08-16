import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    // CD-10 — radius is semantic: 0 structure / 3px document / 10px software /
    // 999px NOTHING. A button is software, so it is 10px. This was
    // `--vt-radius-pill` (9999px, declared in design-system/styles/variables.ts
    // and spread onto <html>), which made every canonical button a pill —
    // the single loudest "SaaS, not record" tell on the product.
    'rounded-[10px] border',
    'px-[var(--vt-space-16)] py-[var(--vt-space-8)]',
    'text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)]',
    'font-[var(--vt-font-weight-medium)]',
    // EC-29 band 1: hover/press/focus on a control is control feedback, 80–150ms.
    'transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--vt-motion-control)] ease-[var(--vt-ease-standard)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vt-bg)]',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-[var(--vt-accent)] text-white hover:opacity-95',
        secondary: 'border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-primary)] hover:bg-[var(--vt-surface-subtle)]',
        ghost: 'border-transparent bg-transparent text-[var(--vt-text-secondary)] hover:bg-[var(--vt-surface-subtle)] hover:text-[var(--vt-text-primary)]',
        danger: 'border-transparent bg-[var(--vt-severity-critical)] text-white hover:opacity-95',
      },
      size: {
        sm: 'min-h-8 px-[var(--vt-space-12)] py-[var(--vt-space-4)] text-[length:var(--vt-type-meta-size)]',
        md: 'min-h-10',
        lg: 'min-h-11 px-[var(--vt-space-20)] py-[var(--vt-space-12)]',
        icon: 'h-10 w-10 px-0 py-0',
      },
      stretch: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  asChild = false,
  className,
  size,
  stretch,
  variant,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, stretch }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
