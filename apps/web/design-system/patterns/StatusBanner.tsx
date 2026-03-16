import type React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type BannerTone = 'info' | 'warning' | 'critical' | 'success';

const TONE_CLASSES: Record<BannerTone, string> = {
  info: 'border-[var(--vt-accent)]/25 bg-[var(--vt-accent)]/10 text-[var(--vt-accent)]',
  warning: 'border-[var(--vt-severity-medium)]/25 bg-[var(--vt-severity-medium)]/10 text-[var(--vt-severity-medium)]',
  critical: 'border-[var(--vt-severity-critical)]/25 bg-[var(--vt-severity-critical)]/10 text-[var(--vt-severity-critical)]',
  success: 'border-[var(--vt-status-resolved)]/25 bg-[var(--vt-status-resolved)]/10 text-[var(--vt-status-resolved)]',
};

const TONE_ICON: Record<BannerTone, React.ReactNode> = {
  info: <Info className="h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  critical: <AlertTriangle className="h-4 w-4 shrink-0" />,
  success: <Info className="h-4 w-4 shrink-0" />,
};

export function StatusBanner({
  children,
  className,
  tone = 'info',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: BannerTone;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-[var(--vt-space-8)] rounded-[var(--vt-radius-md)] border px-[var(--vt-space-16)] py-[var(--vt-space-12)] text-[length:var(--vt-type-meta-size)]',
        TONE_CLASSES[tone],
        className,
      )}
      role="status"
    >
      {TONE_ICON[tone]}
      <span>{children}</span>
    </div>
  );
}
