import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Minus } from 'lucide-react';
import type { ComponentProps } from 'react';

type StatusKind = 'verified' | 'pending' | 'warning' | 'missing' | 'unavailable';

const STATUS_CONFIG: Record<
  StatusKind,
  {
    icon: typeof CheckCircle2;
    color: string;
    bg: string;
    label: string;
  }
> = {
  verified: {
    icon: CheckCircle2,
    color: 'text-[var(--vt-status-resolved)]',
    bg: 'bg-[var(--vt-status-resolved)]/10',
    label: 'Verified',
  },
  pending: {
    icon: Clock,
    color: 'text-[var(--vt-severity-high)]',
    bg: 'bg-[var(--vt-severity-high)]/10',
    label: 'Pending',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-[var(--vt-severity-high)]',
    bg: 'bg-[var(--vt-severity-high)]/10',
    label: 'Warning',
  },
  missing: {
    icon: XCircle,
    color: 'text-[var(--vt-severity-critical)]',
    bg: 'bg-[var(--vt-severity-critical)]/10',
    label: 'Missing',
  },
  unavailable: {
    icon: Minus,
    color: 'text-[var(--vt-text-muted)]',
    bg: 'bg-[var(--vt-text-muted)]/10',
    label: 'Unavailable',
  },
};

interface StatusIconProps extends Omit<ComponentProps<'div'>, 'children'> {
  status: StatusKind;
  /** Show text label next to icon */
  showLabel?: boolean;
  /** Override the default label */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: { icon: 'h-3 w-3', text: 'text-[10px]', gap: 'gap-1', pad: 'px-1.5 py-0.5' },
  md: { icon: 'h-3.5 w-3.5', text: 'text-xs', gap: 'gap-1.5', pad: 'px-2 py-1' },
  lg: { icon: 'h-4 w-4', text: 'text-sm', gap: 'gap-2', pad: 'px-2.5 py-1.5' },
};

export function StatusIcon({
  status,
  showLabel = false,
  label,
  size = 'md',
  className,
  ...props
}: StatusIconProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const s = sizeClasses[size];
  const displayLabel = label ?? config.label;

  if (!showLabel) {
    return (
      <Icon
        className={cn(s.icon, config.color, className)}
        aria-label={displayLabel}
        {...(props as ComponentProps<'svg'>)}
      />
    );
  }

  return (
    <div
      role="status"
      aria-label={displayLabel}
      className={cn(
        'inline-flex items-center font-medium',
        s.gap,
        s.pad,
        s.text,
        config.color,
        config.bg,
        className,
      )}
      {...props}
    >
      <Icon className={cn(s.icon, 'shrink-0')} aria-hidden="true" />
      <span>{displayLabel}</span>
    </div>
  );
}

export type { StatusKind, StatusIconProps };
