import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DropdownOption {
  label: string;
  value: string;
}

export interface DropdownProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: DropdownOption[];
  placeholder?: string;
}

export function Dropdown({
  className,
  options,
  placeholder,
  ...props
}: DropdownProps) {
  return (
    <select
      className={cn(
        'w-full rounded-[var(--vt-radius-md)] border border-[var(--vt-border)] bg-[var(--vt-surface)]',
        'px-[var(--vt-space-16)] py-[var(--vt-space-12)]',
        'text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vt-bg)]',
        className,
      )}
      {...props}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
