'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--vt-overlay)] p-[var(--vt-space-24)]"
    >
      <div className="w-full max-w-2xl rounded-[var(--vt-radius-lg)] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-[var(--vt-space-24)] shadow-[var(--vt-shadow-modal)]">
        <div className="flex items-start justify-between gap-[var(--vt-space-16)]">
          <div className="space-y-[var(--vt-space-8)]">
            <h2 className="text-[length:var(--vt-type-h2-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
              {title}
            </h2>
            {description ? (
              <p className="text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            aria-label="Close modal"
            className="shrink-0"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-[var(--vt-space-20)]">{children}</div>
        {footer ? (
          <div className={cn('mt-[var(--vt-space-24)] flex flex-wrap items-center justify-end gap-[var(--vt-space-12)]')}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
