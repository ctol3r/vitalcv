'use client';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import React, { useEffect } from 'react';

export interface FullScreenModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function FullScreenModal({
  open,
  onClose,
  title,
  children,
  actions,
  className,
}: FullScreenModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0f] text-foreground animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#0f1115] shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="h-6 w-[1px] bg-muted" />
          <h2 className="text-base font-medium tracking-tight">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {actions}
        </div>
      </div>

      {/* Body */}
      <div className={cn("flex-1 overflow-y-auto overscroll-contain", className)}>
        {children}
      </div>
    </div>
  );
}

export function useFullScreenModal() {
  const [open, setOpen] = React.useState(false);
  return {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
  };
}
