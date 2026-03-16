import * as React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-[var(--vt-radius-md)] border border-[var(--vt-border)]">
      <table className={cn('min-w-full border-collapse text-left', className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-[var(--vt-surface-subtle)]', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-[var(--vt-border-subtle)]', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('align-top', className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-[var(--vt-space-16)] py-[var(--vt-space-12)] text-[length:var(--vt-type-caption-size)] font-[var(--vt-font-weight-semibold)] uppercase tracking-[0.14em] text-[var(--vt-text-muted)]',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'px-[var(--vt-space-16)] py-[var(--vt-space-12)] text-[length:var(--vt-type-meta-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]',
        className,
      )}
      {...props}
    />
  );
}
