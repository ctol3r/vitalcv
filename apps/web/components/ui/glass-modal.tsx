'use client';

/**
 * @deprecated — migrating to canonical flat modal. Strip glass after scoped migration.
 */

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
      data-slot="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/20" />
      <div
        data-slot="modal"
        className={cn(
          'relative z-10 w-full max-w-lg',
          'rounded-[var(--vt-radius-lg)]',
          'border border-[var(--vt-border)]',
          'bg-[var(--vt-surface)] text-[var(--vt-text-primary)]',
          'p-[var(--vt-space-24)]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function GlassModalHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="modal-header" className={cn('pb-[var(--vt-space-16)]', className)} {...props} />;
}

function GlassModalTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="modal-title"
      className={cn(
        'text-[length:var(--vt-type-h2-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)]',
        className,
      )}
      {...props}
    />
  );
}

function GlassModalBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="modal-body" className={cn(className)} {...props} />;
}

function GlassModalFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="modal-footer"
      className={cn('flex items-center justify-end gap-[var(--vt-space-12)] pt-[var(--vt-space-16)]', className)}
      {...props}
    />
  );
}

export { GlassModal, GlassModalHeader, GlassModalTitle, GlassModalBody, GlassModalFooter };
