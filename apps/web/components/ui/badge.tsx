import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        'trust-green':
          'border-transparent bg-[var(--trust-green)]/15 text-[var(--trust-green)]',
        'trust-yellow':
          'border-transparent bg-[var(--trust-yellow)]/15 text-[var(--trust-yellow)]',
        'trust-red':
          'border-transparent bg-[var(--trust-red)]/15 text-[var(--trust-red)]',
        'claim-l0':
          'border-dashed border-[var(--claim-l0)] text-[var(--claim-l0-foreground)] bg-transparent',
        'claim-l1':
          'border-transparent bg-[var(--claim-l1)] text-[var(--claim-l1-foreground)]',
        'claim-l2':
          'border-transparent bg-[var(--claim-l2)] text-[var(--claim-l2-foreground)]',
        'claim-l3':
          'border-transparent bg-[var(--claim-l3)] text-[var(--claim-l3-foreground)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>) {
  return <div data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
