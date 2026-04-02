'use client';
import { cn } from '@/lib/utils';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type AnnouncementType = 'info' | 'warning' | 'critical';

export interface AnnouncementBarProps {
  message: string;
  type?: AnnouncementType;
  dismissible?: boolean;
  ctaText?: string;
  ctaHref?: string;
  onDismiss?: () => void;
}

const TYPE_CONFIG: Record<AnnouncementType, { bg: string; text: string; icon: any; border: string }> = {
  info: { bg: 'bg-vt-info/10', text: 'text-vt-info', border: 'border-vt-info/20', icon: Info },
  warning: { bg: 'bg-vt-warning/10', text: 'text-vt-warning', border: 'border-vt-warning/20', icon: AlertTriangle },
  critical: { bg: 'bg-vt-danger/10', text: 'text-vt-danger', border: 'border-vt-danger/20', icon: AlertCircle },
};

export function AnnouncementBar({ message, type = 'info', dismissible = true, ctaText, ctaHref, onDismiss }: AnnouncementBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`bar-dismissed-${message}`)) {
      setDismissed(true);
    }
  }, [message]);

  if (!mounted || dismissed) return null;

  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(`bar-dismissed-${message}`, '1');
    onDismiss?.();
  };

  return (
    <div className={cn(
      "w-full border-b backdrop-blur-md flex items-center justify-between px-4 py-2",
      config.bg, config.border
    )}>
      <div className="flex items-center gap-3">
        <Icon className={cn("w-4 h-4 shrink-0", config.text)} />
        <span className="text-[11px] font-medium text-white/90">
          {message}
          {ctaText && ctaHref && (
            <a href={ctaHref} className={cn("ml-3 font-semibold underline hover:text-foreground transition-colors", config.text)}>
              {ctaText}
            </a>
          )}
        </span>
      </div>

      {dismissible && (
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-sm text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
