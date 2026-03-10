'use client';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  actions?: React.ReactNode;
  overlay?: boolean;
}

const WIDTHS = {
  sm: 'w-[400px]',
  md: 'w-[560px]',
  lg: 'w-[720px]',
  xl: 'w-[960px]',
  full: 'w-screen'
};

export function Drawer({ open, onClose, title, width = 'md', children, actions, overlay = true }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {overlay && (
        <div
          className={cn(
            "fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        role="dialog"
        aria-modal
        aria-label={typeof title === 'string' ? title : 'Drawer'}
        ref={ref}
        className={cn(
          "fixed top-0 right-0 h-full z-50 flex flex-col bg-[#0f1115] border-l border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)] transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1)",
          WIDTHS[width],
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-[#0f1115]/80 backdrop-blur-md">
          <div className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            {title}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0 overscroll-contain bg-[#0a0a0f]">
          {children}
        </div>
      </div>
    </>
  );
}

export function useDrawer() {
  const [open, setOpen] = React.useState(false);
  return { open, onOpen: () => setOpen(true), onClose: () => setOpen(false) };
}
