'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

function GlassModal({ open, onClose, children, className }: GlassModalProps) {
  React.useEffect(() => {
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
      data-slot="glass-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop blur overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-glass-fade-in" />

      {/* Modal content */}
      <div
        data-slot="glass-modal"
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl p-6',
          'glass-heavy glass-border',
          'animate-glass-fade-in',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function GlassModalHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-modal-header"
      className={cn('pb-4', className)}
      {...props}
    />
  );
}

function GlassModalTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="glass-modal-title"
      className={cn('font-heading text-xl font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

function GlassModalBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-modal-body"
      className={cn('text-sm', className)}
      {...props}
    />
  );
}

function GlassModalFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-modal-footer"
      className={cn('flex items-center justify-end gap-3 pt-4', className)}
      {...props}
    />
  );
}

export { GlassModal, GlassModalHeader, GlassModalTitle, GlassModalBody, GlassModalFooter };
