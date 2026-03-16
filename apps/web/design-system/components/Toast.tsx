import * as React from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'critical';

const TOAST_ICON: Record<ToastTone, React.ReactNode> = {
  neutral: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  critical: <XCircle className="h-4 w-4" />,
};

const TOAST_CLASSES: Record<ToastTone, string> = {
  neutral: 'border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-primary)]',
  success: 'border-[var(--vt-status-resolved)]/25 bg-[var(--vt-status-resolved)]/10 text-[var(--vt-status-resolved)]',
  warning: 'border-[var(--vt-severity-medium)]/25 bg-[var(--vt-severity-medium)]/10 text-[var(--vt-severity-medium)]',
  critical: 'border-[var(--vt-severity-critical)]/25 bg-[var(--vt-severity-critical)]/10 text-[var(--vt-severity-critical)]',
};

export interface ToastBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: ToastTone;
  title: string;
  description?: string;
}

export function ToastBanner({
  className,
  description,
  title,
  tone = 'neutral',
  ...props
}: ToastBannerProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-[var(--vt-space-12)] rounded-[var(--vt-radius-md)] border px-[var(--vt-space-16)] py-[var(--vt-space-12)] shadow-[var(--vt-shadow-card)]',
        TOAST_CLASSES[tone],
        className,
      )}
      role="status"
      {...props}
    >
      <span aria-hidden="true" className="mt-0.5">{TOAST_ICON[tone]}</span>
      <div className="space-y-1">
        <p className="text-[length:var(--vt-type-meta-size)] font-[var(--vt-font-weight-semibold)]">{title}</p>
        {description ? (
          <p className="text-[length:var(--vt-type-caption-size)] leading-[var(--vt-line-normal)] opacity-90">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
